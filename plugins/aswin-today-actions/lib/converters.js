'use strict';
const CURRENCIES = ['SGD', 'USD', 'EUR', 'GBP', 'MYR', 'AUD', 'NZD', 'JPY', 'CNY', 'HKD', 'THB', 'IDR', 'INR', 'KRW', 'PHP', 'TWD', 'VND', 'CHF', 'CAD', 'AED'];
const COMMON_ZONES = ['Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'UTC'];
function timezones() {
  return [...new Set([...COMMON_ZONES, ...(Intl.supportedValuesOf?.('timeZone') || [])])];
}
function amountValue(value) {
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(String(value).trim())) throw new Error('Enter a valid amount, such as 1000 or 1,000.50.');
  const amount = Number(String(value).trim().replaceAll(',', ''));
  if (!Number.isFinite(amount) || Math.abs(amount) > 1e12) throw new Error('Use an amount up to 1 trillion.');
  return amount;
}
function currencyResult(value, rate) {
  const amount = amountValue(value) * rate.rate;
  if (!Number.isFinite(amount)) throw new Error('Amount is too large.');
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: rate.quote }).resolvedOptions().maximumFractionDigits;
  return `${new Intl.NumberFormat('en', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount)} ${rate.quote}`;
}
function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00Z`)) &&
    new Date(`${value}T00:00Z`).toISOString().slice(0, 10) === value;
}
async function fetchRate(base, quote, signal, fetcher = globalThis.fetch) {
  if (!CURRENCIES.includes(base) || !CURRENCIES.includes(quote)) throw new Error('Choose a supported currency.');
  if (base === quote) return { base, quote, rate: 1, date: null };
  const response = await fetcher(`https://api.frankfurter.dev/v2/rate/${base}/${quote}`, { signal, credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw new Error('Rates unavailable. Check your connection and try again.');
  const rate = await response.json();
  if (rate.base !== base || rate.quote !== quote || !validDay(rate.date) || typeof rate.rate !== 'number' || !Number.isFinite(rate.rate) || rate.rate <= 0)
    throw new Error('The rate service returned an invalid result. Try again.');
  return { base, quote, rate: rate.rate, date: rate.date };
}
function zoneParts(instant, zone) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}
function wallTime(instant, zone) {
  const p = zoneParts(instant, zone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function zoneOffset(instant, zone) {
  return Date.parse(`${wallTime(instant, zone)}Z`) - instant;
}
function zonedInstants(value, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validDay(value.slice(0, 10)) ||
      Number(value.slice(11, 13)) > 23 || Number(value.slice(14)) > 59)
    throw new Error('Choose a valid date and time.');
  const wall = Date.parse(`${value}Z`);
  // Sample both sides of a transition, then round-trip to reject missing or repeated wall times.
  const offsets = new Set([-48, -24, 0, 24, 48].map(hours => zoneOffset(wall + hours * 3600000, zone)));
  return [...offsets].map(offset => wall - offset).filter(instant => wallTime(instant, zone) === value).sort((a, b) => a - b);
}
function timezoneResult(value, source, target, occurrence = '') {
  const instants = zonedInstants(value, source);
  if (!instants.length) throw new Error('This time does not exist because the clocks move forward. Choose another time.');
  if (instants.length > 1 && !['earlier', 'later'].includes(occurrence))
    throw new Error('This time occurs twice when the clocks move back. Choose the earlier or later occurrence.');
  const instant = occurrence === 'later' ? instants[instants.length - 1] : instants[0];
  const minutes = zoneOffset(instant, target) / 60000;
  const magnitude = Math.abs(minutes);
  const offset = `UTC${minutes < 0 ? '−' : '+'}${String(Math.floor(magnitude / 60)).padStart(2, '0')}:${String(magnitude % 60).padStart(2, '0')}`;
  return { instant, local: wallTime(instant, target), offset };
}
function localNow(zone) { return wallTime(Math.floor(Date.now() / 60000) * 60000, zone); }
module.exports = { CURRENCIES, timezones, amountValue, currencyResult, fetchRate, zonedInstants, timezoneResult, localNow };
