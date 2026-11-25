'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { Store } = require('../desktop/store.cjs');
const { SyncStore } = require('../desktop/sync-store.cjs');
const backup = require('../desktop/backup1098.cjs');
const report = [];
const root = path.resolve(__dirname, '..');
function verify(name, fn) {
  test(name, async t => {
    try { await fn(t); report.push({ name, status: 'passed' }); }
    catch (e) { report.push({ name, status: 'failed', code: e.code || 'ASSERTION' }); throw e; }
  });
}
function protector(seed = 'synthetic-user-a') {
  const rootKey = crypto.createHash('sha256').update(seed).digest();
  return {
    kind: 'windows-user',
    available: async () => true,
    protectKey: async key => {
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', rootKey, iv);
      return Buffer.concat([iv, cipher.update(key), cipher.final(), cipher.getAuthTag()]);
    },
    unprotectKey: async data => {
      const decipher = crypto.createDecipheriv('aes-256-gcm', rootKey, data.subarray(0, 12));
      decipher.setAuthTag(data.subarray(data.length - 16));
      return Buffer.concat([decipher.update(data.subarray(12, -16)), decipher.final()]);
    },
  };
}
function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mop1098-backup-'));
  const data = path.join(base, 'source'), backups = path.join(base, 'backups-integral');
  const store = new Store(data), sync = new SyncStore(store);
  sync.bind('https://synthetic.example.test|00000000-0000-4000-8000-000000000001');
  sync.set('cursor', 17);
  sync.set('config', JSON.stringify({ publicMarker: 'config-synthetic@example.test' }));
  const state = store.read();
  for (let id = 1; id <= 3; id++) state.items.push({
    id, protocol: 'MOP-20261125-FIXTURE000' + id, subject: 'Registro sintético ' + id,
    description: 'Preservar email fixture@example.test e conteúdo integral',
    category: 'Ocorrência', status: 'Pendente', condo: 'CEA', created_by: 'Fixture',
    created_at: '2026-11-25T00:00:00Z', updated_at: '2026-11-25T00:00:00Z',
  });
  state.nextItem = 4;
  state.events.push({ id: 1, item_id: 1, actor: 'Fixture', at: '2026-11-25T00:00:00Z', kind: 'Criado', detail: 'Histórico preservado' }); state.nextEvent = 2;
  state.attachments.push({ id: 1, item_id: 1, name: 'sintetico.txt', content: 'CONTEUDO_SINTETICO_APENAS' }); state.nextAttachment = 2;
  state.handovers.push({ id: 1, at: '2026-11-25T00:00:00Z', outgoing: 'Fixture A', incoming: 'Fixture B', note: 'Passagem offline', open_ids: '[1,2]', snapshot: [structuredClone(state.items[0]), structuredClone(state.items[1])] }); state.nextHandover = 2;
  store.write(state);
  // Preserve one in-flight operation, a real conflict and an existing resolution.
  const operation = sync.next();
  const map2 = sync.map('items', 2), map3 = sync.map('items', 3);
  const op2 = { id: map2.remote_id, kind: 'items', op: '22222222-2222-4222-8222-222222222222', base: 0, payload: JSON.parse(map2.payload) };
  sync.acknowledge(op2, { ok: false, record: { id: op2.id, kind: 'items', version: 2, revision: 18, payload: { ...op2.payload, subject: 'Conflito central sintético' } } });
  const op3 = { id: map3.remote_id, kind: 'items', op: '33333333-3333-4333-8333-333333333333', base: 0, payload: JSON.parse(map3.payload) };
  sync.acknowledge(op3, { ok: false, record: { id: op3.id, kind: 'items', version: 2, revision: 19, payload: { ...op3.payload, subject: 'Versão resolvida sintética' } } });
  sync.resolve(op3.id, 'local', 2);
  store.db.exec("CREATE TABLE extra_domain(id INTEGER PRIMARY KEY,value TEXT NOT NULL); CREATE INDEX extra_value ON extra_domain(value); INSERT INTO extra_domain VALUES(1,'DOMINIO_EXTRA_SINTETICO');");
  const keys = protector();
  t.after(() => { try { store.close(); } catch {} fs.rmSync(base, { recursive: true, force: true }); });
  return { base, data, backups, store, sync, operation, keys };
}
function databaseDump(db) {
  const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  const tables = {};
  for (const { name, type } of schema) if (type === 'table') tables[name] = db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '" ORDER BY rowid').all();
  return JSON.parse(JSON.stringify({ schema, tables }));
}
function assertNoWork(base) {
  if (fs.existsSync(base)) assert.deepEqual(fs.readdirSync(base).filter(n => n.startsWith('.create-') || n.startsWith('.verify-')), []);
}
async function create(f) { return backup.createSnapshot({ db: f.store.db, backupDirectory: f.backups, appVersion: '2.3.0-preview.109.8', keyProtector: f.keys }); }

