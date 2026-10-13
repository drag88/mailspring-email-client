# Midnight 1.0.2 validation

Date: 12 October 2026. Target: installed macOS Mailspring 1.26.0.

## Passed

- Nine unit tests: idempotent activation/deactivation, registration cleanup, prior reading-mode restoration, user-choice preservation, original-colour fallback, document deduplication and weak references, failed configuration cleanup, and reversible sender inline important colours without clobbering later extension changes; original-colour contrast repair for light and dark sender panels; canonical CSS colour restoration.
- Native Package activation loads the theme's three LESS files and activates its reader extension. Deactivation removes both styles and extension. No copied host code or dependencies are included in the package.
- Native EmailFrameStylesStore forwards the theme's email-frame.less and removes its parent-frame marker. Its dark-mode inversion is overridden inside rendered documents, while its light-mode toggle replaces the dark styling with a readable light canvas and reversible foreground repair.
- All theme LESS compiles. The existing Today + Actions stylesheet compiles against the new palette and resolves the intended foreground/background values.
- Contrast ratios: email body 12.79:1; secondary text 8.57:1; muted text 6.66:1; links 9.16:1; read-row text 10.63:1; read snippets 7.70:1; unread 13.51:1; selected 10.88:1; emphasis buttons 10.29:1; table headings 11.17:1.
- The colour treatment leaves images uninverted and does not edit stored message content. Synthetic preview only; no real mailbox data was used in fixtures.

## Live checks

Version 1.0.2: source styles and package version matched the installed package after the update. A window reload visibly applied the rounded Inbox highlight, sharper sidebar icons, selected Grouped mail toggle, blue calendar-date selection and transparent New meeting area. Selecting October 13 moved the highlight and left October 12 separately marked as today; Today restored October 12. Selecting Done moved the action-filter highlight and showed readable native blue checked checkboxes; Due was restored. Only view selections changed. No action, reminder or email content was modified. Keyboard focus is scoped to the immediate sidebar row in CSS; keyboard traversal through nested folders was not separately exercised.

The initial control discovery omitted the direct Computer tool. A direct Mailspring call subsequently succeeded. With user approval, the theme was installed through Mailspring's plugin installer and selected in the theme picker. The first live original-colour check exposed pale text on white; version 1.0.1 corrects this with a light reading canvas and reversible contrast repair. The corrected version was installed, the window reloaded, and runtime files matched the workspace. Live screenshots confirmed the charcoal palette, readable read/unread/selected rows and date headers, matching calendar/actions pane, dark email text, original dashboard-image colours, and clear black text/blue links when the native light-mode toggle was selected. Dark mode was restored at the end. No emails were sent, starred, archived or deleted, and no action/reminder was changed. Screenshots of real mailbox data were used only for internal inspection and were not saved in the package. The static design board is illustrative. Headless Chromium remained blocked by macOS process restrictions.

The live check covered a dashboard HTML email with an image and text. Complex newsletters, unusual tables and pop-out windows were not individually exercised in the live app. Confirm the month calendar, Actions and grouped mail headings retain their layout. Use the original-colour toggle for messages whose branded backgrounds or charts need their exact sender presentation.
