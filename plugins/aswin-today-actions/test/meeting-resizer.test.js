'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMeetingResizer } = require('../lib/meeting-resizer');
const React = { Component: class { constructor(props) { this.props = props; } },
  createElement: (type, props, ...children) => ({ type, props, children }) };
function fixture() {
  const calls = [], captured = new Set();
  const target = { setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id),
    releasePointerCapture: id => captured.delete(id) };
  const Resizer = createMeetingResizer(React);
  const control = new Resizer({ height: 320, onResize(height, commit) {
    calls.push({ height, commit }); control.props = { ...control.props, height };
  } });
  const event = (clientY, extra = {}) => ({ button: 0, pointerId: 7, clientY, currentTarget: target, preventDefault() {}, ...extra });
  return { control, calls, captured, event };
}
test('drag captures pointer, follows cumulative movement and saves only when released', () => {
  const f = fixture();
  f.control.start(f.event(200, { button: 2 })); assert.equal(f.captured.size, 0);
  f.control.start(f.event(200)); assert(f.captured.has(7));
  f.control.move(f.event(240, { pointerId: 8 })); assert.equal(f.calls.length, 0);
  f.control.move(f.event(251)); assert.deepEqual(f.calls.at(-1), { height: 371, commit: false });
  f.control.move(f.event(265)); assert.equal(f.calls.at(-1).height, 385);
  f.control.finish(f.event(291, { type: 'pointerup' }));
  assert.deepEqual(f.calls.at(-1), { height: 411, commit: true }); assert.equal(f.captured.size, 0);
  const count = f.calls.length;
  f.control.finish(f.event(291, { type: 'lostpointercapture' }));
  f.control.move(f.event(500)); assert.equal(f.calls.length, count);
});
test('cancel bounds the last height and unmount releases pointer without stale changes', () => {
  const f = fixture(); f.control.start(f.event(200)); f.control.move(f.event(-1000));
  assert.deepEqual(f.calls.at(-1), { height: 180, commit: false });
  f.control.finish(f.event(-1000, { type: 'pointercancel' }));
  assert.deepEqual(f.calls.at(-1), { height: 180, commit: true });
  f.control.start(f.event(200)); const count = f.calls.length;
  f.control.componentWillUnmount(); assert.equal(f.captured.size, 0);
  f.control.move(f.event(900)); assert.equal(f.calls.length, count);
});
test('keyboard separator supports arrows, limits and double-click reset', () => {
  const f = fixture(); const key = key => f.control.key({ key, preventDefault() {} });
  key('ArrowUp'); assert.deepEqual(f.calls.at(-1), { height: 300, commit: true });
  key('End'); key('ArrowDown'); assert.equal(f.calls.at(-1).height, 720);
  key('Home'); key('ArrowUp'); assert.equal(f.calls.at(-1).height, 180);
  const count = f.calls.length; key('Enter'); assert.equal(f.calls.length, count);
  const element = f.control.render();
  assert.equal(element.props.role, 'separator'); assert.equal(element.props['aria-orientation'], 'horizontal');
  element.props.onDoubleClick(); assert.deepEqual(f.calls.at(-1), { height: 320, commit: true });
});
