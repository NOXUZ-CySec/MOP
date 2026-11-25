'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const backups = require('./backup1098.cjs');
const privacy = require('../src/privacy.js');

const ACTIONS = new Set(['status', 'create', 'verify', 'restore', 'open-folder']);
const INPUTS = {
  status: [], create: ['protection', 'password'], verify: ['id', 'password'],
  restore: ['id', 'password'], 'open-folder': [],
};
function denied() { return Error('Backup integral disponível apenas para administradores com acesso a toda a central.'); }
function changed() { return Error('A sessão mudou. Entre novamente antes de continuar.'); }

// Paths originate in the main process. The renderer sends opaque backup IDs only.
function createBackupController1098({ trusted, getContext, getUserData, safeStorage,
  openPath, module = backups }) {
  let busy = false;
  function capture() {
    const context = getContext();
    const s = context?.session;
    if (!s || s.role !== 'admin' || s.condos != null || s.demo || s.mode === 'demo' ||
        !(s.userId || s.username) || !context.store?.db) throw denied();
    return { ...context, identity: String(s.userId || s.username), session: s };
  }
  function assertSame(token, event) {
    trusted(event);
    const now = capture();
    if (now.session !== token.session || now.epoch !== token.epoch ||
        now.store !== token.store || now.identity !== token.identity) throw changed();
  }
  function validateInput(action, input) {
    if (!ACTIONS.has(action)) throw Error('Ação de backup inválida.');
    if (input == null) return {};
    if (typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(key => !INPUTS[action].includes(key))) {
      throw Error('Parâmetros de backup inválidos.');
    }
    return input;
  }
  function protector(kind, input) {
    if (kind === 'windows-user') {
      if (input.password !== undefined) throw Error('A proteção Windows não utiliza senha de backup.');
      return module.createSafeStorageProtector(safeStorage);
    }
    if (kind === 'passphrase') return module.createPassphraseProtector(input.password);
    throw Error('Tipo de proteção inválido.');
  }
  async function ensurePrivateDirectory(directory) {
    const parent = await fs.lstat(path.dirname(directory));
    if (!parent.isDirectory() || parent.isSymbolicLink()) throw Error('Pasta de backup inválida.');
    await fs.mkdir(directory, { recursive: false, mode: 0o700 }).catch(e => { if (e.code !== 'EEXIST') throw e; });
    const stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error('Pasta de backup inválida.');
  }
  return async function handle(event, action, rawInput) {
    let locked = false;
    let keyProtector;
    try {
      trusted(event);
      const token = capture();
      const input = validateInput(action, rawInput);
      const userData = path.resolve(getUserData());
      const backupDirectory = path.join(userData, 'backups-integral');
      const recoveryDirectory = path.join(userData, 'recuperacoes');
      const assertAuthorized = () => assertSame(token, event);
      if (action === 'status') {
        const snapshots = await module.listSnapshots({ backupDirectory });
        assertAuthorized();
        const windows = module.createSafeStorageProtector(safeStorage);
        let windowsAvailable = false;
        try { windowsAvailable = !!(await windows.available()); }
        catch { windowsAvailable = false; }
        finally { windows.dispose?.(); }
        assertAuthorized();
        return { ok: true, value: { snapshots, busy, windowsAvailable,
          portableAvailable: true, backupDirectory, recoveryDirectory } };
      }
      if (busy) throw Error('Já existe uma operação de backup em andamento. Aguarde.');
      busy = true; locked = true;
      if (action === 'open-folder') {
        await ensurePrivateDirectory(backupDirectory);
        assertAuthorized();
        const error = await openPath(backupDirectory);
        assertAuthorized();
        if (error) throw Error('Não foi possível abrir a pasta de backups.');
        return { ok: true, value: { opened: true, path: backupDirectory } };
      }
      if (action === 'create') {
        keyProtector = protector(input.protection || 'windows-user', input);
        assertAuthorized();
        const value = await module.createSnapshot({ db: token.store.db, backupDirectory,
          appVersion: token.version, keyProtector, assertAuthorized });
        assertAuthorized();
        return { ok: true, value };
      }
      const snapshots = await module.listSnapshots({ backupDirectory });
      assertAuthorized();
      const selected = snapshots.find(item => item.id === input.id);
      if (!selected) throw Error('Backup não encontrado. Atualize a lista.');
      keyProtector = protector(selected.protection, input);
      assertAuthorized();
      if (action === 'verify') {
        const value = await module.verifySnapshot({ backupDirectory, id: selected.id,
          keyProtector, assertAuthorized });
        assertAuthorized();
        return { ok: true, value };
      }
      await ensurePrivateDirectory(recoveryDirectory);
      assertAuthorized();
      const destinationDirectory = path.join(recoveryDirectory,
        'recuperacao-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID());
      const value = await module.restoreToNewDirectory({ backupDirectory, id: selected.id,
        destinationDirectory, keyProtector, assertAuthorized });
      assertAuthorized();
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: privacy.clean(error?.message || 'Não foi possível concluir o backup.') };
    } finally {
      keyProtector?.dispose?.();
      if (locked) busy = false;
    }
  };
}

module.exports = { createBackupController1098 };
