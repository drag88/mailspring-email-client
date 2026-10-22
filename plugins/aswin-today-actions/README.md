# Today + Actions — Mailspring plugin

Version **0.1.15** · Tested with **Mailspring 1.26.0 on macOS**.

A calendar and email-linked action pane, grouped mail, a collapsible mailbox sidebar, and currency/timezone tools below the email reader.

Version 0.1.15 puts Today + Actions, Tools and Grouped mail under one right-aligned Extras menu. Meetings use only the space they need, Actions uses less space, and scrolling continues between the meeting list and the rest of the pane.

## Install on macOS

1. Download `aswin-today-actions-0.1.15.zip` from the [release page](https://github.com/drag88/mailspring-email-client/releases/tag/v0.1.15) and extract it.
2. In Mailspring, choose **Developer → Install a Plugin…**.
3. Select the **aswin-today-actions** folder that directly contains `package.json`.
4. Choose **Developer → Reload**. If the plugin does not appear, quit and reopen Mailspring.
5. Open **Extras** in the top toolbar and choose **Today + Actions** to show or hide the right pane. The same menu controls **Tools** and **Grouped mail**; checked items are enabled.

No terminal commands, build step, npm install, or Mailspring ID are required.

## Mac menu bar

**Known issue:** the icon remained invisible during live validation, including after freeing menu-bar space. The internal tray, count and menu data were verified, but visible placement and real popup clicks remain unresolved. This release does not claim to fix the missing-icon symptom.

The existing Mailspring icon shows the exact unread inbox conversation count across all connected accounts, including zero. Click it for the same count and the rest of today's agenda in your Mac's timezone. Ongoing, upcoming and all-day events appear from your synced, visible calendars. Finished, declined and cancelled events are excluded. Hover a meeting for its end time, room and supported Join link.

Browsing another day in the sidebar does not change this menu. Open Inbox, Open Calendar, New Message, Preferences and Quit remain available. Loading or unavailable data is labelled explicitly. Mailspring must remain running with its main window loaded; disabling the plugin restores the native menu. This uses Mailspring 1.26's private tray manager and may need updating after an app upgrade.

## Currency and timezone tools

- **Currency:** enter an amount (plain decimals or comma grouping; negative refunds are supported), choose currencies, and click Convert. Supports 20 common currencies. Shows an indicative daily Frankfurter rate with its observation date, excluding bank fees. Requires internet for different currencies; same-currency calculations work offline. Inputs and results reset on reload. Amounts up to 1 trillion are supported; this is an approximate converter, not accounting software.
- **Timezone:** choose a date/time and source/destination IANA timezones. Results include the destination date and UTC offset. Now uses the selected source timezone. Swap retains the represented instant for ordinary times. DST gaps are rejected; repeated times require an explicit earlier/later choice. Uses the app's bundled timezone rules and works offline.
- **Tools:** choose **Extras → Tools** to show or hide the entire converter strip. It starts hidden and remembers your choice across reloads. Within the strip, its heading collapses the inputs; selecting Currency or Timezone expands them again. Hiding the strip resets converter inputs and results. The panel remains outside the email scroll area and wraps on narrower reader widths.

## Mail organisation

### Mailbox sidebar

Click **Collapse** above the mailbox list to use the icon rail. Click the top chevron to expand again. Hover an icon for its folder or label name. Label icons and names have consistent local colours in both views. The account switcher, unread badges, nested folders and keyboard navigation remain native Mailspring controls. Click the sync icon at the bottom to expand for details. The collapsed preference saves automatically; expanding restores the existing sidebar width.

### Grouped mail

- **Grouped mail:** email-linked open actions appear in Needs action / follow-up. Gmail stars appear in Starred unless that email already has an open action. Other mail uses Today, Yesterday or Earlier based on the latest received message and your Mac's local calendar day; Sent uses the latest sent message. New replies update the date group. Empty sections are hidden and each section is newest first. Completing all actions linked to an email returns it to Starred or its date section. Starred mail is promoted across the entire selected folder, including older mail outside the visible page.
- **Follow up on an email:** select it, click + Action and save an open action; choose Remind me separately if you want a notification. This view uses Today + Actions follow-ups, not Mailspring Pro's send-reminder metadata.
- **Extras → Grouped mail:** toggles grouping for this session. Uncheck it for the standard chronological list. Search and special subscription views retain their normal semantics. Grouping resumes by default on restart.

## Calendar and meetings

- **New meeting:** opens Google Calendar in your browser. From the sidebar it uses the selected day; from the native calendar header it defaults to today. Today rounds forward to the next half hour, other days start at 9am, and the default duration is 30 minutes. Add a title, guests, Google Meet and available rooms there, then save in Google Calendar. The button opens an unsaved draft and sends no invitations. Your single Google account (or the Google account of the focused email) is passed to Google's account chooser. If that account is not signed in to the default browser profile, Google asks you to sign in instead of silently using your personal calendar. You can open the draft in your signed-in work browser profile.
- **Month calendar:** use the arrows to browse months, click a date to view its meetings, or click Today to return to the current day. Actions remain a personal due-date tracker independently of the selected calendar date.
- **Calendar:** meetings for the selected day, including all-day and recurring events. Click a meeting row to expand its notes and attendees. Past meetings are dimmed. Ongoing meetings show “Now”. Times follow your Mac's timezone, displayed above the list. Drag the left edge to resize the pane.
- **Rooms / location:** the room remains visible even when a meeting also has a Join button. Synced room resource attendees are included, excluding declined resources. The plugin enriches an in-memory ICS copy only, respecting recurrence exceptions; it does not change room bookings. Expand a row to see long room/title text in full. Rooms absent from the synced invitation cannot be reconstructed.
- **Display:** opens **Compact meetings** and a **Meeting list height limit** slider (180–720px, default 320px). Compact rows reduce padding, shorten long titles and omit repeated calendar email labels while preserving text size. Turn compact off for more spacing. The list grows with its contents, up to your chosen limit or 35% of the window height, whichever is smaller. Longer lists scroll independently, leaving room for Actions below. Preferences are saved in Mailspring's local configuration and survive reloads. The overall sidebar width can still be resized by its left edge.
- **Divider above Actions:** drag its centre grip to change the meeting list height limit. The limit updates continuously and saves when released. Double-click resets to 320px. When focused, Up/Down adjust by 20px; Home/End choose the height limits. The divider appears while the meetings section is open and contains events. Raising the limit does not add empty space when the day's meetings are short.
- **Join meeting:** opens recognised HTTPS Google Meet, Microsoft Teams, Zoom or Webex links in your browser. It appears whenever the synced invitation includes a supported link, including past meetings. If none is present, meeting details explain that no online link was supplied. Conferencing metadata is read from an in-memory ICS copy; no calendar data is edited.
- **Open Calendar:** opens Mailspring's native calendar and its normal sync flow. The sidebar reads calendars already synced by Mailspring; it doesn't establish a new Google connection. Calendar visibility follows the calendars selected in the native calendar window.
## Actions and reminders

- **+ Action** in the email toolbar: opens a task form inside Actions, reveals the pane/section and brings the form into view. The link is captured from the single selected thread when the form opens and does not silently change if you select another email.
- **Actions heading/arrow:** collapses or expands the action form, filters and list. Collapsing retains your unsaved draft; + New or + Action expands the section automatically.
- **Daily calendar heading/arrow:** collapses or expands the meetings section independently of Actions. The month calendar and Open Calendar remain visible, and expanded meeting details are retained.
- **+ New:** creates an action linked to the currently open email, if any. Click **Unlink** for a standalone action.
- Add a title, owner (default “Me”), due date (default today; optional), and optional notes.
- **Remind me:** enable it in New/Edit action, choose a reminder date/time in your Mac's timezone, then Save action. The initial suggestion is 9am on a future due day, or 15 minutes from now. Due date and reminder time are independent; setting a due date alone does not enable notifications.
- **Notifications:** click an action reminder to bring Mailspring forward and open the action form, with Open email for follow-up. The notification's action button snoozes for 15 minutes where macOS exposes it. Mac notification permissions, Focus and preview settings apply; use Test notification to check the OS path.
- **Snooze:** due reminders show 15 min, 1 hour and Tomorrow 9am options. Snooze updates only the reminder time, keeping the action's deadline. Dismiss removes the reminder while retaining the action; completing an action cancels its reminder. Reopening a completed action does not restore the cancelled reminder.
- **Due:** due reminders (even with future deadlines), overdue, today and undated actions. **All open:** includes future actions. **Done:** completed actions; uncheck to reopen.
- **Open email:** opens the original thread. If the account is disconnected or the thread is no longer available locally, the action is retained and an explanation appears.
- No emails are sent, labelled, archived or deleted by the plugin. Opening an email uses Mailspring's normal focus behavior, including its configured mark-as-read behavior.

Actions are a personal tracker. Typing another person's name in Owner does not notify or assign a task to them.

## Privacy and storage

Currency conversion requests a daily rate from [Frankfurter](https://frankfurter.dev/) when you click **Convert** with different currencies. Only the two currency codes are sent. Amounts, mailbox data, account details and actions stay on the Mac. Requests omit cookies, stop when the inputs change or the panel is removed, and time out after 15 seconds.

Timezone conversion runs locally. The plugin uses Mailspring's bundled React and existing calendar/database APIs. It adds no analytics, AI service or background downloads.

Action titles, owners, due dates, notes and source thread/account IDs and subjects are saved to:

`~/Library/Application Support/Mailspring/today-actions/actions.json`

The source email body and attachments are not copied into this file. The file is plain JSON. The plugin does not encrypt it; protection depends on the Mac's account permissions and disk encryption. Files are created with owner-only permissions. Each successful change keeps the previous file as `actions.json.bak`, and uses an atomic replacement for the new file. An unreadable/corrupt task file is preserved and further writes are blocked; quit Mailspring before restoring a known-good backup.

### Reminders

Actions do not sync to another Mac. Reminder schedules and notification-issued state are saved in the same action file. Native Mac notifications contain the action title, without notes or source email contents.

The scheduler runs in the main mail window. It checks every 30 seconds, on save and on startup, and catches up after sleep or reopening. It issues each schedule once. Missed or suppressed banners remain visible as due reminders in the pane.

Mailspring must keep running with its main mail window loaded. A minimised window or hidden Today + Actions pane is sufficient. If Mailspring is fully quit, alerts wait until reopening. This version installs no background helper and does not integrate Apple Reminders.

### Calendar and meeting links

**New meeting** opens Google Calendar with the selected time, timezone and suggested account email. It passes no email subjects, bodies, attendees or notes. Google Calendar creates Meet links and books rooms using its existing account permissions.

**Join meeting** opens the meeting provider. **Open Calendar** invokes Mailspring's normal calendar syncing. Mailspring's provider syncing, crash reporting and privacy settings remain separate from this plugin.

## Compatibility and limitations

- Uses public plugin registries and internal calendar/thread-list APIs. Tested with Mailspring 1.26.0; later app versions may require compatibility changes. If the calendar helper becomes unavailable, the pane shows an explanation and actions remain usable.
- Grouped mail retains native selection, drag, swipe and context-menu controls. Section headings are outside selectable thread data. Search and special perspectives retain native behavior.
- Only calendars supported and already synced by your Mailspring account appear. Unsynced calendars cannot be reconstructed from email invitations by this plugin.
- The sidebar is added to the inbox and email sheets in the main mail window, not separate compose or pop-out windows.
- No event creation/editing inside the Mailspring preview: New meeting uses Google Calendar's full editor. No automatic task extraction, delegation, cloud task sync or reminder alerts when Mailspring is fully quit.

## Disable / uninstall

Quit Mailspring. Move `aswin-today-actions` out of:

`~/Library/Application Support/Mailspring/packages/`

Restart Mailspring. Keep `today-actions/actions.json` and its backup if you want to reinstall later. Removing the plugin does not delete your actions.

## Development and validation

The `lib/` files use CommonJS JavaScript and Mailspring's bundled React. A build step is not required. Run unit tests from this package directory; use Node.js 20 or later for the repository's development workflow:

```sh
node --test test/*.test.js
```

The development workspace also includes checks using the installed app's native calendar expansion helper, React rendering and LESS compiler. See [validation](VALIDATION.md) for results and coverage limits. See the [changelog](CHANGELOG.md) for release history.
