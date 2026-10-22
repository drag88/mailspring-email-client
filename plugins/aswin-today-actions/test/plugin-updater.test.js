'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { checkForUpdate, installUpdate } = require('../lib/plugin-updater');

const repo = 'https://github.com/drag88/mailspring-email-client';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-update-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const configDir = path.join(root, 'config');
  const packageDir = path.join(configDir, 'packages', 'aswin-today-actions');
  const actionsFile = path.join(configDir, 'today-actions', 'actions.json');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.mkdirSync(path.dirname(actionsFile), { recursive: true });
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: 'aswin-today-actions', version: '0.1.15', main: './lib/main.js', engines: { mailspring: '>=1.26.0 <2.0.0' } }));
  fs.writeFileSync(path.join(packageDir, 'old.js'), 'old');
  fs.writeFileSync(path.join(configDir, 'config.json'), '{"pluginSettings":{"keep":true}}');
  fs.writeFileSync(actionsFile, '{"actions":[{"title":"Keep"}]}');
  return { root, configDir, packageDir, actionsFile };
}
function bundle(version = '0.1.16', files) {
  const payload = files || [
    ['package.json', JSON.stringify({ name: 'aswin-today-actions', version, main: './lib/main.js', engines: { mailspring: '>=1.26.0 <2.0.0' } })],
    ['lib/main.js', 'new main'], ['styles/today-actions.less', 'new styles'], ['extra.js', 'new file']
  ];
  return Buffer.from(JSON.stringify({ name: 'aswin-today-actions', version, files: payload.map(([file, content]) => ({ path: file, sha256: sha(content), content: Buffer.from(content).toString('base64') })) }));
}
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function release(version = '0.1.16', changes = {}) {
  const tag = `v${version}`;
  const bundleName = `aswin-today-actions-update-${version}.json`;
  const bundleUrl = `${repo}/releases/download/${tag}/${bundleName}`;
  const checksumUrl = `${repo}/releases/download/${tag}/SHA256SUMS.txt`;
  const bytes = bundle(version, changes.files);
  const checksum = Buffer.from(`${sha(Buffer.from('plugin zip'))}  plugin.zip\n${sha(bytes)}  ${bundleName}\n${sha(Buffer.from('theme zip'))}  theme.zip\n`);
  return {
    version, bundleName, bundleUrl, checksumUrl, bytes,
    response: { tag_name: tag, html_url: `${repo}/releases/tag/${tag}`, prerelease: false, draft: false,
      assets: [{ name: bundleName, browser_download_url: bundleUrl }, { name: 'SHA256SUMS.txt', browser_download_url: checksumUrl }] },
    download: async url => url === bundleUrl ? bytes : url === checksumUrl ? checksum : Buffer.from('unexpected')
  };
}

test('detects only a newer stable release and returns verified asset locations', async () => {
  const r = release();
  const result = await checkForUpdate('0.1.15', { download: async url => url.includes('/releases/latest') ? Buffer.from(JSON.stringify(r.response)) : r.download(url) });
  assert.deepEqual(result, { version: '0.1.16', bundleUrl: r.bundleUrl, checksumUrl: r.checksumUrl, releaseUrl: r.response.html_url });
  for (const currentVersion of ['0.1.16', '0.1.17']) {
    assert.equal(await checkForUpdate(currentVersion, { download: async () => Buffer.from(JSON.stringify(r.response)) }), null);
  }
  const prerelease = { ...r.response, prerelease: true };
  assert.equal(await checkForUpdate('0.1.15', { download: async () => Buffer.from(JSON.stringify(prerelease)) }), null);
});

test('rejects release metadata outside the pinned repository and release tag', async () => {
  const r = release();
  assert.equal(await checkForUpdate('0.1.15', { download: async () => Buffer.from(JSON.stringify({ ...r.response, tag_name: 'v0.1.16-rc.1' })) }), null);
  for (const response of [
    { ...r.response, html_url: 'https://evil.example/release' },
    { ...r.response, assets: r.response.assets.map(a => ({ ...a, browser_download_url: a.browser_download_url.replace('drag88', 'someone-else') })) },
    { ...r.response, assets: r.response.assets.map(a => ({ ...a, browser_download_url: a.browser_download_url.replace('https://github.com', 'http://github.com') })) },
    { ...r.response, assets: r.response.assets.filter(a => a.name !== 'SHA256SUMS.txt') }
  ]) {
    await assert.rejects(checkForUpdate('0.1.15', { download: async () => Buffer.from(JSON.stringify(response)) }));
  }
});

test('follows GitHub release asset redirects to the trusted CDN', async () => {
  const r = release(), originalGet = https.get, urls = [];
  const body = Buffer.from(JSON.stringify(r.response));
  const replies = [
    { statusCode: 302, headers: { location: `${repo}/releases/latest` } },
    { statusCode: 302, headers: { location: 'https://release-assets.githubusercontent.com/download/release.json?token=fixture' } },
    { statusCode: 200 }
  ];
  https.get = (url, options, callback) => {
    urls.push(url.href);
    const request = new EventEmitter();
    request.destroy = error => request.emit('error', error);
    process.nextTick(() => {
      const response = new EventEmitter(), reply = replies.shift();
      response.statusCode = reply.statusCode; response.headers = reply.headers || {}; response.resume = () => {};
      callback(response);
      if (reply.statusCode === 200) process.nextTick(() => { response.emit('data', body); response.emit('end'); });
    });
    return request;
  };
  try {
    assert.deepEqual(await checkForUpdate('0.1.15'), { version: r.version, bundleUrl: r.bundleUrl, checksumUrl: r.checksumUrl, releaseUrl: r.response.html_url });
    assert.deepEqual(urls.map(url => new URL(url).hostname), ['api.github.com', 'github.com', 'release-assets.githubusercontent.com']);
  } finally { https.get = originalGet; }
});

