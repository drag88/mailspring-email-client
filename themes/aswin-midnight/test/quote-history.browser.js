// Run in a real browser with lib/quote-history.js loaded.
async function testQuoteHistory() {
  const results = [];
  const check = (value, message) => { if (!value) throw new Error(message); };
  const fixture = html => {
    document.body.innerHTML = `<div id="inbox-html-wrapper">${html}</div>`;
    return document.getElementById('inbox-html-wrapper');
  };
  const run = (name, html, verify) => {
    const root = fixture(html), original = root.innerHTML;
    collapseQuoteHistory(document); verify(root);
    restoreQuoteHistory(document); check(root.innerHTML === original, `${name}: restoration changed content`);
    results.push(name);
  };
  run('reply and trailing signature stay visible', '<p>Latest reply</p><div>On Oct 14, Alex &lt;<a>a@example.test</a>&gt; wrote:</div><blockquote>Old reply<blockquote>Older reply</blockquote></blockquote><p>Best regards, Me</p>', root => {
    const details = root.querySelector('details');
    check(details && !details.open, 'history must start collapsed');
    check(details.textContent.includes('On Oct 14') && details.textContent.includes('Older reply'), 'attribution and nested history must be folded');
    check(root.firstElementChild.textContent === 'Latest reply' && root.lastElementChild.textContent === 'Best regards, Me', 'latest reply and signature must remain outside history');
  });
  run('split attribution nodes', 'Latest reply<br>On Oct 14, Alex &lt;<a>a@example.test</a>&gt; wrote:<br><blockquote type="cite">Old reply</blockquote>', root => {
    check(root.querySelector('details').textContent.includes('On Oct 14'), 'split attribution must be folded');
    check(root.firstChild.textContent === 'Latest reply', 'latest text must remain');
  });
  run('gmail quote wrapper', '<p>Latest reply</p><div class="gmail_quote">On Oct 14 Alex wrote:<blockquote>Old reply</blockquote></div>', root => check(root.querySelectorAll('details').length === 1, 'nested quotes must share one disclosure'));
  run('inline answers preserved', '<p>Latest reply</p><blockquote type="cite">Question one</blockquote><p>Answer one</p><blockquote type="cite">Question two</blockquote><p>Answer two</p>', root => {
    check(root.querySelectorAll('details').length === 2, 'both quoted sections should fold');
    check(Array.from(root.children).filter(el => el.tagName === 'P').map(el => el.textContent).join('|') === 'Latest reply|Answer one|Answer two', 'inline answers must remain visible');
  });
  run('ordinary quotation is preserved', '<p>Latest reply</p><blockquote>A quotation used in the current message</blockquote>', root => check(!root.querySelector('details'), 'ordinary quotes must remain visible'));
  run('quote-only message is preserved', '<blockquote type="cite">The entire message</blockquote>', root => check(!root.querySelector('details'), 'quote-only message must remain visible'));
  run('unquoted email is preserved', '<p>Just a message</p>', root => check(!root.querySelector('details'), 'no disclosure for unquoted message'));
  run('repeat application retains expanded state', '<p>Latest reply</p><blockquote type="cite">Old reply</blockquote>', root => {
    const details = root.querySelector('details'); details.open = true; collapseQuoteHistory(document);
    check(details.open && root.querySelectorAll('details').length === 1, 'reapplying must retain expanded state');
  });
  fixture('<p>Latest reply</p><blockquote type="cite">Old reply</blockquote>'); collapseQuoteHistory(document);
  const details = document.querySelector('details'); details.open = true;
  await new Promise(resolve => details.addEventListener('toggle', resolve, { once: true }));
  check(details.querySelector('summary').textContent === 'Hide quoted history', 'expanded control label');
  results.push('expand changes control label');
  details.open = false;
  await new Promise(resolve => details.addEventListener('toggle', resolve, { once: true }));
  check(details.querySelector('summary').textContent === 'Show quoted history', 'collapsed control label');
  results.push('collapse changes control label');
  return results;
}

function testReaderQuoteHistory(DarkReader) {
  const registrations = new Set();
  let recognised = true;
  const api = { QuotedHTMLTransformer: { hasQuotedHTML: () => recognised },
    ExtensionRegistry: { MessageView: { register: e => registrations.add(e), unregister: e => registrations.delete(e) } } };
  const config = { get: () => 'dark', onDidChange: () => ({ dispose() {} }) };
  const reader = new DarkReader(api, { config }, ''); reader.start();
  document.body.innerHTML = '<div id="inbox-html-wrapper"><p>Latest reply</p><blockquote type="cite">Old reply</blockquote><p>Signature</p></div>';
  const original = document.getElementById('inbox-html-wrapper').innerHTML;
  const message = { body: original }; const stored = JSON.stringify(message);
  reader.extension.renderedMessageBodyIntoDocument({ document, message });
  if (document.querySelector('details')) throw new Error('Native expanded history must remain expanded');
  recognised = false; reader.extension.renderedMessageBodyIntoDocument({ document, message });
  if (!document.querySelector('details')) throw new Error('Unrecognised history must collapse');
  reader.stop();
  if (document.getElementById('inbox-html-wrapper').innerHTML !== original || registrations.size || JSON.stringify(message) !== stored)
    throw new Error('Reader cleanup must restore DOM and preserve saved message');
  return ['native quote expansion respected', 'reader fallback integration', 'deactivation restores history and saved message is unchanged'];
}
