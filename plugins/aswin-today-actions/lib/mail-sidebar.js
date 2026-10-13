'use strict';
const path = require('path');
const { mapElements } = require('./grouped-mail');
const COLLAPSED_KEY = 'aswinTodayActions.mailSidebarCollapsed';
const RAIL_WIDTH = 72;
const PALETTE = ['#8bb9ff', '#b7a0f7', '#74cfc1', '#e7b777', '#e993a9', '#a7cf80', '#83c7e2', '#d9a0df', '#c4bd77', '#93bba7', '#e6a18c', '#a6abef'];
function labelColor(id) {
  let hash = 0;
  for (const c of String(id)) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
function decorateLabels(items, iconName) {
  return (items || []).map(item => ({ ...item,
    className: `${item.className || ''} taa-mail-label`,
    iconName: item.iconName || iconName || 'tag.png',
    taaColor: labelColor(item.id),
    taaTitle: item.perspective?.category?.()?.displayName || item.name,
    children: decorateLabels(item.children, iconName),
  }));
}
function installMailSidebar(api, appEnv) {
  const registry = api.ComponentRegistry, React = api.React, h = React.createElement;
  const NativeSidebar = registry.findComponentByName('AccountSidebar');
  const NativeActivity = registry.findComponentByName('ActivitySidebar');
  if (!NativeSidebar || !NativeActivity) return null;
  const root = appEnv.getLoadSettings().resourcePath;
  const NativeItem = require(path.join(root, 'src/components/outline-view-item.js')).default;
  const originalItemRender = NativeItem.prototype.render;
  let collapsed = appEnv.config.get(COLLAPSED_KEY) === true, stopped = false;
  const listeners = new Set();
  const sidebarStyles = { ...NativeSidebar.containerStyles };
  const activityStyles = { ...NativeActivity.containerStyles };
  const others = registry.findComponentsMatching({ location: api.WorkspaceStore.Location.RootSidebar })
    .filter(c => c !== NativeSidebar && c !== NativeActivity).map(c => [c, c.containerStyles]);
  const announce = () => { for (const listener of listeners) listener(); };
  NativeItem.prototype.render = function() {
    const element = originalItemRender.call(this), item = this.props.item;
    // Keep the native tree, keyboard handlers and drag/drop targets intact.
    return React.cloneElement(element, { title: item.taaTitle || item.name,
      style: item.taaColor ? { ...element.props.style, '--taa-label-color': item.taaColor } : element.props.style });
  };
  function setCollapsed(value) {
    if (stopped) return;
    collapsed = value === true;
    appEnv.config.set(COLLAPSED_KEY, collapsed);
    MailSidebar.containerStyles = collapsed ? { minWidth: RAIL_WIDTH, maxWidth: RAIL_WIDTH } : sidebarStyles;
    MailActivity.containerStyles = collapsed ? { minWidth: RAIL_WIDTH, maxWidth: RAIL_WIDTH } : activityStyles;
    for (const [component, styles] of others) component.containerStyles = collapsed ?
      { ...styles, minWidth: 0, maxWidth: RAIL_WIDTH } : styles;
    document.body.classList.toggle('taa-mail-sidebar-collapsed', collapsed);
    announce();
    api.WorkspaceStore.trigger();
  }
  function toggleButton() {
    const label = collapsed ? 'Expand mailbox sidebar' : 'Collapse mailbox sidebar';
    return h('button', { type: 'button', className: 'taa-mail-sidebar-toggle', title: label,
      'aria-label': label, 'aria-expanded': !collapsed, onClick: () => setCollapsed(!collapsed) },
      h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: collapsed ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7' })),
      collapsed ? null : h('span', null, 'Collapse'));
  }
  class MailSidebar extends NativeSidebar {
    componentDidMount() {
      super.componentDidMount();
      this.onRailChange = () => this.forceUpdate(); listeners.add(this.onRailChange);
    }
    componentWillUnmount() { listeners.delete(this.onRailChange); super.componentWillUnmount(); }
    _renderUserSections(sections) {
      return super._renderUserSections(sections.map(section => ({ ...section,
        items: decorateLabels(section.items, section.iconName) })));
    }
    render() {
      const native = mapElements(React, super.render(), element => element.props.className === 'account-sidebar' ?
        React.cloneElement(element, {}, h('div', { className: 'taa-mail-sidebar-controls' }, toggleButton()), element.props.children) : element);
      return h('div', { className: `taa-mail-sidebar${collapsed ? ' taa-mail-rail' : ''}`, style: { flex: 1, minHeight: 0, display: 'flex' } }, native);
    }
  }
  MailSidebar.displayName = 'AswinMailSidebar'; MailSidebar.containerRequired = false;
  class MailActivity extends NativeActivity {
    componentDidMount() {
      super.componentDidMount();
      this.onRailChange = () => this.forceUpdate(); listeners.add(this.onRailChange);
    }
    componentWillUnmount() { listeners.delete(this.onRailChange); super.componentWillUnmount(); }
    render() {
      if (!collapsed) return super.render();
      const count = this.state.tasks.length;
      const label = this.state.syncSummary.phrase || (count ? `${count} pending tasks` : 'Mailbox sync status');
      return h('button', { type: 'button', className: 'taa-mail-sync', title: label, 'aria-label': label,
        onClick: () => { setCollapsed(false); this._onExpand(); } },
        h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
          strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'M20 8a8 8 0 1 0 1 6M20 3v5h-5' })),
        count ? h('span', { className: 'taa-mail-sync-count' }, count) : null);
    }
  }
  MailActivity.displayName = 'AswinMailActivity'; MailActivity.containerRequired = false;
  const descriptor = { location: api.WorkspaceStore.Location.RootSidebar };
  registry.unregister(NativeSidebar); registry.unregister(NativeActivity);
  registry.register(MailSidebar, descriptor); registry.register(MailActivity, descriptor);
  setCollapsed(collapsed);
  return { setCollapsed, cleanup() {
    stopped = true; listeners.clear();
    NativeItem.prototype.render = originalItemRender;
    document.body.classList.remove('taa-mail-sidebar-collapsed');
    for (const [component, styles] of others) component.containerStyles = styles;
    registry.unregister(MailSidebar); registry.unregister(MailActivity);
    registry.register(NativeSidebar, descriptor); registry.register(NativeActivity, descriptor);
    api.WorkspaceStore.trigger();
  } };
}
module.exports = { installMailSidebar, decorateLabels, labelColor, COLLAPSED_KEY, RAIL_WIDTH };
