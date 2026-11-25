'use strict';

// Integral SQLite snapshots. Public results never contain credentials, rows or unwrapped keys.
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const sqlite = require('node:sqlite');
const { validate } = require('./store.cjs');

const MAGIC = Buffer.from('MOPBKP1\0', 'ascii');
const HEADER_LIMIT = 16 * 1024;
const MANIFEST_LIMIT = 64 * 1024;
const DATABASE_LIMIT = 512 * 1024 * 1024;
const FILE_LIMIT = DATABASE_LIMIT + HEADER_LIMIT + MANIFEST_LIMIT + 128;
const ID_PATTERN = /^mop-full-\d{8}T\d{6}Z-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.mopbackup$/;
const active = new WeakSet();
const PROTECTION_KINDS = new Set(['windows-user', 'passphrase']);
const PASSWORD_MAGIC = Buffer.from('MPK1', 'ascii');
const SCRYPT_OPTIONS = Object.freeze({ N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
const scope = Object.freeze({
  sqliteMain: 'all tables',
  externalFilesIncluded: false,
  centralDatabaseIncluded: false,
  windowsProfileCredentialsIncluded: false,
});
function failure(code, message) { const e = new Error(message); e.code = code; return e; }
function invalid() { return failure('BACKUP_INVALID', 'Backup inválido, incompleto ou alterado.'); }
function checkAuthorization(assertAuthorized) {
  if (assertAuthorized === undefined) return;
  try {
    if (typeof assertAuthorized !== 'function') throw new Error();
    assertAuthorized();
  } catch { throw failure('BACKUP_AUTHORIZATION', 'Sua sessão mudou. Entre novamente antes de continuar esta operação.'); }
}
function isInside(candidate, parent) {
  const rel = path.relative(parent, candidate);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
function absolute(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) throw failure('BACKUP_PATH', 'Caminho de recuperação inválido.');
  return path.resolve(value);
}
async function noLinks(target) {
  const resolved = absolute(target), root = path.parse(resolved).root;
  let current = root;
  for (const component of path.relative(root, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = await fsp.lstat(current);
    if (stat.isSymbolicLink()) throw failure('BACKUP_PATH', 'Links e redirecionamentos de pasta não são aceitos.');
  }
  return resolved;
}
async function directory(value, create = false) {
  const resolved = absolute(value);
  if (create) {
    const parent = await noLinks(path.dirname(resolved));
    if (!(await fsp.stat(parent)).isDirectory()) throw failure('BACKUP_PATH', 'Pasta de destino inválida.');
    try { await fsp.mkdir(resolved, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  await noLinks(resolved);
  if (!(await fsp.lstat(resolved)).isDirectory()) throw failure('BACKUP_PATH', 'Pasta de destino inválida.');
  return resolved;
}
function backupPath(base, id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw failure('BACKUP_ID', 'Identificador de backup inválido.');
  return path.join(base, id);
}
async function regularFile(file, limit = FILE_LIMIT) {
  await noLinks(path.dirname(file));
  const stat = await fsp.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > limit) throw invalid();
  return stat;
}
async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function flush(file) {
  const handle = await fsp.open(file, 'r+');
  try { await handle.sync(); } finally { await handle.close(); }
}
async function exactRead(handle, length, position) {
  const data = Buffer.alloc(length);
  const result = await handle.read(data, 0, length, position);
  if (result.bytesRead !== length) throw invalid();
  return data;
}
function decode64(value, expectedLength, maxLength) {
  if (typeof value !== 'string' || value.length > maxLength || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw invalid();
  const data = Buffer.from(value, 'base64');
  if (data.toString('base64') !== value || (expectedLength && data.length !== expectedLength)) throw invalid();
  return data;
}
async function requireProtector(protector) {
  if (!protector || !PROTECTION_KINDS.has(protector.kind) || typeof protector.available !== 'function' || typeof protector.protectKey !== 'function' || typeof protector.unprotectKey !== 'function') {
    throw failure('BACKUP_PROTECTION', 'Proteção criptográfica de backup indisponível.');
  }
  let available = false;
  try { available = await protector.available(); } catch {}
  if (!available) throw failure('BACKUP_PROTECTION', 'A proteção criptográfica selecionada está indisponível. Nenhum backup em texto aberto foi criado.');
}
function keyFailure(kind) {
  return kind === 'passphrase'
    ? failure('BACKUP_PASSWORD', 'Senha incorreta ou chave do backup portátil inválida.')
    : failure('BACKUP_USER', 'Não foi possível abrir a chave. Use o mesmo usuário e perfil do Windows que criou este backup.');
}
function createPassphraseProtector(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length > 1024 || Array.from(passphrase).length < 12 ||
      Buffer.byteLength(passphrase, 'utf8') > 1024 || !/\S/u.test(passphrase)) {
    throw failure('BACKUP_PASSWORD', 'Use uma senha de pelo menos 12 caracteres e no máximo 1024 bytes.');
  }
  const secret = Buffer.from(passphrase, 'utf8');
  let disposed = false;
  async function derive(salt) {
    if (disposed) throw failure('BACKUP_PROTECTION', 'A senha desta operação já foi descartada.');
    const input = Buffer.from(secret);
    try {
      return await new Promise((resolve, reject) => {
        crypto.scrypt(input, salt, 32, SCRYPT_OPTIONS, (error, key) => error ? reject(error) : resolve(key));
      });
    } finally { input.fill(0); }
  }
  return {
    kind: 'passphrase',
    available: async () => !disposed,
    dispose() { secret.fill(0); disposed = true; },
    async protectKey(key) {
      if (!Buffer.isBuffer(key) || key.length !== 32) throw invalid();
      const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
      const prefix = Buffer.concat([PASSWORD_MAGIC, salt, iv]);
      const wrappingKey = await derive(salt);
      try {
        const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);
        cipher.setAAD(prefix);
        return Buffer.concat([prefix, cipher.update(key), cipher.final(), cipher.getAuthTag()]);
      } finally { wrappingKey.fill(0); }
    },
    async unprotectKey(wrapped) {
      if (!Buffer.isBuffer(wrapped) || wrapped.length !== 80 || !wrapped.subarray(0, 4).equals(PASSWORD_MAGIC)) throw invalid();
      const wrappingKey = await derive(wrapped.subarray(4, 20));
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, wrapped.subarray(20, 32));
        decipher.setAAD(wrapped.subarray(0, 32));
        decipher.setAuthTag(wrapped.subarray(64, 80));
        return Buffer.concat([decipher.update(wrapped.subarray(32, 64)), decipher.final()]);
      } finally { wrappingKey.fill(0); }
    },
  };
}
function createSafeStorageProtector(safeStorage) {
  if (process.platform !== 'win32') throw failure('BACKUP_PROTECTION', 'Esta proteção de backup requer Windows.');
  const hasAsync = typeof safeStorage?.isAsyncEncryptionAvailable === 'function' &&
    typeof safeStorage?.encryptStringAsync === 'function' && typeof safeStorage?.decryptStringAsync === 'function';
  return {
    kind: 'windows-user',
    async available() {
      return hasAsync ? !!(await safeStorage.isAsyncEncryptionAvailable()) : !!safeStorage?.isEncryptionAvailable?.();
    },
    async protectKey(key) {
      const text = 'mop-backup-key-v1:' + key.toString('base64');
      const wrapped = hasAsync ? await safeStorage.encryptStringAsync(text) : safeStorage.encryptString(text);
      if (!Buffer.isBuffer(wrapped) || wrapped.length < 16 || wrapped.length > 8192) throw invalid();
      return wrapped;
    },
    async unprotectKey(wrapped) {
      const value = hasAsync ? await safeStorage.decryptStringAsync(wrapped) : safeStorage.decryptString(wrapped);
      const text = typeof value === 'string' ? value : value?.result;
      if (typeof text !== 'string' || !text.startsWith('mop-backup-key-v1:')) throw invalid();
      return decode64(text.slice('mop-backup-key-v1:'.length), 32, 64);
    },
  };
}
async function databaseInfo(file) {
  const stat = await regularFile(file, DATABASE_LIMIT);
  let db;
  try {
    db = new sqlite.DatabaseSync(file, { readOnly: true });
    db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=2000;');
    if (db.prepare('PRAGMA journal_mode').get().journal_mode !== 'delete') throw invalid();
    const checks = db.prepare('PRAGMA integrity_check').all();
    if (checks.length !== 1 || checks[0].integrity_check !== 'ok') throw invalid();
    const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    const tableNames = schema.filter(row => row.type === 'table').map(row => row.name);
    if (!tableNames.includes('state') || tableNames.length > 1000) throw invalid();
    const columns = db.prepare('PRAGMA table_info(state)').all().map(row => row.name);
    if (!['id', 'payload', 'updated_at'].every(name => columns.includes(name))) throw invalid();
    const stateRows = db.prepare('SELECT id,payload FROM state').all();
    if (stateRows.length !== 1 || stateRows[0].id !== 1 || typeof stateRows[0].payload !== 'string') throw invalid();
    validate(JSON.parse(stateRows[0].payload));
    const tables = tableNames.sort().map(name => {
      const escaped = '"' + name.replaceAll('"', '""') + '"';
      return { name, rows: Number(db.prepare('SELECT count(*) AS count FROM ' + escaped).get().count) };
    });
    const count = name => tables.find(t => t.name === name)?.rows || 0;
    return {
      bytes: stat.size,
      sha256: await hashFile(file),
      schemaSHA256: crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex'),
      sqliteVersion: db.prepare('SELECT sqlite_version() AS version').get().version,
      userVersion: db.prepare('PRAGMA user_version').get().user_version,
      tables,
      pendingOperations: count('sync_pending'),
      conflicts: count('sync_conflicts'),
    };
  } catch {
    throw failure('BACKUP_DATABASE', 'O arquivo não contém um banco MOP íntegro e compatível.');
  } finally { db?.close(); }
}
async function readEnvelope(file, id) {
  const stat = await regularFile(file);
  if (stat.size < MAGIC.length + 4 + 32) throw invalid();
  const handle = await fsp.open(file, 'r');
  try {
    const opened = await handle.stat();
    if (opened.ino !== stat.ino || opened.nlink !== 1 || opened.size !== stat.size) throw invalid();
    const prefix = await exactRead(handle, MAGIC.length + 4, 0);
    if (!prefix.subarray(0, MAGIC.length).equals(MAGIC)) throw invalid();
    const length = prefix.readUInt32BE(MAGIC.length);
    if (length < 2 || length > HEADER_LIMIT || MAGIC.length + 4 + length + 16 >= stat.size) throw invalid();
    const bytes = await exactRead(handle, length, MAGIC.length + 4);
    let header;
    try { header = JSON.parse(bytes.toString('utf8')); } catch { throw invalid(); }
    if (header?.format !== 'MOP-SQLITE-BACKUP' || header.version !== 1 || header.id !== id ||
        header.algorithm !== 'aes-256-gcm' || !PROTECTION_KINDS.has(header.protection) ||
        typeof header.createdAt !== 'string' || !Number.isFinite(Date.parse(header.createdAt)) ||
        typeof header.appVersion !== 'string' || !/^[A-Za-z0-9.+-]{1,80}$/.test(header.appVersion)) throw invalid();
    return {
      header, bytes, stat,
      iv: decode64(header.iv, 12, 32),
      wrappedKey: decode64(header.wrappedKey, null, 12000),
      tag: await exactRead(handle, 16, stat.size - 16),
      start: MAGIC.length + 4 + length,
      end: stat.size - 17,
    };
  } finally { await handle.close(); }
}
async function decryptAndCheck({ backupDirectory, id, keyProtector, assertAuthorized }, use) {
  checkAuthorization(assertAuthorized);
  await requireProtector(keyProtector);
  const base = await directory(backupDirectory);
  const file = backupPath(base, id);
  const envelope = await readEnvelope(file, id);
  if (envelope.header.protection !== keyProtector.kind) {
    throw failure('BACKUP_PROTECTION', envelope.header.protection === 'passphrase'
      ? 'Este backup requer a senha portátil informada na criação.'
      : 'Este backup requer o mesmo usuário e perfil do Windows usado na criação.');
  }
  const work = await fsp.mkdtemp(path.join(base, '.verify-'));
  const payload = path.join(work, 'payload.bin'), snapshot = path.join(work, 'mop.sqlite');
  let key;
  try {
    try { key = await keyProtector.unprotectKey(envelope.wrappedKey); }
    catch { throw keyFailure(envelope.header.protection); }
    if (!Buffer.isBuffer(key) || key.length !== 32) throw keyFailure(envelope.header.protection);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, envelope.iv);
    decipher.setAAD(envelope.bytes);
    decipher.setAuthTag(envelope.tag);
    try {
      await pipeline(fs.createReadStream(file, { start: envelope.start, end: envelope.end }), decipher, fs.createWriteStream(payload, { flags: 'wx', mode: 0o600 }));
    } catch { throw invalid(); }
    // The temporary plaintext is never opened as SQLite before GCM authentication succeeds.
    const handle = await fsp.open(payload, 'r');
    let manifest, offset;
    try {
      const size = (await handle.stat()).size;
      const length = (await exactRead(handle, 4, 0)).readUInt32BE(0);
      if (length < 2 || length > MANIFEST_LIMIT || length + 4 >= size) throw invalid();
      try { manifest = JSON.parse((await exactRead(handle, length, 4)).toString('utf8')); } catch { throw invalid(); }
      offset = 4 + length;
      if (manifest?.version !== 1 || manifest.id !== id || manifest.createdAt !== envelope.header.createdAt ||
          manifest.appVersion !== envelope.header.appVersion || !Number.isSafeInteger(manifest.database?.bytes) ||
          manifest.database.bytes < 512 || manifest.database.bytes > DATABASE_LIMIT ||
          manifest.database.bytes !== size - offset || !/^[a-f0-9]{64}$/.test(manifest.database.sha256) ||
          !/^[a-f0-9]{64}$/.test(manifest.database.schemaSHA256)) throw invalid();
    } finally { await handle.close(); }
    await pipeline(fs.createReadStream(payload, { start: offset }), fs.createWriteStream(snapshot, { flags: 'wx', mode: 0o600 }));
    const info = await databaseInfo(snapshot);
    if (info.sha256 !== manifest.database.sha256 || info.schemaSHA256 !== manifest.database.schemaSHA256 ||
        JSON.stringify(info.tables) !== JSON.stringify(manifest.database.tables)) throw invalid();
    const summary = {
      id, path: file, createdAt: manifest.createdAt, appVersion: manifest.appVersion,
      bytes: envelope.stat.size, sha256: await hashFile(file), databaseBytes: info.bytes,
      tableCount: info.tables.length, pendingOperations: info.pendingOperations, conflicts: info.conflicts,
      integrity: 'ok', verified: true, protection: envelope.header.protection, scope: { ...scope },
    };
    checkAuthorization(assertAuthorized);
    return use ? await use(snapshot, summary) : summary;
  } finally {
    key?.fill?.(0);
    await fsp.rm(work, { recursive: true, force: true });
  }
}
async function createSnapshot({ db, backupDirectory, appVersion, keyProtector, assertAuthorized }) {
  checkAuthorization(assertAuthorized);
  if (!(db instanceof sqlite.DatabaseSync) || typeof sqlite.backup !== 'function') throw failure('BACKUP_RUNTIME', 'O runtime não oferece backup SQLite compatível.');
  if (active.has(db) || db.isTransaction) throw failure('BACKUP_BUSY', 'Aguarde a operação de banco atual antes de criar outro backup.');
  if (typeof appVersion !== 'string' || !/^[A-Za-z0-9.+-]{1,80}$/.test(appVersion)) throw invalid();
  active.add(db);
  let work, published, key;
  try {
    await requireProtector(keyProtector);
    const base = await directory(backupDirectory, true);
    work = await fsp.mkdtemp(path.join(base, '.create-'));
    const snapshot = path.join(work, 'mop.sqlite');
    // Node 26.7 may leave backup's fulfilled promise pending until another event.
    // A scoped timer drains completion microtasks; Node upstream fixed this in #65666.
    const completionTick = setInterval(() => {}, 25);
    try { await sqlite.backup(db, snapshot, { rate: 128 }); }
    finally { clearInterval(completionTick); }
    // Only the private copy is normalized; the live connection and its WAL are untouched.
    const standalone = new sqlite.DatabaseSync(snapshot);
    try {
      if (standalone.prepare('PRAGMA journal_mode=DELETE').get().journal_mode !== 'delete') throw invalid();
    } finally { standalone.close(); }
    const database = await databaseInfo(snapshot);
    const createdAt = new Date().toISOString();
    const stamp = createdAt.replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
    const id = 'mop-full-' + stamp + '-' + crypto.randomUUID() + '.mopbackup';
    const manifest = Buffer.from(JSON.stringify({ version: 1, id, createdAt, appVersion, database, scope }), 'utf8');
    if (manifest.length > MANIFEST_LIMIT) throw invalid();
    const manifestPrefix = Buffer.alloc(4); manifestPrefix.writeUInt32BE(manifest.length);
    key = crypto.randomBytes(32);
    let wrappedKey;
    try { wrappedKey = await keyProtector.protectKey(key); }
    catch { throw failure('BACKUP_PROTECTION', 'Não foi possível proteger a chave com o método de backup selecionado.'); }
    if (!Buffer.isBuffer(wrappedKey) || wrappedKey.length < 16 || wrappedKey.length > 8192) throw invalid();
    const iv = crypto.randomBytes(12);
    const header = Buffer.from(JSON.stringify({ format: 'MOP-SQLITE-BACKUP', version: 1, id, createdAt, appVersion,
      algorithm: 'aes-256-gcm', protection: keyProtector.kind, wrappedKey: wrappedKey.toString('base64'), iv: iv.toString('base64') }), 'utf8');
    const prefix = Buffer.alloc(MAGIC.length + 4); MAGIC.copy(prefix); prefix.writeUInt32BE(header.length, MAGIC.length);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(header);
    const temporary = path.join(work, 'sealed.tmp');
    await fsp.writeFile(temporary, Buffer.concat([prefix, header]), { flag: 'wx', mode: 0o600 });
    async function* plaintext() {
      yield manifestPrefix; yield manifest;
      for await (const chunk of fs.createReadStream(snapshot)) yield chunk;
    }
    await pipeline(Readable.from(plaintext()), cipher, fs.createWriteStream(temporary, { flags: 'a' }));
    await fsp.appendFile(temporary, cipher.getAuthTag());
    await flush(temporary);
    await regularFile(temporary);
    const final = backupPath(base, id);
    // link() publishes atomically without replacing any existing backup.
    checkAuthorization(assertAuthorized);
    await fsp.link(temporary, final);
    published = final;
    await fsp.unlink(temporary);
    const verified = await verifySnapshot({ backupDirectory: base, id, keyProtector, assertAuthorized });
    checkAuthorization(assertAuthorized);
    published = null;
    return verified;
  } catch (error) {
    if (published) await fsp.unlink(published).catch(() => {});
    if (error?.code?.startsWith?.('BACKUP_')) throw error;
    throw failure('BACKUP_CREATE', 'Não foi possível concluir o backup integral. Os dados de origem foram preservados.');
  } finally {
    key?.fill?.(0);
    if (work) await fsp.rm(work, { recursive: true, force: true });
    active.delete(db);
  }
}
async function listSnapshots({ backupDirectory }) {
  let base;
  try { base = await directory(backupDirectory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const result = [];
  for (const id of await fsp.readdir(base)) {
    if (!ID_PATTERN.test(id)) continue;
    try {
      const file = backupPath(base, id), { stat, header } = await readEnvelope(file, id);
      result.push({ id, path: file, bytes: stat.size, modifiedAt: stat.mtime.toISOString(),
        createdAt: header.createdAt, appVersion: header.appVersion, verified: false, protection: header.protection });
    } catch { /* Invalid links and oversized files are not offered for recovery. */ }
  }
  return result.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 200);
}
async function verifySnapshot(options) { return decryptAndCheck(options); }
async function restoreToNewDirectory({ backupDirectory, id, destinationDirectory, keyProtector, assertAuthorized }) {
  checkAuthorization(assertAuthorized);
  const base = await directory(backupDirectory), destination = absolute(destinationDirectory);
  const parent = await directory(path.dirname(destination));
  if (isInside(destination, base) || isInside(base, destination) || !isInside(destination, parent)) throw failure('BACKUP_PATH', 'Escolha uma nova pasta fora da pasta de backups.');
  try { await fsp.lstat(destination); throw failure('BACKUP_DESTINATION', 'A pasta de recuperação já existe. Nenhum arquivo foi substituído.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let created = false;
  const owned = [];
  try {
    return await decryptAndCheck({ backupDirectory: base, id, keyProtector, assertAuthorized }, async (snapshot, summary) => {
      await noLinks(parent);
      checkAuthorization(assertAuthorized);
      await fsp.mkdir(destination, { mode: 0o700 });
      created = true;
      const databasePath = path.join(destination, 'mop.sqlite');
      const databaseHandle = await fsp.open(databasePath, 'wx', 0o600);
      owned.push(databasePath);
      try {
        for await (const chunk of fs.createReadStream(snapshot)) {
          let offset = 0;
          while (offset < chunk.length) {
            const written = await databaseHandle.write(chunk, offset, chunk.length - offset);
            if (!written.bytesWritten) throw invalid();
            offset += written.bytesWritten;
          }
        }
        await databaseHandle.sync();
      } finally { await databaseHandle.close(); }
      const restored = await databaseInfo(databasePath);
      if (restored.sha256 !== await hashFile(snapshot)) throw invalid();
      const receiptPath = path.join(destination, 'recovery-manifest.json');
      checkAuthorization(assertAuthorized);
      const receiptHandle = await fsp.open(receiptPath, 'wx', 0o600);
      owned.push(receiptPath);
      try {
        await receiptHandle.writeFile(JSON.stringify({ ...summary, path: undefined, restoredAt: new Date().toISOString(), automaticActivation: false }, null, 2) + '\n');
        await receiptHandle.sync();
      } finally { await receiptHandle.close(); }
      checkAuthorization(assertAuthorized);
      return { ...summary, destinationDirectory: destination, databasePath, automaticActivation: false };
    });
  } catch (error) {
    if (created) {
      for (const file of owned.reverse()) await fsp.unlink(file).catch(() => {});
      await fsp.rmdir(destination).catch(() => {});
    }
    if (error?.code?.startsWith?.('BACKUP_')) throw error;
    throw failure('BACKUP_RESTORE', 'A recuperação não foi concluída. O perfil ativo não foi alterado.');
  }
}
module.exports = { createSafeStorageProtector, createPassphraseProtector, createSnapshot, listSnapshots, verifySnapshot, restoreToNewDirectory };