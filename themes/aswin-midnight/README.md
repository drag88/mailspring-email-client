# Midnight — Aswin

Version **1.0.4** · Tested with **Mailspring 1.26.0 on macOS**.

A charcoal Mailspring theme with readable dark emails, neutral date sections and a matching Today + Actions pane.

## Install

1. Download `aswin-midnight-1.0.4.zip` from the [release page](https://github.com/drag88/mailspring-email-client/releases/tag/v0.1.13) and extract it.
2. In Mailspring choose **Developer → Install a Plugin…**, then select the **aswin-midnight** folder containing `package.json`.
3. Open **Preferences → Appearance → Change Theme…** and choose **Midnight — Aswin**.

Selecting the theme also selects dark email reading. The existing “Switch email view to light mode” button restores original sender colours; toggle back to dark to use Midnight’s email colours. If the theme does not appear in the picker immediately, reload Mailspring. No npm install or terminal commands are needed.

## Quoted history

Version 1.0.4 folds email quote blocks that Mailspring does not recognise because of trailing signatures. The latest reply, trailing signature and replies between quoted blocks stay visible. Click **Show quoted history** to expand and **Hide quoted history** to collapse again. Native recognised quotes keep their existing three-dot control. This display fallback is active while Midnight is selected and never changes saved email contents. Ordinary unmarked quotations, quote-only messages and unrecognised plain-text history remain visible.

## Design

- Charcoal app background; slightly lighter email cards; warm white text.
- 14px app text and 15px email text with 1.65 line height.
- Distinct unread, selected and hovered rows. Read emails remain readable rather than fading to low-contrast grey.
- Muted blue links and selection; no gradients or coloured meeting card edges.
- Rounded folder selections with focus kept inside the row, visible date/filter selections, clear toolbar toggles and checked controls. The New meeting area blends into the pane.
- Date/priority headers and Today + Actions use the same theme variables.
- Email text, tables and quotes receive readable theme colours. Photos, logos and image attachments are not inverted. Text inside an image cannot be recoloured independently, so a sender’s white image can remain visible.
- Branded HTML is adapted for reading: sender background colours and background images are suppressed, while normal image elements remain. Use the original-colour toggle for branded layouts, unusual charts or receipts; low-contrast text receives a readability repair.

## Preview

Open `preview.html` in a browser for a self-contained sample with an Original colours / Theme colours toggle. `preview.png` is an illustrative design board, not a screenshot of the user's installed app. All preview content is synthetic. Preview buttons other than the colour toggle are illustrative.

## Privacy and reversibility

The theme makes no network requests and adds no analytics, external fonts or package dependencies. The theme changes displayed documents only: stored email bodies, subjects, attachments, links and action files are not rewritten. It does not send messages, mark stars, create events or change Gmail rules.

Selecting the theme sets `core.reading.emailRenderMode` to dark. Switching away unregisters the reader, removes its injected styles, restores any adjusted inline style priorities, and restores the earlier reading mode if the user has not changed it while the theme was active. An explicit reading-mode choice is retained. Removing the theme leaves Today + Actions and its saved actions in place.

## Validation and limits

Nine reader lifecycle and colour-repair unit tests and 13 quoted-history browser checks passed. See [validation](VALIDATION.md) for current results, dated native/palette evidence and coverage limits.

Future Mailspring versions can change the extension or rendering APIs. Switching to another theme removes the reader integration.

## Development

Run unit tests from the theme directory:

```sh
node --test test/*.test.js
```

With Vercel Agent Browser available, run the 13 quoted-history checks:

```sh
npm run test:browser
```

The source uses host exports and built-in Node modules without a build step. Theme JavaScript uses Mailspring's rendered-message hook to apply email styles and retain its original-colour toggle. It reads only the theme's own CSS file.
