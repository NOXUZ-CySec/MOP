'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBackupController1098 } = require('../desktop/backup1098-ipc.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mop-backup-ipc1098-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const context = { session: { userId: 'fixture-admin', role: 'admin', condos: null },
    epoch: 1, store: { db: {} }, version: '2.3.0-preview.109.8' };
  const calls = [];
  let disposed = 0;
  const module = {
    createSafeStorageProtector: () => ({ kind: 'windows-user', available: async () => true, dispose: () => disposed++ }),
    createPassphraseProtector: password => {
      assert.equal(password, 'fixture-password-long');
      return { kind: 'passphrase', dispose: () => disposed++ };
    },
    listSnapshots: async () => [{ id: 'fixture-windows', protection: 'windows-user' }, { id: 'fixture-portable', protection: 'passphrase' }],
    createSnapshot: async input => { calls.push(['create', input]); input.assertAuthorized(); return { id: 'created', verified: true }; },
    verifySnapshot: async input => { calls.push(['verify', input]); input.assertAuthorized(); return { id: input.id, verified: true }; },
    restoreToNewDirectory: async input => { calls.push(['restore', input]); input.assertAuthorized(); return { destinationDirectory: input.destinationDirectory, automaticActivation: false }; },
  };
  const handle = createBackupController1098({
    trusted: event => { if (!event.trusted) throw Error('Origem não autorizada.'); },
    getContext: () => context, getUserData: () => directory, module,
    openPath: async value => { calls.push(['open', value]); return ''; },
  });
  return { context, module, calls, directory, handle, disposed: () => disposed };
}
const event = { trusted: true };
test('rejects every non-administrator or restricted/demo session before accessing files', async t => {
  const f = fixture(t);
  for (const session of [null, { role: 'viewer' }, { role: 'operator' }, { role: 'supervisor' },
    { role: 'admin', userId: 'a', condos: [] }, { role: 'admin', userId: 'a', condos: ['A'] },
    { role: 'admin', userId: 'a', demo: true }, { role: 'admin', userId: 'a', mode: 'demo' }]) {
    f.context.session = session;
    for (const action of ['status', 'create', 'verify', 'restore', 'open-folder']) {
      assert.equal((await f.handle(event, action)).ok, false);
    }
  }
  assert.equal(f.calls.length, 0);
});
test('rejects untrusted senders and renderer-controlled paths', async t => {
  const f = fixture(t);
  assert.equal((await f.handle({}, 'create')).ok, false);
  for (const [action, input] of [['create', { path: 'C:\\x' }], ['restore', { id: 'fixture-windows', destinationDirectory: f.directory }], ['status', { password: 'x' }], ['delete', {}]]) {
    assert.equal((await f.handle(event, action, input)).ok, false);
  }
  assert.equal(f.calls.length, 0);
});
test('creates protected snapshots and disposes transient protectors', async t => {
  const f = fixture(t);
  assert.equal((await f.handle(event, 'create', { protection: 'windows-user' })).ok, true);
  assert.equal((await f.handle(event, 'create', { protection: 'passphrase', password: 'fixture-password-long' })).ok, true);
  assert.equal(f.calls[1][1].keyProtector.kind, 'passphrase');
  assert.equal(f.disposed(), 2);
  assert.equal((await f.handle(event, 'create', { protection: 'unknown' })).ok, false);
});
test('lists metadata only and chooses protector from stored backup header', async t => {
  const f = fixture(t);
  const status = await f.handle(event, 'status');
  assert.equal(status.value.windowsAvailable, true);
  assert.equal(status.value.portableAvailable, true);
  assert.equal((await f.handle(event, 'verify', { id: 'fixture-portable', password: 'fixture-password-long' })).ok, true);
  assert.equal(f.calls[0][1].keyProtector.kind, 'passphrase');
  assert.equal((await f.handle(event, 'verify', { id: '../outside' })).ok, false);
  assert.equal((await f.handle(event, 'verify', { id: 'fixture-windows', password: 'wrong' })).ok, false);
});
test('serializes operations and rejects epoch changes during asynchronous work', async t => {
  const f = fixture(t);
  let finish;
  f.module.createSnapshot = input => new Promise(resolve => { finish = () => { resolve({ id: 'created' }); }; });
  const pending = f.handle(event, 'create');
  assert.equal((await f.handle(event, 'create')).ok, false);
  f.context.epoch++;
  finish();
  assert.equal((await pending).ok, false);
  assert.equal(f.disposed(), 1);
  f.module.createSnapshot = async () => ({ id: 'retry' });
  assert.equal((await f.handle(event, 'create')).ok, true);
});
test('rejects role downgrade, identity replacement, and logout during awaited list', async t => {
  for (const change of [
    f => { f.context.session.role = 'viewer'; },
    f => { f.context.session.condos = ['A']; },
    f => { f.context.session = { userId: 'fixture-admin', role: 'admin', condos: null }; },
    f => { f.context.session.userId = 'other-user'; },
    f => { f.context.session = null; },
  ]) {
    const f = fixture(t);
    f.module.listSnapshots = async () => { change(f); return [{ id: 'fixture-windows', protection: 'windows-user' }]; };
    assert.equal((await f.handle(event, 'verify', { id: 'fixture-windows' })).ok, false);
    assert.equal(f.calls.length, 0);
  }
});
test('recovery always selects a new directory outside active data and backup folder', async t => {
  const f = fixture(t);
  const a = await f.handle(event, 'restore', { id: 'fixture-windows' });
  const b = await f.handle(event, 'restore', { id: 'fixture-windows' });
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.notEqual(a.value.destinationDirectory, b.value.destinationDirectory);
  assert.equal(path.dirname(a.value.destinationDirectory), path.join(f.directory, 'recuperacoes'));
  assert.equal(a.value.automaticActivation, false);
  assert.equal(fs.existsSync(path.join(f.directory, 'dados')), false);
});
test('module failures release busy state and dispose password material', async t => {
  const f = fixture(t);
  f.module.verifySnapshot = async () => { throw Error('Backup alterado.'); };
  assert.equal((await f.handle(event, 'verify', { id: 'fixture-portable', password: 'fixture-password-long' })).ok, false);
  assert.equal(f.disposed(), 1);
  assert.equal((await f.handle(event, 'create')).ok, true);
});
