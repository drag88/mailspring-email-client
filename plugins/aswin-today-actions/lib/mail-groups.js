'use strict';
const HEADER_HEIGHT = 28;
const GROUP_NAMES = ['Needs action / follow-up', 'Starred', 'Today', 'Yesterday', 'Earlier'];

function dayStarts(now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  return { today, yesterday };
}
function actionSources(actions) {
  const seen = new Set();
  return actions.filter(a => !a.completedAt && a.source?.threadId && a.source?.accountId)
    .map(a => a.source).filter(source => {
      const key = JSON.stringify([source.accountId, source.threadId]);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
}
function groupForThread(thread, sources, now = new Date(), dateKey = 'lastMessageReceivedTimestamp') {
  if (sources.some(s => s.threadId === thread.id && s.accountId === thread.accountId)) return 0;
  if (thread.starred) return 1;
  const date = thread[dateKey] instanceof Date ? thread[dateKey] : new Date(thread[dateKey]);
  const { today, yesterday } = dayStarts(now);
  if (date >= today) return 2;
  if (date >= yesterday) return 3;
  return 4;
}
function groupGeometry(counts) {
  let start = 0;
  return counts.map((count, rank) => {
    const group = { rank, name: GROUP_NAMES[rank], start, count };
    start += count; return group;
  }).filter(g => g.count > 0);
}
function rowTop(index, height, groups) {
  return index * height + groups.filter(g => g.start <= index).length * HEADER_HEIGHT;
}
function headerTop(group, height, groups) {
  return group.start * height + groups.indexOf(group) * HEADER_HEIGHT;
}
function indexAtY(y, height, groups) {
  let removed = 0;
  for (const group of groups) {
    const top = group.start * height + removed;
    if (y < top + HEADER_HEIGHT) return Math.max(0, group.start);
    removed += HEADER_HEIGHT;
    if (y < (group.start + group.count) * height + removed)
      return Math.max(group.start, Math.floor((y - removed) / height));
  }
  return Math.max(0, Math.floor((y - removed) / height));
}
function groupQueries(api, base, sources, dateKey, now = new Date()) {
  const { Thread, Matcher } = api;
  const attr = Thread.attributes;
  const action = sources.length ? new Matcher.Or(sources.map(s => new Matcher.And([
    attr.id.equal(s.threadId), attr.accountId.equal(s.accountId),
  ]))) : attr.id.equal('');
  const noAction = sources.length ? new Matcher.And(sources.map(s => new Matcher.Or([
    attr.id.not(s.threadId), attr.accountId.not(s.accountId),
  ]))) : attr.id.not('');
  const unstarred = new Matcher.Or([attr.starred.equal(false), attr.starred.equal(null)]);
  const ordinary = new Matcher.And([noAction, unstarred]);
  const { today, yesterday } = dayStarts(now);
  const date = attr[dateKey];
  const criteria = [action,
    new Matcher.And([noAction, attr.starred.equal(true)]),
    new Matcher.And([ordinary, date.gte(today)]),
    new Matcher.And([ordinary, date.gte(yesterday), date.lt(today)]),
    new Matcher.And([ordinary, new Matcher.Or([date.lt(yesterday), date.equal(null)])])];
  return criteria.map(matcher => base.clone().where(matcher).offset(null).limit(null).count());
}
function priorityQuery(api, base, sources, dateKey) {
  const attr = api.Thread.attributes;
  const action = sources.length ? new api.Matcher.Or(sources.map(s => new api.Matcher.And([
    attr.id.equal(s.threadId), attr.accountId.equal(s.accountId),
  ]))).whereSQL(api.Thread) : '0';
  // Native sort descriptors track star/date changes; action changes recreate the view.
  const rank = { attr: attr.starred, direction: 'ASC', orderBySQL(klass) {
    const star = attr.starred.equal(true).whereSQL(klass);
    return `CASE WHEN ${action} THEN 0 WHEN ${star} THEN 1 ELSE 2 END ASC`;
  } };
  const query = base.clone();
  query._orders = [rank, attr[dateKey].descending(), attr.id.ascending()];
  return query;
}
module.exports = { HEADER_HEIGHT, GROUP_NAMES, dayStarts, actionSources, groupForThread,
  groupGeometry, rowTop, headerTop, indexAtY, groupQueries, priorityQuery };