verify('snapshot integral autenticado preserva schema, filas, conflitos, referências e conteúdo não sanitizado', async t => {
  const f = fixture(t), before = databaseDump(f.store.db);
  const result = await create(f);
  assert.equal(result.verified, true); assert.equal(result.integrity, 'ok');
  assert.equal(result.pendingOperations, f.sync.status().pending); assert.equal(result.conflicts, 1);
  assert.equal(result.tableCount, Object.keys(before.tables).length);
  assert.equal(result.scope.externalFilesIncluded, false); assert.equal(result.scope.centralDatabaseIncluded, false);
  const sealed = fs.readFileSync(result.path);
  for (const marker of ['fixture@example.test', 'CONTEUDO_SINTETICO_APENAS', 'DOMINIO_EXTRA_SINTETICO', 'SQLite format 3']) assert.equal(sealed.includes(Buffer.from(marker)), false);
  assert.deepEqual(databaseDump(f.store.db), before);
  assert.equal(f.store.db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
  const destination = path.join(f.base, 'recovered');
  const restored = await backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory: destination, keyProtector: f.keys });
  assert.equal(restored.automaticActivation, false);
  const recovered = new Store(destination);
  try {
    const ledger = new SyncStore(recovered);
    assert.deepEqual(databaseDump(recovered.db), before);
    assert.deepEqual(ledger.next(), f.operation);
    assert.match(recovered.read().items[0].description, /fixture@example\.test/);
    assert.equal(ledger.conflicts()[0].remote.version, 2);
  } finally { recovered.close(); }
  assertNoWork(f.backups);
});
verify('operação em voo restaurada mantém idempotência e confirmação não duplica registros', async t => {
  const f = fixture(t), result = await create(f), destination = path.join(f.base, 'resume');
  await backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory: destination, keyProtector: f.keys });
  const recovered = new Store(destination), ledger = new SyncStore(recovered);
  try {
    const op = ledger.next(), before = ledger.status().pending;
    assert.deepEqual(op, f.operation);
    const receipt = { ok: true, record: { id: op.id, kind: op.kind, version: 1, revision: 20, payload: op.payload } };
    ledger.acknowledge(op, receipt); ledger.acknowledge(op, receipt);
    assert.equal(ledger.status().pending, before - 1);
    assert.equal(recovered.read().items.length, 3);
    assert.equal(ledger.next()?.id === op.id, false);
  } finally { recovered.close(); }
});
verify('verificação confere hash e listagem não declara arquivo como já verificado', async t => {
  const f = fixture(t), result = await create(f);
  const listed = await backup.listSnapshots({ backupDirectory: f.backups });
  assert.equal(listed.length, 1); assert.equal(listed[0].id, result.id); assert.equal(listed[0].verified, false);
  const checked = await backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: f.keys });
  assert.equal(checked.sha256, crypto.createHash('sha256').update(fs.readFileSync(result.path)).digest('hex'));
  assert.equal(checked.databaseBytes, result.databaseBytes);
  assertNoWork(f.backups);
});
verify('cifra alterada é recusada sem criar pasta de recuperação', async t => {
  const f = fixture(t), result = await create(f), data = fs.readFileSync(result.path);
  data[data.length - 33] ^= 1; fs.writeFileSync(result.path, data);
  const destination = path.join(f.base, 'never-created');
  await assert.rejects(backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory: destination, keyProtector: f.keys }), { code: 'BACKUP_INVALID' });
  assert.equal(fs.existsSync(destination), false); assertNoWork(f.backups);
});
verify('tag truncada e cabeçalho adulterado são recusados', async t => {
  const f = fixture(t), result = await create(f), original = fs.readFileSync(result.path);
  fs.writeFileSync(result.path, original.subarray(0, -9));
  await assert.rejects(backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: f.keys }), { code: 'BACKUP_INVALID' });
  const altered = Buffer.from(original);
  const needle = Buffer.from('2.3.0-preview.109.8'), at = altered.indexOf(needle);
  assert.ok(at > 0); altered[at + needle.length - 1] = '9'.charCodeAt(0);
  fs.writeFileSync(result.path, altered);
  await assert.rejects(backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: f.keys }), { code: 'BACKUP_INVALID' });
  assertNoWork(f.backups);
});
verify('chave de outro usuário é recusada sem expor conteúdo', async t => {
  const f = fixture(t), result = await create(f);
  await assert.rejects(backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: protector('synthetic-user-b') }), error => error.code === 'BACKUP_USER' && !error.message.includes('fixture@'));
  assertNoWork(f.backups);
});
verify('criptografia indisponível falha antes de criar snapshot em texto aberto', async t => {
  const f = fixture(t), before = databaseDump(f.store.db);
  const unavailable = { ...f.keys, available: async () => false };
  await assert.rejects(backup.createSnapshot({ db: f.store.db, backupDirectory: f.backups, appVersion: '2.3.0-preview.109.8', keyProtector: unavailable }), { code: 'BACKUP_PROTECTION' });
  assert.equal(fs.existsSync(f.backups), false); assert.deepEqual(databaseDump(f.store.db), before);
});
verify('destinos existentes, inclusive vazios e o perfil de origem, são preservados', async t => {
  const f = fixture(t), result = await create(f), existing = path.join(f.base, 'existing');
  fs.mkdirSync(existing);
  for (const destinationDirectory of [existing, f.data]) await assert.rejects(backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory, keyProtector: f.keys }), { code: 'BACKUP_DESTINATION' });
  fs.writeFileSync(path.join(existing, 'preserve.txt'), 'Preservar');
  await assert.rejects(backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory: existing, keyProtector: f.keys }), { code: 'BACKUP_DESTINATION' });
  assert.equal(fs.readFileSync(path.join(existing, 'preserve.txt'), 'utf8'), 'Preservar');
});
verify('identificadores com travessia e recuperação dentro de backups são recusados', async t => {
  const f = fixture(t), result = await create(f);
  for (const id of ['../' + result.id, '..\\' + result.id, result.path, 'other.mopbackup']) await assert.rejects(backup.verifySnapshot({ backupDirectory: f.backups, id, keyProtector: f.keys }), { code: 'BACKUP_ID' });
  await assert.rejects(backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory: path.join(f.backups, 'nested'), keyProtector: f.keys }), { code: 'BACKUP_PATH' });
  assertNoWork(f.backups);
});
verify('arquivo com hardlink e pasta com junction não são aceitos', async t => {
  const f = fixture(t), result = await create(f), hard = path.join(f.base, 'linked.backup');
  fs.linkSync(result.path, hard);
  await assert.rejects(backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: f.keys }), { code: 'BACKUP_INVALID' });
  assert.equal((await backup.listSnapshots({ backupDirectory: f.backups })).length, 0);
  fs.unlinkSync(hard);
  const junction = path.join(f.base, 'alias');
  fs.symlinkSync(f.backups, junction, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    await assert.rejects(backup.verifySnapshot({ backupDirectory: junction, id: result.id, keyProtector: f.keys }), { code: 'BACKUP_PATH' });
  } finally { fs.unlinkSync(junction); }
  assert.equal((await backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: f.keys })).integrity, 'ok');
});
verify('limite de cabeçalho impede interpretação de tamanho abusivo', async t => {
  const f = fixture(t), result = await create(f), data = fs.readFileSync(result.path);
  data.writeUInt32BE(0xffffffff, 8); fs.writeFileSync(result.path, data);
  await assert.rejects(backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: f.keys }), { code: 'BACKUP_INVALID' });
  assertNoWork(f.backups);
});
verify('transação ativa e duas criações concorrentes não produzem backups sobrepostos', async t => {
  const f = fixture(t);
  f.store.db.exec('BEGIN IMMEDIATE');
  try { await assert.rejects(create(f), { code: 'BACKUP_BUSY' }); } finally { f.store.db.exec('ROLLBACK'); }
  const pending = create(f);
  await assert.rejects(create(f), { code: 'BACKUP_BUSY' });
  const result = await pending;
  assert.equal(result.verified, true); assert.equal((await backup.listSnapshots({ backupDirectory: f.backups })).length, 1);
  assertNoWork(f.backups);
});
verify('arquivo SQLite de outro produto é rejeitado e temporários são removidos', async t => {
  const f = fixture(t), foreign = new DatabaseSync(path.join(f.base, 'foreign.sqlite'));
  try {
    foreign.exec('CREATE TABLE other(id INTEGER PRIMARY KEY); INSERT INTO other VALUES(1);');
    await assert.rejects(backup.createSnapshot({ db: foreign, backupDirectory: f.backups, appVersion: '2.3.0-preview.109.8', keyProtector: f.keys }), { code: 'BACKUP_DATABASE' });
    assert.deepEqual(await backup.listSnapshots({ backupDirectory: f.backups }), []); assertNoWork(f.backups);
  } finally { foreign.close(); }
});
verify('backup portátil recupera todas as tabelas e operação em voo com nova instância da senha', async t => {
  const f = fixture(t), before = databaseDump(f.store.db);
  const passphrase = 'SENHA-SINTETICA-portatil-1098';
  const originalProtector = backup.createPassphraseProtector(passphrase);
  const result = await backup.createSnapshot({ db: f.store.db, backupDirectory: f.backups, appVersion: '2.3.0-preview.109.8', keyProtector: originalProtector });
  originalProtector.dispose();
  assert.equal(await originalProtector.available(), false);
  assert.equal(result.protection, 'passphrase');
  const sealed = fs.readFileSync(result.path);
  assert.equal(sealed.includes(Buffer.from(passphrase)), false);
  assert.equal((await backup.listSnapshots({ backupDirectory: f.backups }))[0].protection, 'passphrase');
  const destination = path.join(f.base, 'portable-recovered');
  const newProtector = backup.createPassphraseProtector(passphrase);
  try {
    const restored = await backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory: destination, keyProtector: newProtector });
    assert.equal(restored.protection, 'passphrase');
    const recovered = new Store(destination);
    try {
      assert.deepEqual(databaseDump(recovered.db), before);
      assert.deepEqual(new SyncStore(recovered).next(), f.operation);
    } finally { recovered.close(); }
    assert.equal(fs.readFileSync(path.join(destination, 'recovery-manifest.json'), 'utf8').includes(passphrase), false);
  } finally { newProtector.dispose(); }
  assert.deepEqual(databaseDump(f.store.db), before); assertNoWork(f.backups);
});
verify('senha portátil incorreta e modo de proteção incompatível são recusados', async t => {
  const f = fixture(t), correct = backup.createPassphraseProtector('SENHA-SINTETICA-correta-1098');
  const wrong = backup.createPassphraseProtector('SENHA-SINTETICA-incorreta-1098');
  try {
    const result = await backup.createSnapshot({ db: f.store.db, backupDirectory: f.backups, appVersion: '2.3.0-preview.109.8', keyProtector: correct });
    const destination = path.join(f.base, 'wrong-password');
    await assert.rejects(backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory: destination, keyProtector: wrong }), { code: 'BACKUP_PASSWORD' });
    await assert.rejects(backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: f.keys }), { code: 'BACKUP_PROTECTION' });
    assert.equal(fs.existsSync(destination), false); assertNoWork(f.backups);
  } finally { correct.dispose(); wrong.dispose(); }
});
verify('senha exige comprimento mínimo, limite de bytes e descarte explícito', async () => {
  for (const input of ['', '12345678901', ' '.repeat(12), 'x'.repeat(1025), 'á'.repeat(513), null]) {
    assert.throws(() => backup.createPassphraseProtector(input), { code: 'BACKUP_PASSWORD' });
  }
  const keys = backup.createPassphraseProtector('SENHA-SINTETICA-descartada');
  keys.dispose();
  assert.equal(await keys.available(), false);
  await assert.rejects(keys.protectKey(Buffer.alloc(32)), { code: 'BACKUP_PROTECTION' });
});
verify('embrulho portátil usa salt e nonce novos e rejeita adulteração da chave', async () => {
  const keys = backup.createPassphraseProtector('SENHA-SINTETICA-aleatoria');
  try {
    const key = crypto.randomBytes(32), a = await keys.protectKey(key), b = await keys.protectKey(key);
    assert.notDeepEqual(a.subarray(4, 20), b.subarray(4, 20));
    assert.notDeepEqual(a.subarray(20, 32), b.subarray(20, 32));
    const recovered = await keys.unprotectKey(a); assert.deepEqual(recovered, key); recovered.fill(0);
    const altered = Buffer.from(a); altered[altered.length - 1] ^= 1;
    await assert.rejects(keys.unprotectKey(altered));
    key.fill(0);
  } finally { keys.dispose(); }
});
verify('sessão revogada durante a criação impede publicação e preserva o banco original', async t => {
  const f = fixture(t), before = databaseDump(f.store.db);
  let authorized = true;
  const assertAuthorized = () => { if (!authorized) throw new Error('Synthetic session revoked'); };
  const keys = { ...f.keys, protectKey: async key => { const result = await f.keys.protectKey(key); authorized = false; return result; } };
  await assert.rejects(backup.createSnapshot({ db: f.store.db, backupDirectory: f.backups, appVersion: '2.3.0-preview.109.8', keyProtector: keys, assertAuthorized }), { code: 'BACKUP_AUTHORIZATION' });
  assert.deepEqual(await backup.listSnapshots({ backupDirectory: f.backups }), []);
  assert.deepEqual(databaseDump(f.store.db), before); assertNoWork(f.backups);
});
verify('sessão revogada durante recuperação remove só os arquivos criados na nova pasta', async t => {
  const f = fixture(t), result = await create(f), destination = path.join(f.base, 'cancelled-recovery');
  const assertAuthorized = () => {
    if (fs.existsSync(path.join(destination, 'mop.sqlite'))) throw new Error('Synthetic session revoked');
  };
  await assert.rejects(backup.restoreToNewDirectory({ backupDirectory: f.backups, id: result.id, destinationDirectory: destination, keyProtector: f.keys, assertAuthorized }), { code: 'BACKUP_AUTHORIZATION' });
  assert.equal(fs.existsSync(destination), false);
  assert.equal((await backup.verifySnapshot({ backupDirectory: f.backups, id: result.id, keyProtector: f.keys })).integrity, 'ok');
  assertNoWork(f.backups);
});


