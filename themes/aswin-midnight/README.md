# Midnight — Aswin

A charcoal Mailspring theme with readable dark emails, neutral date sections and a matching Today + Actions pane. Built for Mailspring 1.26.0 on macOS.

## Install

1. Extract the ZIP.
2. In Mailspring choose **Developer → Install a Plugin…**, then select the **aswin-midnight** folder containing `package.json`.
3. Open **Preferences → Appearance → Change Theme…** and choose **Midnight — Aswin**.

Selecting the theme also selects dark email reading. The existing “Switch email view to light mode” button restores original sender colours; toggle back to dark to use Midnight’s email colours. If the theme does not appear in the picker immediately, reload Mailspring. No npm install or terminal commands are needed.

The package contains theme JavaScript as well as LESS styles, because a stylesheet alone cannot both replace Mailspring’s inversion-based email mode and preserve its native original-colour toggle. The code uses the native rendered-message extension hook and reads only its own CSS file.

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

No cloud backend, analytics, network client, external fonts or dependencies. The theme changes displayed documents only: stored email bodies, subjects, attachments, links and action files are not rewritten. It does not send messages, mark stars, create events or change Gmail rules.

Selecting the theme sets `core.reading.emailRenderMode` to dark. Switching away unregisters the reader, removes its injected styles, restores any adjusted inline style priorities, and restores the earlier reading mode if the user has not changed it while the theme was active. An explicit reading-mode choice is retained. Removing the theme leaves Today + Actions and its saved actions in place.

## Validation and limits

Nine reader lifecycle and colour-repair tests pass. Checks against the installed native Package and EmailFrameStylesStore implementations cover theme loading, frame CSS forwarding, original-colour fallback and unloading. Today + Actions compiles with the palette. Main text, secondary text, links, snippets, unread rows, selected rows, buttons and table headings all exceed 4.5:1 contrast.

Version 1.0.2 was installed and applied in Mailspring on 12 October 2026. Live checks confirmed rounded folder selection, clear selected dates and action filters, readable checked controls, the active grouped-mail toggle, and the flat New meeting area. Calendar selection moved to the next date and back; the action filter moved to Done and back to Due. Earlier live checks covered dark email text, uninverted dashboard images and the original-colour toggle. The preview remains illustrative rather than a screenshot of a real mailbox.

Future Mailspring versions can change the extension or rendering APIs. Switching to another theme removes the reader integration.

## Development

Run `node --test test/*.test.js`. The source uses the host exports and built-in Node modules without a build step.

## Quoted history

Version 1.0.4 folds email quote blocks that Mailspring does not recognise because of trailing signatures. The latest reply, trailing signature and replies between quoted blocks stay visible. Click **Show quoted history** to expand and **Hide quoted history** to collapse again. Native recognised quotes keep their existing three-dot control. This display fallback is active while Midnight is selected and never changes saved email contents. Ordinary unmarked quotations, quote-only messages and unrecognised plain-text history remain visible.

Run `npm run test:browser` with Vercel Agent Browser available to verify the 13 real-browser quote and reader integration checks.
