'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API = 'https://api.github.com/repos/drag88/mailspring-email-client/releases/latest';
const REPO = 'https://github.com/drag88/mailspring-email-client';
const TRUSTED = new Set(['github.com', 'api.github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com']);
const activeInstalls = new Set();

function checkAbort(signal) { if (signal?.aborted) throw Object.assign(new Error('Update cancelled.'), { name: 'AbortError' }); }
function trustedUrl(value) {
  let url;
  try { url = new URL(value); } catch (_) { throw new Error('The update contains an invalid download URL.'); }
  if (url.protocol !== 'https:' || !TRUSTED.has(url.hostname) || url.username || url.password || url.port) throw new Error('The update download URL is not trusted.');
  return url;
}
function compare(a, b) {
  const parse = value => {
    if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error('Only stable vX.Y.Z plugin versions are supported.');
    return value.split('.').map(Number);
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}
function defaultDownload(value, { signal, maxBytes }) {
  function fetch(url, redirects) {
    return new Promise((resolve, reject) => {
      checkAbort(signal);
      const request = https.get(url, { headers: { 'User-Agent': 'aswin-today-actions-updater', Accept: 'application/vnd.github+json' }, signal, timeout: 15000 }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (!response.headers.location) return reject(new Error('Update download redirect had no destination.'));
        let next;
        try { next = trustedUrl(new URL(response.headers.location, url).href); }
        catch (error) { return reject(error); }
        if (url.hostname === 'api.github.com' || url.hostname === 'github.com') {
          if (next.hostname !== 'github.com' && next.hostname !== 'objects.githubusercontent.com' && next.hostname !== 'release-assets.githubusercontent.com' && next.hostname !== 'github-releases.githubusercontent.com') return reject(new Error('Update download redirected outside GitHub.'));
        }
        if (redirects >= 4) return reject(new Error('Too many update download redirects.'));
        return fetch(next, redirects + 1).then(resolve, reject);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) { response.resume(); return reject(new Error(`Update server returned HTTP ${response.statusCode}.`)); }
      const chunks = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > maxBytes) { request.destroy(new Error('Update download exceeds the allowed size.')); } else chunks.push(chunk); });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
      });
      request.on('timeout', () => request.destroy(new Error('Update download timed out.')));
      request.on('error', reject);
    });
  }
  return fetch(trustedUrl(value), 0);
}
function downloader(options) { return options.download || defaultDownload; }
function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function releasePaths(version) {
  const tag = `v${version}`;
  return { bundle: `${REPO}/releases/download/${tag}/aswin-today-actions-update-${version}.json`, sums: `${REPO}/releases/download/${tag}/SHA256SUMS.txt`, page: `${REPO}/releases/tag/${tag}` };
}
async function checkForUpdate(currentVersion, options = {}) {
  const download = downloader(options); checkAbort(options.signal);
  const data = await download(API, { signal: options.signal, maxBytes: 1024 * 1024 });
  let release;
  try { release = JSON.parse(data.toString('utf8')); } catch (_) { throw new Error('GitHub returned invalid release metadata.'); }
  const match = typeof release.tag_name === 'string' && /^v\d+\.\d+\.\d+$/.exec(release.tag_name);
  if (!match || release.draft || release.prerelease) return null;
  const version = release.tag_name.slice(1);
  if (compare(version, currentVersion) <= 0) return null;
  const paths = releasePaths(version);
  if (release.html_url !== paths.page || !Array.isArray(release.assets)) throw new Error('Release metadata does not match the plugin repository and tag.');
  const bundle = release.assets.filter(a => a.name === `aswin-today-actions-update-${version}.json`);
  const sums = release.assets.filter(a => a.name === 'SHA256SUMS.txt');
  if (bundle.length !== 1 || sums.length !== 1 || bundle[0].browser_download_url !== paths.bundle || sums[0].browser_download_url !== paths.sums) throw new Error('This release is missing its required update bundle or checksum file. Install the update manually from the release page.');
  trustedUrl(paths.bundle); trustedUrl(paths.sums);
  return { version, bundleUrl: paths.bundle, checksumUrl: paths.sums, releaseUrl: paths.page };
}
function safeFiles(bundle, version, installed) {
  if (bundle.name !== 'aswin-today-actions' || bundle.version !== version || !Array.isArray(bundle.files) || bundle.files.length < 3 || bundle.files.length > 200) throw new Error('The update bundle metadata is invalid.');
  const seen = new Set(); let total = 0; const files = [];
  for (const file of bundle.files) {
    if (!file || typeof file.path !== 'string' || file.path.includes('\\') || file.path.startsWith('/') || /^[A-Za-z]:/.test(file.path) || path.posix.normalize(file.path) !== file.path || file.path.split('/').some(part => !part || part === '.' || part === '..') || seen.has(file.path)) throw new Error('The update bundle contains an unsafe or duplicate path.');
    seen.add(file.path);
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.content !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content)) throw new Error('The update bundle contains invalid file data.');
    const bytes = Buffer.from(file.content, 'base64'); total += bytes.length;
    if (bytes.toString('base64') !== file.content || bytes.length > 4 * 1024 * 1024 || total > 16 * 1024 * 1024 || digest(bytes) !== file.sha256) throw new Error('An update file failed its SHA-256 check or exceeds the size limit.');
    files.push([file.path, bytes]);
  }
  const manifestFile = files.find(([name]) => name === 'package.json');
  let manifest;
  try { manifest = JSON.parse(manifestFile[1].toString('utf8')); } catch (_) { throw new Error('The update package manifest is invalid.'); }
  if (manifest.name !== 'aswin-today-actions' || manifest.version !== version || manifest.main !== './lib/main.js' || !seen.has('lib/main.js') || !seen.has('styles/today-actions.less')) throw new Error('The update package is incomplete or has the wrong identity.');
  if (manifest.engines?.mailspring !== installed.engines?.mailspring) throw new Error('This update requires a different Mailspring version range and cannot be installed automatically.');
  return files;
}
async function installUpdate(update, options = {}) {
  const io = options.fsApi || fs, configDir = path.resolve(options.configDir || ''), packageDir = path.resolve(options.packageDir || ''), expected = path.join(configDir, 'packages', 'aswin-today-actions');
  if (packageDir !== expected || !options.backupDir) throw new Error('The plugin install paths are invalid.');
  const key = packageDir;
  if (activeInstalls.has(key)) throw new Error('A plugin update is already running.');
  activeInstalls.add(key);
  let stage;
  try {
    checkAbort(options.signal);
    trustedUrl(update.bundleUrl); trustedUrl(update.checksumUrl);
    const paths = releasePaths(update.version);
    if (update.bundleUrl !== paths.bundle || update.checksumUrl !== paths.sums || update.releaseUrl !== paths.page) throw new Error('The update metadata does not match its version.');
    const current = JSON.parse(io.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    if (current.name !== 'aswin-today-actions') throw new Error('The install directory does not contain the expected plugin.');
    if (compare(update.version, current.version) <= 0) throw new Error('The update is not newer than the installed plugin.');
    for (const p of [configDir, path.dirname(packageDir), packageDir]) if (io.lstatSync(p).isSymbolicLink()) throw new Error('The plugin install path cannot be a symbolic link.');
    const download = downloader(options), [bytes, sums] = await Promise.all([
      download(update.bundleUrl, { signal: options.signal, maxBytes: 8 * 1024 * 1024 }),
      download(update.checksumUrl, { signal: options.signal, maxBytes: 64 * 1024 })
    ]);
    checkAbort(options.signal);
    const name = `aswin-today-actions-update-${update.version}.json`;
    const entries = sums.toString('utf8').trimEnd().split(/\r?\n/).map(line => /^([a-f0-9]{64})[ \t]+[*]?(.+)$/.exec(line));
    const matching = entries.filter(entry => entry?.[2] === name);
    if (!entries.length || entries.some(entry => !entry) || matching.length !== 1 || matching[0][1] !== digest(bytes)) throw new Error('The update bundle failed its SHA256SUMS checksum.');
    let bundle;
    try { bundle = JSON.parse(bytes.toString('utf8')); } catch (_) { throw new Error('The update bundle is not valid JSON.'); }
    const files = safeFiles(bundle, update.version, current);
    const dataDir = path.join(configDir, 'today-actions');
    if (io.existsSync(dataDir) && io.lstatSync(dataDir).isSymbolicLink()) throw new Error('The update staging path cannot be a symbolic link.');
    io.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    stage = path.join(dataDir, `.plugin-updater-staging-${crypto.randomUUID()}`);
    io.mkdirSync(stage, { mode: 0o700 });
    for (const [name, content] of files) {
      const target = path.join(stage, ...name.split('/'));
      io.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      io.writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
    }
    checkAbort(options.signal);
    io.mkdirSync(options.backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(options.backupDir, `aswin-today-actions-${current.version}-${crypto.randomUUID()}`);
    io.renameSync(packageDir, backupPath);
    try { io.renameSync(stage, packageDir); stage = null; }
    catch (error) {
      try { io.renameSync(backupPath, packageDir); }
      catch (rollback) { throw new Error(`Plugin update failed and rollback failed; old plugin is at ${backupPath}. ${rollback.message}`); }
      throw new Error(`Could not install the update; the previous plugin was restored. ${error.message}`);
    }
    return { version: update.version, backupPath };
  } finally {
    if (stage) { try { io.rmSync(stage, { recursive: true, force: true }); } catch (_) {} }
    activeInstalls.delete(key);
  }
}
module.exports = { checkForUpdate, installUpdate };
