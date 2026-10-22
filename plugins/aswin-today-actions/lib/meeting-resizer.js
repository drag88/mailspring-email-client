'use strict';
const { normalizeDisplay, MIN_HEIGHT, MAX_HEIGHT, DEFAULT_HEIGHT } = require('./meeting-display');

function createMeetingResizer(React) {
  return class MeetingResizer extends React.Component {
    start(event) {
      if (event.button !== 0 || this.drag) return;
      event.preventDefault();
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      this.drag = { id: event.pointerId, y: event.clientY, height: this.props.height, target };
      this.latestHeight = this.props.height;
    }
    move(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      const height = normalizeDisplay({ height: Math.max(MIN_HEIGHT, this.drag.height + event.clientY - this.drag.y) }).height;
      this.latestHeight = height;
      this.props.onResize(height, false);
    }
    finish(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      if (event.type === 'pointerup') this.move(event);
      const { target, id } = this.drag;
      this.drag = null;
      if (target.hasPointerCapture?.(id)) target.releasePointerCapture(id);
      this.props.onResize(this.latestHeight, true);
    }
    componentWillUnmount() {
      if (!this.drag) return;
      const { target, id } = this.drag;
      this.drag = null;
      if (target.hasPointerCapture?.(id)) target.releasePointerCapture(id);
    }
    key(event) {
      const heights = { ArrowUp: this.props.height - 20, ArrowDown: this.props.height + 20,
        Home: MIN_HEIGHT, End: MAX_HEIGHT };
      if (!(event.key in heights)) return;
      event.preventDefault();
      this.props.onResize(normalizeDisplay({ height: heights[event.key] }).height, true);
    }
    render() {
      return React.createElement('div', { className: 'taa-meeting-resizer', role: 'separator', tabIndex: 0,
        'aria-label': 'Resize meetings panel', 'aria-orientation': 'horizontal',
        'aria-valuemin': MIN_HEIGHT, 'aria-valuemax': MAX_HEIGHT, 'aria-valuenow': this.props.height,
        'aria-valuetext': `Up to ${this.props.height} pixels, limited to fit the window`, 'aria-controls': 'taa-calendar-content',
        title: 'Drag to change the meeting list height limit. Double-click to reset.',
        onPointerDown: event => this.start(event), onPointerMove: event => this.move(event),
        onPointerUp: event => this.finish(event), onPointerCancel: event => this.finish(event),
        onLostPointerCapture: event => this.finish(event), onKeyDown: event => this.key(event),
        onDoubleClick: () => this.props.onResize(DEFAULT_HEIGHT, true),
      }, React.createElement('span', { className: 'taa-resize-grip', 'aria-hidden': true }));
    }
  };
}
module.exports = { createMeetingResizer };
