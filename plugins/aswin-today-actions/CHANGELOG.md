# Changelog

## 0.1.14 — 16 October 2026

- Add a Mac menu bar preview with unread inbox conversations across connected accounts and the rest of today's synced agenda.
- Keep ongoing, upcoming and all-day meetings while excluding finished, declined and cancelled events.
- Restore native commands on renderer unload without replacing the existing status item.
- Keep the menu pinned to today when another date is selected in the sidebar.
- Known issue: the icon remained invisible during live validation. Internal data checks passed, but this release does not resolve the missing-icon symptom.

## 0.1.13 — 14 October 2026

- Add Currency and Timezone tabs in a collapsible Tools panel below the email reader.
- Show indicative daily exchange rates with the observation date. Send only currency codes to Frankfurter when Convert is selected.
- Support offline timezone conversion, date rollover and explicit handling of missing or repeated daylight-saving times.
- Preserve the existing Today + Actions pane, grouped mail and saved actions.

## 0.1.12

Add a collapsible mailbox icon rail with local label colours, native account switching, unread badges, folder selection and sync status. Restore the previous sidebar width when expanded.

## 0.1.10–0.1.11

Add meeting display settings and a draggable divider above Actions. Support compact rows, a saved 180–720px meeting-list height, keyboard resizing and a 320px reset.

## Earlier releases

Version 0.1.9 adds grouped email lists in normal folders and Starred: Needs action / follow-up, Starred, Today, Yesterday and Earlier. Open email-linked actions pin their thread above starred mail. Each email appears once, stays in its current folder, and keeps the native email controls. The Grouped mail toolbar button switches back to Recent mail. Empty sections are hidden. Search results and special views such as Unread keep their native ordering.

Version 0.1.8 adds opt-in reminder date/time, native Mac notifications, reminder follow-up controls and snooze. Missed alerts are checked on reopening Mailspring. Reminder times and notification-issued state persist locally without enabling reminders on existing actions.

Version 0.1.7 fixes an offscreen action editor: email + Action, + New and Edit now expand Actions, scroll the form into view and focus its title, including repeated clicks. The form lives inside Actions. Click the Actions heading/arrow to collapse or expand the section without losing an unsaved draft. Its open-action count and + New remain visible. The daily calendar heading/arrow separately collapses or expands meetings while preserving meeting details. The month calendar stays visible; disclosure state lasts while the plugin is running.

Version 0.1.6 adds New meeting in the sidebar and native calendar window. It opens a draft in Google Calendar for real Meet generation and work room booking. Version 0.1.5 uses the active theme's native font sizes: 14px main text, 13px controls and 12px secondary labels in the current theme. Version 0.1.4 adds a navigable month calendar, meeting details on click, monochrome inline icons, and conferencing metadata/Google redirect support for join links. Version 0.1.3 uses neutral calendar rows and segmented action filters, removes coloured card edges, and hides repeated calendar names when only one calendar is represented. Version 0.1.2 follows your active Mailspring theme rather than the base light palette. Version 0.1.1 fixes the startup error “Cannot find module 'react'” by using React through Mailspring's exports. Reinstall this folder over version 0.1.0; your locally saved actions are retained.