test('verifies bundle, file hashes and safe unique paths before installing', async t => {
  const f = fixture(t), r = release();
  const update = { version: r.version, bundleUrl: r.bundleUrl, checksumUrl: r.checksumUrl, releaseUrl: r.response.html_url };
  const manifest = JSON.stringify({ name: 'aswin-today-actions', version: '0.1.16', main: './lib/main.js', engines: { mailspring: '>=1.26.0 <2.0.0' } });
  const files = [
    [['package.json', manifest], ['../escape', 'bad'], ['lib/main.js', 'main'], ['styles/today-actions.less', 'less']],
    [['package.json', manifest], ['lib/main.js', 'a'], ['lib/main.js', 'b'], ['styles/today-actions.less', 'less']],
    [['package.json', JSON.stringify({ name: 'aswin-today-actions', version: '0.1.16', main: './lib/main.js', engines: { mailspring: '>=2.0.0' } })], ['lib/main.js', 'new'], ['styles/today-actions.less', 'less']]
  ];
  for (const entries of files) {
    const bytes = bundle('0.1.16', entries);
    const download = async url => url === update.bundleUrl ? bytes : url === update.checksumUrl ? Buffer.from(`${sha(bytes)}  ${r.bundleName}\n`) : null;
    await assert.rejects(installUpdate(update, { ...f, backupDir: path.join(f.root, 'trash'), download }));
    assert.equal(fs.readFileSync(path.join(f.packageDir, 'old.js'), 'utf8'), 'old');
  }
  const tampered = JSON.parse(bundle());
  tampered.files.find(file => file.path === 'lib/main.js').content = Buffer.from('tampered').toString('base64');
  const badFileHash = Buffer.from(JSON.stringify(tampered));
  await assert.rejects(installUpdate(update, { ...f, backupDir: path.join(f.root, 'trash'), download: async url => url === update.bundleUrl ? badFileHash : Buffer.from(`${sha(badFileHash)}  ${r.bundleName}\n`) }));
  const badSum = async url => url === update.bundleUrl ? r.bytes : Buffer.from(`0000  ${r.bundleName}\n`);
  await assert.rejects(installUpdate(update, { ...f, backupDir: path.join(f.root, 'trash'), download: badSum }), /SHA256SUMS/i);
  const duplicateSum = async url => url === update.bundleUrl ? r.bytes : Buffer.from(`${sha(r.bytes)}  ${r.bundleName}\n${sha(r.bytes)}  ${r.bundleName}\n`);
  await assert.rejects(installUpdate(update, { ...f, backupDir: path.join(f.root, 'trash'), download: duplicateSum }), /SHA256SUMS/i);
});

test('refuses to replace a package directory with a different plugin identity', async t => {
  const f = fixture(t), r = release();
  fs.writeFileSync(path.join(f.packageDir, 'package.json'), JSON.stringify({ name: 'another-plugin', version: '0.1.15' }));
  await assert.rejects(installUpdate({ version: r.version, bundleUrl: r.bundleUrl, checksumUrl: r.checksumUrl, releaseUrl: r.response.html_url }, { ...f, backupDir: path.join(f.root, 'trash'), download: r.download }), /expected plugin/i);
  assert.equal(fs.readFileSync(path.join(f.packageDir, 'old.js'), 'utf8'), 'old');
});

test('installs verified files and leaves config and saved actions byte-identical', async t => {
  const f = fixture(t), r = release();
  const before = fs.readFileSync(f.actionsFile), config = fs.readFileSync(path.join(f.configDir, 'config.json'));
  const update = { version: r.version, bundleUrl: r.bundleUrl, checksumUrl: r.checksumUrl, releaseUrl: r.response.html_url };
  const result = await installUpdate(update, { ...f, backupDir: path.join(f.root, 'trash'), download: r.download });
  assert.equal(result.version, '0.1.16');
  assert.ok(fs.existsSync(result.backupPath));
  assert.equal(fs.readFileSync(path.join(f.packageDir, 'lib/main.js'), 'utf8'), 'new main');
  assert.deepEqual(fs.readFileSync(f.actionsFile), before);
  assert.deepEqual(fs.readFileSync(path.join(f.configDir, 'config.json')), config);
  assert.equal(fs.readFileSync(path.join(f.packageDir, 'package.json'), 'utf8').includes('0.1.16'), true);
});

test('a failed swap restores old plugin code and preserves saved actions', async t => {
  const f = fixture(t), r = release(), before = fs.readFileSync(f.actionsFile), config = fs.readFileSync(path.join(f.configDir, 'config.json'));
  const update = { version: r.version, bundleUrl: r.bundleUrl, checksumUrl: r.checksumUrl, releaseUrl: r.response.html_url };
  let failed = false;
  const fsApi = { ...fs, renameSync(from, to) {
    if (!failed && from.includes('staging') && to === f.packageDir) { failed = true; const error = new Error('injected swap failure'); error.code = 'EIO'; throw error; }
    return fs.renameSync(from, to);
  } };
  await assert.rejects(installUpdate(update, { ...f, backupDir: path.join(f.root, 'trash'), download: r.download, fsApi }), /install/i);
  assert.equal(fs.readFileSync(path.join(f.packageDir, 'old.js'), 'utf8'), 'old');
  assert.deepEqual(fs.readFileSync(f.actionsFile), before);
  assert.deepEqual(fs.readFileSync(path.join(f.configDir, 'config.json')), config);
});
