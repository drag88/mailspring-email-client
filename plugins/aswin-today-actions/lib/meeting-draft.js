'use strict';
const { localDateKey } = require('./core');

// Open Google's editor rather than pretending a location string books a room.
// A draft is not saved and no invitations are sent by this URL.
function googleMeetingDraft({ date = new Date(), now = new Date(), email = '', timezone = '' } = {}) {
  const selected = new Date(date);
  if (!Number.isFinite(selected.getTime()) || !Number.isFinite(now.getTime()))
    throw new Error('Choose a valid meeting date.');
  const start = new Date(selected);
  if (localDateKey(selected) === localDateKey(now)) {
    start.setTime(Math.ceil((now.getTime() + 1) / 1800000) * 1800000);
  } else {
    start.setHours(9, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 1800000);
  const stamp = value => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('dates', `${stamp(start)}/${stamp(end)}`);
  if (timezone) url.searchParams.set('ctz', timezone);
  if (email) url.searchParams.set('authuser', email);
  // Calendar can silently ignore authuser when that account isn't signed in
  // to the default browser profile. Route through Google's account selection.
  const chooser = new URL('https://accounts.google.com/AccountChooser');
  chooser.searchParams.set('continue', url.toString());
  chooser.searchParams.set('service', 'cl');
  if (email) chooser.searchParams.set('Email', email);
  return chooser.toString();
}

function googleAccountEmail(accounts, preferredId) {
  const google = (accounts || []).filter(account => /^(gmail|google)$/i.test(account.provider || ''));
  return (google.find(account => account.id === preferredId) || (google.length === 1 ? google[0] : null))?.emailAddress || '';
}

module.exports = { googleMeetingDraft, googleAccountEmail };
