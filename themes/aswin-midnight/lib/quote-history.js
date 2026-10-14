'use strict';
const SELECTOR = 'blockquote, .gmail_quote, [class*="yahoo_quoted"]';
const CLASS = 'aswin-quoted-history';
const ATTRIBUTION = /^On\s[\s\S]{0,700}\bwrote:\s*$/i;

function collapseQuoteHistory(document) {
  const root = document.getElementById('inbox-html-wrapper');
  if (!root || root.querySelector(`.${CLASS}`)) return;
  for (const quote of Array.from(root.querySelectorAll(SELECTOR))) {
    if (quote.parentElement.closest(SELECTOR) || quote.closest(`.${CLASS}`)) continue;
    let start = quote, text = '';
    for (let node = quote.previousSibling; node; node = node.previousSibling) {
      text = node.textContent + text;
      if (text.length > 700) break;
      if (ATTRIBUTION.test(text.trim())) { start = node; break; }
    }
    // Fold email history only; ordinary quotations and quote-only messages stay readable.
    if (start === quote && !quote.matches('[type="cite"], .gmail_quote, [class*="yahoo_quoted"]')) continue;
    const before = document.createRange();
    before.selectNodeContents(root); before.setEndBefore(start);
    if (!before.toString().trim()) continue;
    const range = document.createRange();
    range.setStartBefore(start); range.setEndAfter(quote);
    const details = document.createElement('details'); details.className = CLASS;
    const summary = document.createElement('summary'); summary.textContent = 'Show quoted history';
    summary.style.cssText = 'cursor:pointer;padding:8px 0;font:inherit;opacity:.8;';
    details.appendChild(summary); details.appendChild(range.extractContents());
    range.insertNode(details);
    details.addEventListener('toggle', () => {
      summary.textContent = details.open ? 'Hide quoted history' : 'Show quoted history';
    });
  }
}

function restoreQuoteHistory(document) {
  for (const details of document.querySelectorAll?.(`details.${CLASS}`) || []) {
    details.querySelector('summary').remove();
    details.replaceWith(...details.childNodes);
  }
}
module.exports = { collapseQuoteHistory, restoreQuoteHistory };
