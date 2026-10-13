'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DarkReader, STYLE_ID, MODE_KEY } = require('../lib/reader');
function setup(mode = 'light') {
  let current = mode;
  const listeners = new Set(), registrations = new Set();
  const config = { get: () => current, set(key, value) { assert.equal(key, MODE_KEY); current = value; for (const fn of listeners) fn(); },
    onDidChange(key, fn) { assert.equal(key, MODE_KEY); listeners.add(fn); return { dispose: () => listeners.delete(fn) }; } };
  const api = { ExtensionRegistry: { MessageView: { register: e => registrations.add(e), unregister: e => registrations.delete(e) } } };
  const reader = new DarkReader(api, { config }, 'html body { filter:none !important }');
  return { reader, config, listeners, registrations, mode: () => current };
}
function document() {
  const nodes = new Map();
  return { documentElement: {}, defaultView: { frameElement: { isConnected: true } },
    getElementById: id => nodes.get(id),
    createElement(tag) { assert.equal(tag, 'style'); return { remove() { nodes.delete(this.id); } }; },
    head: { appendChild(style) { nodes.set(style.id, style); } }, nodes };
}
test('theme activation registers once, selects dark reading and deactivation restores previous mode', () => {
  const { reader, registrations, listeners, mode } = setup();
  reader.start(); reader.start(); assert.equal(registrations.size, 1); assert.equal(mode(), 'dark');
  reader.stop(); reader.stop(); assert.equal(registrations.size, 0); assert.equal(listeners.size, 0); assert.equal(mode(), 'light');
});
test('styles affect only rendered frame DOM, not the stored message or repeated frame copies', () => {
  const { reader } = setup('dark'); reader.start();
  const doc = document(), message = { body: '<p style="color:black">Hello</p>', subject:'Example' };
  const previous = JSON.stringify(message);
  reader.extension.renderedMessageBodyIntoDocument({ document:doc, message });
  reader.extension.renderedMessageBodyIntoDocument({ document:doc, message });
  assert.equal(doc.nodes.size, 1); assert.equal(reader.documents.size, 1); assert.equal(JSON.stringify(message), previous);
  reader.stop(); assert.equal(doc.nodes.size, 0);
});
test('native original-colour toggle removes dark styles; toggling dark re-applies and user choice survives deactivation', () => {
  const { reader, config, mode } = setup(); reader.start(); const doc = document();
  reader.extension.renderedMessageBodyIntoDocument({ document:doc }); assert(doc.getElementById(STYLE_ID));
  config.set(MODE_KEY,'light'); assert(doc.getElementById(STYLE_ID).textContent.includes('background:#ffffff'));
  config.set(MODE_KEY,'dark'); assert(doc.getElementById(STYLE_ID));
  reader.stop(); assert.equal(mode(),'dark'); assert.equal(doc.nodes.size, 0);
});
test('original-colour choice and already-dark preference are retained', () => {
  const first=setup(); first.reader.start(); first.config.set(MODE_KEY,'light'); first.reader.stop(); assert.equal(first.mode(),'light');
  const second=setup('dark'); second.reader.start(); second.reader.stop(); assert.equal(second.mode(),'dark');
});
test('detached documents are pruned; weak references do not retain read email documents', () => {
  const { reader } = setup('dark'); reader.start(); const first=document(), second=document();
  reader.extension.renderedMessageBodyIntoDocument({document:first});
  assert([...reader.documents][0] instanceof WeakRef);
  first.defaultView.frameElement.isConnected=false;
  reader.extension.renderedMessageBodyIntoDocument({document:second}); assert.equal(reader.documents.size,1);
  reader.stop(); assert.equal(second.nodes.size,0);
});
test('failed mode configuration cleans up registration and never installs a document hook', () => {
  const { reader, config, registrations } = setup(); config.set = () => { throw new Error('Settings unavailable'); };
  assert.throws(() => reader.start(), /Settings unavailable/); assert.equal(reader.active,false); assert.equal(registrations.size,0);
});
test('sender inline important colours are reversible and later extension changes are preserved', () => {
  const { reader, config }=setup('dark');reader.start();const doc=document();
  const properties=new Map([['color',['black','important']],['font-size',['10px','important']]]);
  const element={style:{getPropertyPriority:p=>properties.get(p)?.[1]||'',getPropertyValue:p=>properties.get(p)?.[0]||'',
    setProperty(p,v,priority){properties.set(p,[v,priority]);}}};
  doc.querySelectorAll=()=>[element];reader.extension.renderedMessageBodyIntoDocument({document:doc});
  assert.equal(element.style.getPropertyPriority('color'),'');
  element.style.setProperty('font-size','16px','');
  config.set(MODE_KEY,'light');assert.equal(element.style.getPropertyPriority('color'),'important');
  assert.equal(element.style.getPropertyValue('font-size'),'16px');reader.stop();
});
