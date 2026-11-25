'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { AppUpdater } = require('electron-updater/out/AppUpdater');
const { createUpdater92 } = require('../desktop/updater92.cjs');

test('preview configuration keeps downgrades disabled with the real AppUpdater channel setter', () => {
  const channel = Object.getOwnPropertyDescriptor(AppUpdater.prototype, 'channel');
  assert.equal(typeof channel?.set, 'function', 'Use the installed dependency setter, not a mock property');
  const updater = new EventEmitter();
  Object.defineProperty(updater, 'channel', channel);
  updater._channel = null;

  // Prove the dependency side effect that caused the regression.
  updater.allowDowngrade = false;
  updater.channel = 'preview';
  assert.equal(updater.allowDowngrade, true);
  updater._channel = null;
  updater.allowDowngrade = false;

  const feeds = [];
  const networkCalls = [];
  updater.setFeedURL = feed => feeds.push(feed);
  for (const action of ['checkForUpdates', 'downloadUpdate', 'quitAndInstall']) {
    updater[action] = () => {
      networkCalls.push(action);
      throw Error('Unexpected updater action during isolated configuration test: ' + action);
    };
  }
  const scheduled = [];
  const timer = kind => (callback, delay) => {
    scheduled.push({ kind, callback, delay });
    return { unref() {} }; // Intentionally inert: no timers, requests or downloads.
  };
  const coordinator = createUpdater92({
    updater, isPackaged: true, getVersion: () => '2.3.0-preview.109.6',
    setDelay: timer('once'), setRepeating: timer('repeat')
  });

  coordinator.configure();
  assert.equal(updater.channel, 'preview');
  assert.equal(updater.allowPrerelease, true);
  assert.equal(updater.allowDowngrade, false, 'Set allowDowngrade after channel because its real setter enables downgrades');
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.deepEqual(feeds, [{ provider: 'github', owner: 'NOXUZ-CySec', repo: 'MOP' }]);
  assert.deepEqual(scheduled.map(({ kind, delay }) => ({ kind, delay })), [
    { kind: 'once', delay: 5000 }, { kind: 'repeat', delay: 6 * 60 * 60 * 1000 }
  ]);
  coordinator.configure();
  assert.equal(feeds.length, 1, 'Repeated configuration must not install duplicate scheduling');
  assert.equal(scheduled.length, 2);
  assert.equal(updater.allowDowngrade, false);
  assert.deepEqual(networkCalls, []);
});
