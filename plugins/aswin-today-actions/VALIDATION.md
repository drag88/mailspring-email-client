# Today + Actions 0.1.15 validation

Validated on **22 October 2026** against **Mailspring 1.26.0 on macOS Apple Silicon**. Midnight remains at 1.0.4.

## Automated checks

- All 68 repository unit tests pass: 59 plugin tests and 9 theme tests.
- The packaged browser check covers six dynamic meeting-height cases and five scrolling cases. It exercises empty, short and busy lists, Actions visibility, window resizing, scrolling within long lists and scrolling onward at either end.
- The native React/calendar harness checks the Extras menu choices, current checked states, Tools visibility across reloads, meeting height limits and existing action/reminder behavior. This development harness uses the installed app bundle and is not packaged as a portable test. Its unrelated mailbox and Mac-menu integrations are mocked or unavailable.
- Runtime JavaScript syntax and light/dark LESS compilation pass. The repository has no configured lint or typecheck command.

## Live application checks

Extras replaces the three separate toolbar controls and sits beside the native contact-panel icon. Each menu choice was switched off and on in Mailspring. Enter and Space open the menu; Escape dismisses it and returns focus. Tools remains hidden after reload when disabled.

Short meeting lists no longer reserve a large blank area. Longer lists scroll within the saved limit or 35% of the window height. Scrolling down to Actions, back to the calendar, and dragging the outer scrollbar were checked. The compact Actions layout was also checked at 300px, 400px and 460px widths in light and dark styles; the synthetic three-action layout used about 19–20% less height than before.

Saved actions remained byte-for-byte unchanged during the live checks. No email was sent and no calendar event was changed. Real mailbox captures are excluded from the repository and release packages.

## Remaining limits

The separate Mac menu-bar icon issue from 0.1.14 remains unresolved. This release does not add automatic plugin updates. The existing installer and manual reload remain the update path. Hiding Tools clears its current inputs and results. Grouped mail continues to reset to enabled when the plugin starts. The converter and quoted-history browser suites were last run for 0.1.13 and were not repeated for this release.

---

# Today + Actions 0.1.14 validation

Validated on **16 October 2026** against **Mailspring 1.26.0 on macOS Apple Silicon**. Midnight remains at 1.0.4.

## Current checks

- All 68 repository unit tests passed: 59 plugin tests and 9 theme tests.
- Syntax checks passed for runtime JavaScript, and `git diff --check` passed.
- New tests cover all-account inbox totals, zero and unavailable counts, ongoing/upcoming/all-day events, cancellations, declines, day rollover, supported meeting links, tray replacement, tooltip updates and cleanup.
- The cleanup regression first failed when unloading replaced the tray. It now requires the same status item after unload and checks native menu callbacks in the main process.
- Independent reviews found two lifecycle/tooltip issues, which were fixed. The focused cleanup review found no remaining blockers.

## Live application limits

The plugin loaded in Mailspring. Native checks confirmed a live tray object, a non-empty icon image, an unread title and the native menu contents. Reload cleanup now preserves the existing tray. Installed runtime files matched the reviewed source before release metadata updates.

The user still could not see the icon. Native bounds initially overlapped the camera notch. After freeing menu-bar space, the reported position cleared the notch, but the user still reported the icon missing. The cause is therefore not fully established. Real popup clicks and visible meeting rows were not verified. This release does not claim to fix the missing-icon symptom.

No mailbox or calendar data was included in repository files or release assets. The menu uses the existing synced calendars and local inbox-count stores. Browser and stylesheet checks from 0.1.13 below were not rerun for this metadata-only release preparation.

---

# Today + Actions 0.1.13 validation

Validated on **14 October 2026** against **Mailspring 1.26.0 / 3b46a5b1 on macOS Apple Silicon**. The release retains Midnight 1.0.4 and the existing local action format.

## Automated checks

| Check | Result |
| --- | --- |
| Repository unit suite | 61 passed: 52 plugin tests and 9 theme tests. |
| Converter browser interactions | 10 passed, including date rollover, DST gaps, explicit repeated-hour selection, collapse/tab behavior, grouped decimal amounts, observation-date display, swap invalidation and narrow-width overflow. |
| Quoted-history browser checks | 13 passed for Midnight 1.0.4. |
| Native integration | Bundled React/calendar harness passed, including converter registration, activation/deactivation cleanup, exclusion from the calendar window and existing action, reminder and meeting behavior. |
| Styles and syntax | Light/dark LESS compilation and syntax checks for all 19 runtime JavaScript files passed. |
| Independent code review | No actionable defects found. |

Currency unit checks cover grouped and negative amounts, invalid input, currency minor units, same-currency offline behavior, rate payload validation, changed-input cancellation, request supersession and unmount cleanup. Timezone checks cover winter/summer offsets and missing/repeated times in New York and Lord Howe.

The converter previews were visually checked at 1440×900 and 390×844. The development harnesses use the installed application bundle and synthetic fixtures; they are not packaged as portable repository tests. No lint or typecheck command is configured.

## Live application checks

Version 0.1.13 was installed and reloaded in Mailspring. With an email open, Tools appeared below the reader while the right calendar/actions pane remained visible. The latest reply, signature and quoted-history disclosure remained visible.

A live conversion of 100 SGD returned 78.13 USD using a rate of 0.78126 dated 2026-10-14. The saved action-file SHA-256 was unchanged. Installed plugin files matched the release source.

Live timezone interaction stopped when user activity was detected. Its calculations and controls were checked through unit tests, native React rendering and browser interaction tests. Live list and splitVertical layouts were not switched; both use the shared native MessageList location.

No calendar meeting, action or reminder was edited for validation, and no email was sent. A shortcut briefly opened a blank reply draft; that generated draft was immediately removed. Real-mailbox screenshots were inspected internally and are excluded from the repository and downloads.

## Operating limits

- Different-currency rates require internet. Rates are indicative daily observations, exclude fees and may be older on non-publication days.
- Timezone conversion and same-currency arithmetic work offline. Timezone rules follow the installed app runtime.
- Converter inputs, results and collapsed state are session-only.
- Calendar, grouped-mail and reader integrations may need changes after a Mailspring update.

Earlier evidence is retained in [historical validation through 0.1.12](docs/archive/validation-through-0.1.12.md). See the [changelog](CHANGELOG.md) for release history.
