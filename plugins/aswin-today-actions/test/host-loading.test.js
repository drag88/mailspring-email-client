'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');

test('plugin loads with host-exported React when standalone react is unavailable', () => {
  const filename = path.resolve(__dirname, '../lib/main.js');
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  const host = { React: { Component: class {}, createElement() {} } };
  const requested = [];
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports,
    require(name) {
      requested.push(name);
      if (name === 'react') throw new Error('Cannot find module react');
      if (name === 'mailspring-exports') return host;
      if (name === 'electron') return { shell: {}, ipcRenderer: {} };
      return realRequire(name);
    },
  }, { filename });
  assert.equal(typeof module.exports.activate, 'function');
  assert.equal(typeof module.exports.deactivate, 'function');
  assert(!requested.includes('react'));
});
