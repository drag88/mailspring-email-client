'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const session = `mailspring-quotes-test-${process.pid}`;
const run = args => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8' });
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const quotes = read('../lib/quote-history.js').replace('module.exports = { collapseQuoteHistory, restoreQuoteHistory };', '');
const reader = read('../lib/reader.js').replace(/^const .*require\('.+'\);$/gm, '').replace('module.exports = { DarkReader, STYLE_ID, MODE_KEY };', '');
const script = `(async () => { const ORIGINAL_CSS = ''; const repairOriginalColours = () => []; const restoreOriginalColours = () => {};
${quotes}\n${reader}\n${read('quote-history.browser.js')}
return [...await testQuoteHistory(), ...testReaderQuoteHistory(DarkReader)]; })()`;
try {
  run(['open', 'about:blank']);
  const output = execFileSync('agent-browser', ['--session', session, 'eval', '--stdin'], { input: script, encoding: 'utf8' });
  const results = JSON.parse(output);
  if (results.length !== 13) throw new Error(`Expected 13 browser checks, got ${results.length}`);
  process.stdout.write(`${results.length} real-browser quote-history checks passed.\n`);
} finally { run(['close']); }
