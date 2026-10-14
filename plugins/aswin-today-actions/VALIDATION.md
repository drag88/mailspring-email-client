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
