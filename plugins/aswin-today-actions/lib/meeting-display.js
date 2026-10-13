'use strict';
const { descriptionText, meetingLink } = require('./core');
const DISPLAY_KEY = 'mailspring.aswinTodayActionsDisplay';
const MIN_HEIGHT = 180, MAX_HEIGHT = 720, DEFAULT_HEIGHT = 320;

function normalizeDisplay(value = {}) {
  const number = Number(value?.height);
  return { compact: value?.compact !== false,
    height: Number.isFinite(number) && number > 0 ?
      Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(number))) : DEFAULT_HEIGHT };
}
function readDisplay(config) {
  try { return normalizeDisplay(config?.get(DISPLAY_KEY)); }
  catch (_) { return normalizeDisplay(); }
}
function saveDisplay(config, value) {
  const display = normalizeDisplay(value);
  try { config?.set(DISPLAY_KEY, display); } catch (_) { /* Current view still works if config is unavailable. */ }
  return display;
}
function meetingLocation(event) {
  // A hybrid meeting can have both a physical room and an online join link.
  const location = descriptionText(event.location);
  const withoutCalls = location.replace(/https?:\/\/[^\s<>]+|(?:meet\.google\.com|(?:[a-z0-9-]+\.)?zoom\.us|teams\.microsoft\.com)\/[^\s<>]+/gi,
    value => meetingLink({ location: value }) ? '' : value)
    .replace(/^[\s,;|–—-]+|[\s,;|–—-]+$/g, '').replace(/[ \t]+/g, ' ').trim();
  if (meetingLink(event) && /^(?:Google Meet|Microsoft Teams|Zoom|Webex)$/i.test(withoutCalls)) return '';
  return withoutCalls;
}
module.exports = { DISPLAY_KEY, MIN_HEIGHT, MAX_HEIGHT, DEFAULT_HEIGHT, normalizeDisplay, readDisplay, saveDisplay, meetingLocation };
