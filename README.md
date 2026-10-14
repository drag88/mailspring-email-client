# Mailspring customisations

Calendar, email-linked actions and conversion tools for Mailspring, with a matching Midnight theme.

Tested with **Mailspring 1.26.0 on macOS**. Download the packages from the [v0.1.13 release](https://github.com/drag88/mailspring-email-client/releases/tag/v0.1.13).

## Packages

| Package | Version | Purpose |
| --- | --- | --- |
| [Today + Actions](plugins/aswin-today-actions/README.md) | 0.1.13 | Calendar and actions in the right pane; currency and timezone tools below the email reader; grouped mail and a collapsible mailbox sidebar. |
| [Midnight](themes/aswin-midnight/README.md) | 1.0.4 | Charcoal app styling, readable email colours and collapsible quoted history. |

The packages extend the existing Mailspring app. They can be installed separately.

## Install or update

1. Download and extract [Today + Actions](https://github.com/drag88/mailspring-email-client/releases/download/v0.1.13/aswin-today-actions-0.1.13.zip). In Mailspring, choose **Developer → Install a Plugin…** and select the extracted `aswin-today-actions` folder containing `package.json`.
2. To use Midnight, download and extract the [theme package](https://github.com/drag88/mailspring-email-client/releases/download/v0.1.13/aswin-midnight-1.0.4.zip). Install `aswin-midnight` through the same installer, then choose **Preferences → Appearance → Change Theme… → Midnight — Aswin**.
3. Choose **Developer → Reload** after updating. If a package does not appear, quit and reopen Mailspring.

Installation requires no terminal commands or build step. Existing local actions and reminder schedules are retained. Updates are installed manually.

If using a source checkout, select `plugins/aswin-today-actions` and `themes/aswin-midnight` instead of the extracted download folders.

## Features

- **Calendar and meetings:** month navigation, daily agenda, room details, meeting links, compact rows and a resizable meeting list. **New meeting** opens a Google Calendar draft for guests, Google Meet and room booking.
- **Actions and reminders:** create standalone or email-linked actions with an owner, due date, notes and optional reminders. Open the source email, complete actions or snooze reminders.
- **Mail organisation:** group email into Needs action / follow-up, Starred, Today, Yesterday and Earlier. Collapse the mailbox sidebar to an icon rail while retaining native folder controls.
- **Currency:** choose from 20 common currencies and convert using a dated, indicative daily rate. Different-currency conversion requires internet; only currency codes are sent to Frankfurter.
- **Timezone:** convert a selected date and time offline, including date rollover and daylight-saving changes. Missing times are rejected; repeated times require an explicit choice.
- **Email reading:** Midnight provides dark and original-colour views. Supported quoted history folds behind **Show quoted history**, while the latest reply and signature remain visible.

See the package guides for controls, storage, uninstall instructions and limitations.

## Privacy and limitations

Actions are stored locally in `~/Library/Application Support/Mailspring/today-actions/actions.json`, with a previous-file backup. They do not sync between Macs. Action ownership is a personal label and does not notify another person. Reminders require Mailspring's main window to be loaded; missed reminders are checked when it reopens.

Currency amounts and mailbox data stay on the Mac. Conversion rates exclude bank fees, may be older on non-publication days and are approximate. Converter inputs and results last for the current session.

The theme changes displayed email content; it does not rewrite saved messages. Calendar visibility follows calendars already synced by Mailspring. Google Calendar handles meeting creation and room booking.

Some integrations use Mailspring's internal APIs, so future app updates may require compatibility changes. The repository contains source, tests and synthetic previews. It contains no mailbox database, saved actions, account settings or credentials.

## Development and verification

Use Node.js 20 or later. The unit tests require no dependency installation:

```sh
npm test
```

To run the quoted-history browser checks, install Vercel Agent Browser and run:

```sh
npm --prefix themes/aswin-midnight run test:browser
```

The current packages passed 61 unit tests, 10 converter browser interaction checks and 13 quoted-history browser checks. Native React/calendar integration, light/dark stylesheet compilation and runtime syntax checks also passed. The native integration and converter preview harnesses use the installed Mailspring bundle and are not included in this repository.

See [plugin validation](plugins/aswin-today-actions/VALIDATION.md), [theme validation](themes/aswin-midnight/VALIDATION.md) and the [changelog](plugins/aswin-today-actions/CHANGELOG.md) for dated evidence and coverage limits.
