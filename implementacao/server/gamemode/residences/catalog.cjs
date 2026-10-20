'use strict';
const { createHash } = require('node:crypto');
const { fail, integer } = require('./errors.cjs');
function descriptor(value) {
  if (typeof value !== 'string') fail('INVALID');
  const match = /^([a-f0-9]{1,6}):([^:\/\\\r\n]+\.(?:esm|esp|esl))$/i.exec(value);
  if (!match || parseInt(match[1], 16) === 0) fail('INVALID');
  return `${parseInt(match[1], 16).toString(16)}:${match[2].toLowerCase()}`;
}
function validateCatalog(input) {
  if (!Array.isArray(input) || input.length > 1000) fail('INVALID');
  const ids = new Set(), refs = new Set();
  return input.map(raw => {
    if (!raw || typeof raw.id !== 'string' || !/^[a-z0-9_-]{1,48}$/.test(raw.id) || ids.has(raw.id) ||
        typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100 ||
        !integer(raw.revision) || typeof raw.forSale !== 'boolean' ||
        !Array.isArray(raw.refs) || raw.refs.length < 2 || raw.refs.length > 64) fail('INVALID');
    ids.add(raw.id);
    const prices = {};
    if (!raw.prices || Object.keys(raw.prices).some(k => !['septims', 'diademas'].includes(k))) fail('INVALID');
    for (const currency of ['septims', 'diademas']) {
      if (raw.prices[currency] === undefined || raw.prices[currency] === null) continue;
      if (!integer(raw.prices[currency])) fail('INVALID');
      prices[currency] = raw.prices[currency];
    }
    if (raw.forSale && !Object.keys(prices).length) fail('INVALID');
    const entries = raw.refs.map(ref => {
      if (!ref || !['entry', 'exit', 'container'].includes(ref.kind)) fail('INVALID');
      const desc = descriptor(ref.desc);
      if (refs.has(desc)) fail('INVALID');
      refs.add(desc);
      return { desc, kind: ref.kind, ...(ref.kind === 'container' ? {} : { partner: descriptor(ref.partner) }) };
    }).sort((a, b) => a.desc.localeCompare(b.desc));
    if (!entries.some(r => r.kind === 'entry')) fail('INVALID');
    for (const ref of entries.filter(r => r.kind !== 'container')) {
      const partner = entries.find(r => r.desc === ref.partner);
      if (!partner || partner.partner !== ref.desc || partner.kind === ref.kind || partner.kind === 'container') fail('INVALID');
    }
    const definition = { id: raw.id, name: raw.name.trim(), revision: raw.revision, forSale: raw.forSale, prices, refs: entries };
    return { ...definition, hash: createHash('sha256').update(JSON.stringify(definition)).digest('hex') };
  });
}
module.exports = { descriptor, validateCatalog };
