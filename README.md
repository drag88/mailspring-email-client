# Mailspring email client customisations

Source repository for the custom Mailspring plugin and Midnight theme.

## Packages

| Package | Version | Contents |
| --- | --- | --- |
| Today + Actions | 0.1.13 | Month calendar, daily meetings and rooms, join links, Google Calendar meeting drafts, email-linked actions, reminders and snooze, grouped email list, draggable meetings divider, collapsible mailbox icon rail with coloured labels, and currency/timezone converters below the email reader. |
| Midnight | 1.0.4 | Dark app surfaces, readable email bodies, original-colour fallback, selection styling, readable composer/signature preview, and collapsible quoted history. |

## Install

Download this repository and extract it. In Mailspring, choose Developer → Install a Plugin… and select `plugins/aswin-today-actions`. Install the `themes/aswin-midnight` folder through the theme/plugin installer, then choose Midnight under Preferences → Appearance.

Reload the main Mailspring window after updating an existing installation.

## Verify

Requires Node.js 20 or later. No npm dependencies are needed for the unit tests.

```sh
npm test
```

The current snapshot passes 52 plugin tests and 9 theme tests, plus 13 real-browser quoted-history checks. The icon rail, label selection and expansion were checked in Mailspring 1.26.0 on macOS. The scrollbar refinement compiles with Midnight variables.

## Data

This repository contains software source, tests and a synthetic theme preview. It contains no mailbox database, saved actions, account settings or credentials. Actions are stored in the existing local Mailspring configuration directory. Notifications require Mailspring to be running; missed reminders are checked when it reopens. Google Meet creation and room booking use the full Google Calendar browser editor.

Mailspring's app source and bundled dependencies are referenced by the plugin at runtime and are not duplicated here. This is the custom extension source, not a fork of Mailspring itself.
