'use strict';
const fs = require('fs');
const path = require('path');
const api = require('mailspring-exports');
const { DarkReader } = require('./reader');
let reader = null;
function activate() {
  if (reader) return;
  const next = new DarkReader(api, AppEnv, fs.readFileSync(path.join(__dirname, 'reader.css'), 'utf8'));
  next.start(); reader = next;
}
function deactivate() { reader?.stop(); reader = null; }
module.exports = { activate, deactivate };
