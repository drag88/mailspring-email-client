'use strict';
const STYLE_ID = 'aswin-midnight-reader';
const MODE_KEY = 'core.reading.emailRenderMode';
const { ORIGINAL_CSS, repairOriginalColours, restoreOriginalColours } = require('./original-colours');
const { collapseQuoteHistory, restoreQuoteHistory } = require('./quote-history');

class DarkReader {
  constructor(api, appEnv, css, WeakReference = WeakRef) {
    this.api = api; this.appEnv = appEnv; this.css = css; this.WeakReference = WeakReference;
    this.documents = new Set(); this.inlineStyles = new WeakMap(); this.originalRepairs = new WeakMap(); this.active = false; this.userChangedMode = false;
    this.extension = { name: 'AswinMidnightReader', renderedMessageBodyIntoDocument: ({ document, message }) => {
      if (!this.active) return;
      // Discard stale frame documents while retaining only weak references.
      this.sweep();
      if (![...this.documents].some(ref => ref.deref() === document))
        this.documents.add(new this.WeakReference(document));
      this.apply(document);
      // Leave Mailspring's recognised quotes and its native expansion control alone.
      if (message && !this.api.QuotedHTMLTransformer.hasQuotedHTML(message.body || ''))
        collapseQuoteHistory(document);
    } };
  }
  dark() { return this.appEnv.config.get(MODE_KEY) === 'dark'; }
  apply(document) {
    if (!document?.documentElement) return;
    const existing = document.getElementById(STYLE_ID);
    if (!this.active) { existing?.remove(); this.restoreInline(document); restoreOriginalColours(this.originalRepairs.get(document)); this.originalRepairs.delete(document); restoreQuoteHistory(document); return; }
    restoreOriginalColours(this.originalRepairs.get(document)); this.originalRepairs.delete(document);
    if (this.dark()) this.normalizeInline(document);
    else this.restoreInline(document);
    const style = existing || document.createElement('style');
    style.id = STYLE_ID; style.textContent = this.dark() ? this.css : ORIGINAL_CSS;
    if (!existing) (document.head || document.documentElement).appendChild(style);
    if (!this.dark()) this.originalRepairs.set(document, repairOriginalColours(document));
  }
  normalizeInline(document) {
    if (this.inlineStyles.has(document)) return;
    const changes = [];
    const properties = ['color', 'background', 'background-color', 'background-image', 'font', 'font-family',
      'font-size', 'line-height', 'text-shadow', 'box-shadow'];
    for (const element of document.querySelectorAll?.('#inbox-html-wrapper [style]') || []) {
      for (const property of properties) {
        if (element.style.getPropertyPriority(property) !== 'important') continue;
        const value = element.style.getPropertyValue(property);
        changes.push({ element, property, value });
        // Drop only sender importance in this rendered document; stylesheet takes precedence.
        element.style.setProperty(property, value, '');
      }
    }
    this.inlineStyles.set(document, changes);
  }
  restoreInline(document) {
    for (const { element, property, value } of this.inlineStyles.get(document) || []) {
      if (element.style.getPropertyValue(property) === value && !element.style.getPropertyPriority(property))
        element.style.setProperty(property, value, 'important');
    }
    this.inlineStyles.delete(document);
  }
  sweep() {
    for (const ref of this.documents) {
      const document = ref.deref();
      if (!document || document.defaultView?.frameElement?.isConnected === false || !document.documentElement) this.documents.delete(ref);
    }
  }
  update() {
    this.sweep();
    for (const ref of this.documents) this.apply(ref.deref());
  }
  start() {
    if (this.active) return;
    this.previousMode = this.appEnv.config.get(MODE_KEY);
    this.active = true;
    this.api.ExtensionRegistry.MessageView.register(this.extension);
    try {
      // Selecting the dark theme opts into dark reading; native toggle still works.
      if (this.previousMode !== 'dark') this.appEnv.config.set(MODE_KEY, 'dark');
      this.subscription = this.appEnv.config.onDidChange(MODE_KEY, () => {
        this.userChangedMode = true; this.update();
      });
    } catch (error) { this.stop(); throw error; }
  }
  stop() {
    if (!this.active) return;
    this.active = false;
    this.subscription?.dispose(); this.subscription = null;
    this.api.ExtensionRegistry.MessageView.unregister(this.extension);
    for (const ref of this.documents) this.apply(ref.deref());
    this.documents.clear();
    if (!this.userChangedMode && this.dark() && this.previousMode !== 'dark')
      this.appEnv.config.set(MODE_KEY, this.previousMode || 'light');
  }
}
module.exports = { DarkReader, STYLE_ID, MODE_KEY };
