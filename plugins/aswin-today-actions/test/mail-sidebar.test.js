'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), vm = require('vm'), path = require('path');
const { decorateLabels, labelColor } = require('../lib/mail-sidebar');
test('rail decoration preserves label actions, selection and nested state without mutating native items', () => {
  const onSelect = () => {}, perspective = { category: () => ({ displayName: 'Parent/Child' }) };
  const items = [{ id: 'parent', name: 'Parent', onSelect, selected: true, collapsed: false,
    children: [{ id: 'child', name: 'Child', children: [], perspective }] }];
  const result = decorateLabels(items, 'tag.png');
  assert.equal(result[0].onSelect, onSelect); assert(result[0].selected); assert.equal(result[0].collapsed, false);
  assert.equal(result[0].children[0].perspective, perspective);
  assert.equal(result[0].children[0].taaTitle, 'Parent/Child'); assert.equal(result[0].iconName, 'tag.png');
  assert.equal(result[0].taaColor, labelColor('parent')); assert.equal(items[0].className, undefined);
});
test('collapse, restart and cleanup preserve expanded width and native component registrations', () => {
  const React = { Component: class { constructor(props) { this.props = props; } }, createElement: (type, props) => ({ type, props }),
    cloneElement: (element, props) => ({ ...element, props: { ...element.props, ...props } }) };
  class Sidebar extends React.Component {} Sidebar.displayName = 'AccountSidebar'; Sidebar.containerStyles = { minWidth: 165, maxWidth: 250 };
  class Activity extends React.Component {} Activity.displayName = 'ActivitySidebar'; Activity.containerStyles = { minWidth: 165, maxWidth: 400 };
  class Notice extends React.Component {} Notice.displayName = 'Notice'; Notice.containerStyles = { minWidth: 165 };
  class Item extends React.Component { render() { return React.createElement('div', { role: 'treeitem', onClick: this.props.item.onSelect }); } }
  const original = Item.prototype.render;
  const components = new Map([Sidebar, Activity, Notice].map(c => [c.displayName, c]));
  const registry = { findComponentByName: name => components.get(name), findComponentsMatching: () => [...components.values()],
    register(c) { components.set(c.displayName, c); }, unregister(c) { components.delete(c.displayName); } };
  const preferences = new Map(), widths = { RootSidebar: 219 }, classes = new Set();
  const environment = { config: { get: key => preferences.get(key), set: (key,value) => preferences.set(key,value) },
    getLoadSettings: () => ({ resourcePath: '/native' }), getColumnWidth: key => widths[key] };
  const filename = path.resolve(__dirname, '../lib/mail-sidebar.js'), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require(name) {
    if (name === '/native/src/components/outline-view-item.js') return { default: Item };
    if (name === './grouped-mail') return require('../lib/grouped-mail');
    return require(name);
  }, document: { body: { classList: { toggle(name,value) { value ? classes.add(name) : classes.delete(name); }, remove(name) { classes.delete(name); } } } } });
  const api = { ComponentRegistry: registry, React, WorkspaceStore: { Location: { RootSidebar: 'sidebar' }, trigger() {} } };
  const controller = module.exports.installMailSidebar(api, environment);
  controller.setCollapsed(true);
  assert.equal(components.get('AswinMailSidebar').containerStyles.minWidth, 72);
  assert.equal(components.get('AswinMailActivity').containerStyles.minWidth, 72);
  assert.equal(Notice.containerStyles.minWidth, 0); assert.equal(widths.RootSidebar, 219);
  const callback = () => {}; const item = new Item({ item: { name: 'Inbox', onSelect: callback } });
  assert.equal(item.render().props.onClick, callback); assert.equal(item.render().props.title, 'Inbox');
  controller.setCollapsed(false); assert.equal(Notice.containerStyles.minWidth, 165);
  assert.equal(components.get('AswinMailSidebar').containerStyles.minWidth, 165);
  controller.setCollapsed(true); controller.cleanup();
  assert.equal(Item.prototype.render, original); assert.equal(components.get('AccountSidebar'), Sidebar);
  assert.equal(components.get('ActivitySidebar'), Activity); assert.equal(classes.size, 0);
  const restarted = module.exports.installMailSidebar(api, environment);
  assert.equal(components.get('AswinMailSidebar').containerStyles.maxWidth, 72);
  restarted.cleanup();
});