verify('falha ao retirar nome temporário depois da publicação remove somente o novo backup', async t => {
  const f = fixture(t), before = databaseDump(f.store.db), originalUnlink = fs.promises.unlink;
  let simulated = false;
  fs.promises.unlink = async file => {
    if (!simulated && path.basename(file) === 'sealed.tmp') {
      simulated = true; const error = new Error('Synthetic filesystem failure'); error.code = 'EACCES'; throw error;
    }
    return originalUnlink(file);
  };
  try { await assert.rejects(create(f), { code: 'BACKUP_CREATE' }); }
  finally { fs.promises.unlink = originalUnlink; }
  assert.equal(simulated, true); assert.deepEqual(fs.readdirSync(f.backups), []);
  assert.deepEqual(databaseDump(f.store.db), before); assertNoWork(f.backups);
});
verify('objeto que não é DatabaseSync é recusado antes da API nativa', async () => {
  await assert.rejects(backup.createSnapshot({ db: { prepare() {} } }), { code: 'BACKUP_RUNTIME' });
});

after(() => {
  const out = path.join(root, 'test-results/release1098');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'backup-report.json'), JSON.stringify({
    status: report.every(x => x.status === 'passed') ? 'passed' : 'failed',
    checks: report.length, details: report,
    scope: 'Synthetic SQLite Store and SyncStore; no live profile or network; AES test key protector and real scrypt portable protection. Electron safeStorage validation is separate.',
  }, null, 2) + '\n');
});