'use strict';
const { meetingLink } = require('./core');

// Supply conferencing and room metadata to the native occurrence parser, per VEVENT.
// Work on an in-memory copy so recurrence exceptions keep their own join links.
function withConferenceLinks(event, parseICS) {
  if (!event.ics || typeof parseICS !== 'function') return event;
  try {
    const { root } = parseICS(event.ics);
    const components = root.name === 'vevent' ? [root] : root.getAllSubcomponents('vevent');
    let changed = false;
    for (const component of components) {
      const urls = new Set();
      for (const name of ['conference', 'x-google-conference', 'x-microsoft-skypeteamsmeetingurl']) {
        for (const property of component.getAllProperties(name)) {
          const link = meetingLink({ location: String(property.getFirstValue() || '') });
          if (link) urls.add(link);
        }
      }
      if (urls.size) {
        const description = String(component.getFirstPropertyValue('description') || '');
        component.updatePropertyWithValue('description', `${description}\n${[...urls].join('\n')}`);
        changed = true;
      }
      // Google rooms may be resource attendees rather than LOCATION text.
      // Enrich only this VEVENT so recurrence exceptions keep their own rooms.
      let location = String(component.getFirstPropertyValue('location') || '');
      for (const attendee of component.getAllProperties('attendee')) {
        const email = String(attendee.getFirstValue() || '').replace(/^mailto:/i, '');
        const type = String(attendee.getFirstParameter('cutype') || '').toUpperCase();
        const status = String(attendee.getFirstParameter('partstat') || '').toUpperCase();
        const resource = type === 'RESOURCE' || type === 'ROOM' || /@resource\.calendar\.google\.com$/i.test(email);
        if (!resource || status === 'DECLINED') continue;
        const name = String(attendee.getFirstParameter('cn') || email).trim();
        if (!name || location.toLowerCase().includes(name.toLowerCase())) continue;
        location = location ? `${location}\n${name}` : name;
        component.updatePropertyWithValue('location', location);
        changed = true;
      }
    }
    return changed ? { ...event, ics: root.toString() } : event;
  } catch (_) { return event; } // Keep native error handling for malformed ICS.
}
module.exports = { withConferenceLinks };
