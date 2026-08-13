/**
 * Market ticker helpers.
 * HKEX codes are 1–4 digit numbers (zero-padded to 4) with a `.HK` suffix.
 */

/** If input is a bare 1–4 digit code, treat it as a Hong Kong stock. */
export function toHkTickerIfNumeric(raw: string): string {
  const t = String(raw || '').trim().toUpperCase().replace(/^\$/, '');
  if (!t) return t;

  if (t.endsWith('.HK')) {
    const num = t.slice(0, -3);
    if (/^\d{1,4}$/.test(num)) return `${num.padStart(4, '0')}.HK`;
    return t;
  }

  // Exactly / up to 4 digits → Hong Kong (e.g. 700 → 0700.HK, 9988 → 9988.HK)
  if (/^\d{1,4}$/.test(t)) {
    return `${t.padStart(4, '0')}.HK`;
  }

  return t;
}
