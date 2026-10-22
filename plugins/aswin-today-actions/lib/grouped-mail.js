'use strict';
const path = require('path');
const { localDateKey } = require('./core');
const { HEADER_HEIGHT, actionSources, groupGeometry, rowTop, headerTop, indexAtY,
  groupQueries, priorityQuery } = require('./mail-groups');

function mapElements(React, element, replace) {
  if (!React.isValidElement(element)) return element;
  const replaced = replace(element);
  if (replaced !== element) return replaced;
  if (!element.props.children) return element;
  const children = Array.isArray(element.props.children) ? React.Children.map(element.props.children,
    child => mapElements(React, child, replace)) : mapElements(React, element.props.children, replace);
  return React.cloneElement(element, {}, children);
}

function installGroupedMail(api, appEnv, actionStore) {
  const registry = api.ComponentRegistry;
  const NativeThreadList = registry.findComponentByName?.('ThreadList');
  if (!NativeThreadList || !api.Matcher?.And) return null;
  const root = appEnv.getLoadSettings().resourcePath;
  const { MultiselectList } = require(path.join(root, 'src/components/multiselect-list.js'));
  const { ListTabular, ListTabularRows } = require(path.join(root, 'src/components/list-tabular.js'));
  const threadStore = require(path.join(root, 'internal_packages/thread-list/lib/thread-list-store.js')).default;
  const React = api.React, h = React.createElement;
  const originalCreate = threadStore.createListDataSource;
  let enabled = true, stopped = false, groupsCleanup = () => {}, day = localDateKey();
  let sourceKey = JSON.stringify(actionSources(actionStore.actions));
  const descriptor = { location: api.WorkspaceStore.Location.ThreadList, role: 'ThreadList', modes: ['split', 'list'] };

  function GroupedRows(props) {
    const groups = props.groups || [];
    const native = ListTabularRows.type(props);
    const rows = React.Children.map(native.props.children, element => element && React.cloneElement(element, {
      metrics: { ...element.props.metrics, top: rowTop(element.props.metrics.top / props.itemHeight, props.itemHeight, groups) },
    }));
    const headers = groups.map(group => h('div', { key: `group-${group.rank}`, className: 'taa-mail-section',
      role: 'heading', 'aria-level': 2, style: { top: headerTop(group, props.itemHeight, groups), height: HEADER_HEIGHT },
      onClick: event => event.stopPropagation(), onDoubleClick: event => event.stopPropagation(),
      onContextMenu: event => { event.preventDefault(); event.stopPropagation(); }, draggable: false },
      h('span', null, group.name), h('span', { className: 'taa-mail-section-count' }, group.count)));
    return React.cloneElement(native, { style: { ...native.props.style,
      height: props.innerStyles.height + groups.length * HEADER_HEIGHT }, className: `${native.props.className} taa-grouped-mail-rows` },
      [...rows, ...headers]);
  }
  class GroupedListTabular extends ListTabular {
    getRange() {
      if (!this._scrollRegion) return;
      const groups = this.props.dataSource.mailGroups || [];
      const start = indexAtY(this._scrollRegion.scrollTop, this.props.itemHeight, groups);
      const end = indexAtY(this._scrollRegion.scrollTop + window.innerHeight, this.props.itemHeight, groups) + 1;
      return { start: Math.max(0, start - 2), end: Math.min(end + 2, this.state.count + 1) };
    }
    render() {
      const groups = this.props.dataSource.mailGroups || [];
      return mapElements(React, super.render(), element => element.type === ListTabularRows ?
        h(GroupedRows, { ...element.props, groups }) : element);
    }
  }
  GroupedListTabular.displayName = 'AswinGroupedListTabular';
  class GroupedMultiselect extends MultiselectList {
    render() {
      return mapElements(React, super.render(), element => element.type === ListTabular ?
        h(GroupedListTabular, { ...element.props, ref: element.ref }) : element);
    }
  }
  GroupedMultiselect.displayName = 'AswinGroupedMultiselect';
  class GroupedThreadList extends NativeThreadList {
    render() {
      return mapElements(React, super.render(), element => element.type === MultiselectList ?
        h(GroupedMultiselect, { ...element.props, ref: element.ref }) : element);
    }
  }
  GroupedThreadList.displayName = 'AswinGroupedThreadList';

  function decorate(source, base, sources, dateKey) {
    if (!base || !source) return;
    const nativeCount = source.count.bind(source);
    let disposed = false, version = 0, timer = null, exactCount = null;
    source.mailGroups = [];
    source.count = () => exactCount === null ? Math.max(0, nativeCount()) : exactCount;
    const refresh = async () => {
      timer = null;
      const current = ++version;
      try {
        const counts = await Promise.all(groupQueries(api, base, sources, dateKey).map(q => Promise.resolve(q)));
        if (disposed || current !== version) return;
        if (!counts.every(n => Number.isInteger(n) && n >= 0)) throw new Error('Invalid group counts');
        exactCount = counts.reduce((a, b) => a + b, 0);
        source.mailGroups = groupGeometry(counts);
        // Emit without scheduling another count refresh.
        ownEmission = true;
        try { source.trigger(); } finally { ownEmission = false; }
      } catch (_) {
        if (!disposed && current === version) {
          exactCount = null; source.mailGroups = [];
          ownEmission = true;
          try { source.trigger(); } finally { ownEmission = false; }
        }
      }
    };
    let ownEmission = false;
    const unlisten = source.listen(() => {
      if (!ownEmission && !timer) timer = globalThis.setTimeout(refresh, 50);
    });
    groupsCleanup = () => {
      disposed = true; version++; unlisten();
      if (timer) globalThis.clearTimeout(timer);
    };
    refresh();
  }

  threadStore.createListDataSource = function() {
    groupsCleanup(); groupsCleanup = () => {};
    if (!enabled || stopped) return originalCreate.call(this);
    const perspective = api.FocusedPerspectiveStore.current();
    const factory = perspective.threads;
    let base = null, sources = actionSources(actionStore.actions), dateKey = perspective.isSent?.() ?
      'lastMessageSentTimestamp' : 'lastMessageReceivedTimestamp';
    // Preserve search relevance and special perspectives with custom subscription semantics.
    const eligible = perspective.constructor?.name === 'CategoryMailboxPerspective' ||
      perspective.constructor?.name === 'StarredMailboxPerspective';
    if (!eligible) return originalCreate.call(this);
    perspective.threads = function() {
      const subscription = factory.call(this);
      if (subscription?.replaceQuery && subscription.query()) {
        base = subscription.query().clone();
        subscription.replaceQuery(priorityQuery(api, base, sources, dateKey));
      }
      return subscription;
    };
    try { originalCreate.call(this); }
    finally { perspective.threads = factory; }
    decorate(this.dataSource(), base, sources, dateKey);
  };

  function setEnabled(value) {
    if (stopped) return;
    enabled = value;
    registry.unregister(value ? NativeThreadList : GroupedThreadList);
    registry.register(value ? GroupedThreadList : NativeThreadList, descriptor);
    threadStore.createListDataSource();
  }
  function actionsChanged() {
    const next = JSON.stringify(actionSources(actionStore.actions));
    if (next !== sourceKey) { sourceKey = next; if (enabled) threadStore.createListDataSource(); }
  }
  actionStore.on('change', actionsChanged);
  const midnight = globalThis.setInterval(() => {
    if (day !== localDateKey()) { day = localDateKey(); if (enabled) threadStore.createListDataSource(); }
  }, 60000);
  setEnabled(true);
  return { isEnabled: () => enabled, setEnabled, cleanup() {
    stopped = true; globalThis.clearInterval(midnight); groupsCleanup();
    actionStore.removeListener('change', actionsChanged);
    threadStore.createListDataSource = originalCreate;
    registry.unregister(GroupedThreadList);
    registry.register(NativeThreadList, descriptor);
    originalCreate.call(threadStore);
  } };
}
module.exports = { installGroupedMail, mapElements };
