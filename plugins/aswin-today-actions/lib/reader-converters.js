'use strict';
const { CURRENCIES, timezones, amountValue, currencyResult, fetchRate, zonedInstants, timezoneResult, localNow } = require('./converters');

function createReaderConverters(React) {
  const h = React.createElement;
  const zones = timezones();
  const field = (label, child) => h('label', null, h('span', null, label), child);
  const select = (label, value, values, onChange) => field(label,
    h('select', { value, onChange: e => onChange(e.target.value) }, values.map(item => h('option', { key: item, value: item }, item.replaceAll('_', ' ')))));
  class ReaderConverters extends React.Component {
    constructor(props) {
      super(props);
      this.state = { collapsed: false, tab: 'currency', amount: '100', base: 'SGD', quote: 'USD',
        result: null, loading: false, error: '', source: 'Asia/Singapore', target: 'Europe/London',
        time: localNow('Asia/Singapore'), occurrence: '' };
      this.sequence = 0;
    }
    componentWillUnmount() { this.cancelRequest(); }
    cancelRequest() {
      this.sequence++;
      this.controller?.abort();
      this.controller = null;
      clearTimeout(this.timeout);
    }
    changeCurrency(fields) {
      this.cancelRequest();
      this.setState({ ...fields, result: null, error: '', loading: false });
    }
    async convert() {
      this.cancelRequest();
      const sequence = this.sequence;
      const { amount, base, quote } = this.state;
      try { amountValue(amount); }
      catch (error) { this.setState({ error: error.message, result: null }); return; }
      const controller = new AbortController();
      this.controller = controller;
      this.timeout = setTimeout(() => controller.abort(), 15000);
      this.setState({ loading: true, error: '', result: null });
      try {
        const rate = await fetchRate(base, quote, controller.signal);
        if (sequence === this.sequence) this.setState({ result: { text: currencyResult(amount, rate), rate }, loading: false });
      } catch (error) {
        if (sequence === this.sequence) this.setState({ loading: false,
          error: error.name === 'AbortError' ? 'Rate request timed out. Try again.' : error.message || 'Rates unavailable. Try again.' });
      } finally {
        if (sequence === this.sequence) { clearTimeout(this.timeout); this.controller = null; }
      }
    }
    currency() {
      const { amount, base, quote, result, loading, error } = this.state;
      return h('div', { className: 'taa-converter-body' },
        h('form', { onSubmit: e => { e.preventDefault(); this.convert(); }, className: 'taa-converter-fields' },
          field('Amount', h('input', { type: 'text', inputMode: 'decimal', value: amount, maxLength: 24,
            onChange: e => this.changeCurrency({ amount: e.target.value }) })),
          select('From currency', base, CURRENCIES, base => this.changeCurrency({ base })),
          h('button', { type: 'button', className: 'taa-converter-swap', 'aria-label': 'Swap currencies',
            onClick: () => this.changeCurrency({ base: quote, quote: base }) }, '⇄'),
          select('To currency', quote, CURRENCIES, quote => this.changeCurrency({ quote })),
          h('button', { type: 'submit', disabled: loading }, loading ? 'Getting rate…' : 'Convert')),
        h('div', { className: 'taa-converter-output', role: 'status', 'aria-live': 'polite' },
          error ? h('span', { className: 'taa-converter-error' }, error) : result ?
            h(React.Fragment, null, h('strong', null, result.text), h('span', null, result.rate.date ?
              `1 ${base} = ${result.rate.rate} ${quote} · Rate dated ${result.rate.date} · Frankfurter` : 'Same currency · No exchange needed')) :
            h('span', null, 'Click Convert to get an indicative daily rate.')),
        h('p', { className: 'taa-converter-note' }, 'Rates exclude bank fees. Only currency codes are sent to Frankfurter; your amount stays on this Mac.'));
    }
    timezone() {
      const { source, target, time, occurrence } = this.state;
      let result, error = '', repeated = false;
      try { repeated = zonedInstants(time, source).length > 1; result = timezoneResult(time, source, target, occurrence); }
      catch (e) { error = e.message; }
      const change = fields => this.setState({ ...fields, occurrence: '' });
      return h('div', { className: 'taa-converter-body' },
        h('div', { className: 'taa-converter-fields' },
          field('Date and time', h('input', { type: 'datetime-local', value: time, onChange: e => change({ time: e.target.value }) })),
          select('From timezone', source, zones, source => change({ source })),
          h('button', { type: 'button', className: 'taa-converter-swap', 'aria-label': 'Swap timezones', disabled: !result,
            onClick: () => change({ source: target, target: source, time: result.local }) }, '⇄'),
          select('To timezone', target, zones, target => this.setState({ target })),
          h('button', { type: 'button', onClick: () => change({ time: localNow(source) }) }, 'Now')),
        repeated ? select('Repeated time', occurrence, ['', 'earlier', 'later'], occurrence => this.setState({ occurrence })) : null,
        h('div', { className: 'taa-converter-output', role: 'status', 'aria-live': 'polite' }, error ?
          h('span', { className: 'taa-converter-error' }, error) :
          h(React.Fragment, null, h('strong', null, result.local.replace('T', ' · ')), h('span', null, `${target.replaceAll('_', ' ')} · ${result.offset}`))),
        h('p', { className: 'taa-converter-note' }, 'Uses the selected date, including daylight-saving changes. Works offline.'));
    }
    render() {
      const { collapsed, tab } = this.state;
      return h('section', { className: 'taa-converters', 'aria-label': 'Currency and timezone converters' },
        h('div', { className: 'taa-converter-header' },
          h('button', { type: 'button', className: 'taa-converter-collapse', 'aria-expanded': !collapsed,
            'aria-label': collapsed ? 'Expand converters' : 'Collapse converters',
            onClick: () => this.setState({ collapsed: !collapsed }) }, collapsed ? '▸ Tools' : '▾ Tools'),
          h('div', { role: 'group', 'aria-label': 'Choose a converter' }, ...[['currency', 'Currency'], ['timezone', 'Timezone']].map(([key, label]) =>
            h('button', { key, type: 'button', 'aria-pressed': tab === key, className: tab === key ? 'active' : '',
              onClick: () => this.setState({ tab: key, collapsed: false }) }, label)))),
        collapsed ? null : tab === 'currency' ? this.currency() : this.timezone());
    }
  }
  ReaderConverters.displayName = 'AswinReaderConverters';
  ReaderConverters.containerRequired = false;
  return ReaderConverters;
}
module.exports = { createReaderConverters };
