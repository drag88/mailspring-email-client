# Midnight 1.0.4 validation

Validated on **14 October 2026** against **Mailspring 1.26.0 on macOS**. Earlier palette and native loading checks were recorded on 12 October 2026.

## Current checks

- Nine reader lifecycle and colour-repair unit tests passed in the repository's 61-test suite.
- Thirteen real-browser checks passed for quoted-history recognition, nested blocks, trailing signatures, inline replies, ordinary quotations, quote-only messages, repeated application, native-expanded history, reader integration and cleanup.
- The retained 1.0.4 theme source matched the installed package before the converter update. Live inspection confirmed that the latest reply, signature and **Show quoted history** control remained visible alongside the new Tools panel.
- Independent review of the release found no actionable defects.

The browser checks use synthetic messages. The theme changes rendered documents only; saved email contents are preserved.

## Earlier evidence

Native theme loading, unloading, original-colour fallback, stylesheet compilation, colour contrast and live palette checks are retained in [version 1.0.2 validation](docs/archive/validation-1.0.2.md). Those observations are dated and do not imply that every check was repeated for 1.0.4.

## Coverage limits

The quoted-history fallback handles recognised HTML quote blocks with email markers. Ordinary unmarked quotations, quote-only messages and unrecognised plain-text history remain visible. The fallback runs while Midnight is selected.

Complex newsletters, unusual tables and pop-out windows were not individually retested in the live application for this release. Use the native original-colour toggle when a message needs its sender's exact presentation. Future Mailspring versions may change the rendering APIs.
