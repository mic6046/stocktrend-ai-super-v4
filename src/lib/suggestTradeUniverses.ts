/**
 * Curated popular-market universes for Suggest a Trade.
 * Kept modest (≤20 per scout) so Consensus scanning stays within API limits.
 */

export type SuggestMarket = 'US' | 'HK' | 'JP' | 'EU' | 'ALL';
export type SuggestTheme = 'ALL' | 'AI' | 'GROWTH' | 'VALUE' | 'DIVIDEND';

export type UniverseName = {
  ticker: string;
  name: string;
  market: Exclude<SuggestMarket, 'ALL'>;
  themes: Array<Exclude<SuggestTheme, 'ALL'>>;
};

export const SUGGEST_MARKETS: { key: SuggestMarket; label: string }[] = [
  { key: 'US', label: 'United States' },
  { key: 'HK', label: 'Hong Kong' },
  { key: 'JP', label: 'Japan' },
  { key: 'EU', label: 'Europe' },
  { key: 'ALL', label: 'All markets' },
];

export const SUGGEST_THEMES: { key: SuggestTheme; label: string }[] = [
  { key: 'ALL', label: 'All themes' },
  { key: 'AI', label: 'AI / Tech' },
  { key: 'GROWTH', label: 'Growth' },
  { key: 'VALUE', label: 'Value' },
  { key: 'DIVIDEND', label: 'Dividend' },
];

/** Popular liquid names — not recommendations; scout decides BUY eligibility. */
export const POPULAR_UNIVERSE: UniverseName[] = [
  // —— United States ——
  { ticker: 'AAPL', name: 'Apple', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'MSFT', name: 'Microsoft', market: 'US', themes: ['AI', 'GROWTH', 'DIVIDEND'] },
  { ticker: 'NVDA', name: 'NVIDIA', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'GOOGL', name: 'Alphabet', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'AMZN', name: 'Amazon', market: 'US', themes: ['GROWTH'] },
  { ticker: 'META', name: 'Meta Platforms', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'TSLA', name: 'Tesla', market: 'US', themes: ['GROWTH'] },
  { ticker: 'AVGO', name: 'Broadcom', market: 'US', themes: ['AI', 'GROWTH', 'DIVIDEND'] },
  { ticker: 'AMD', name: 'AMD', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'PLTR', name: 'Palantir', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'JPM', name: 'JPMorgan Chase', market: 'US', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'JNJ', name: 'Johnson & Johnson', market: 'US', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'V', name: 'Visa', market: 'US', themes: ['GROWTH', 'DIVIDEND'] },
  { ticker: 'XOM', name: 'Exxon Mobil', market: 'US', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'KO', name: 'Coca-Cola', market: 'US', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'COST', name: 'Costco', market: 'US', themes: ['GROWTH'] },
  { ticker: 'LLY', name: 'Eli Lilly', market: 'US', themes: ['GROWTH'] },
  { ticker: 'BRK-B', name: 'Berkshire Hathaway', market: 'US', themes: ['VALUE'] },
  { ticker: 'CRM', name: 'Salesforce', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'ORCL', name: 'Oracle', market: 'US', themes: ['AI', 'GROWTH', 'DIVIDEND'] },

  // —— Hong Kong ——
  { ticker: '0700.HK', name: 'Tencent', market: 'HK', themes: ['AI', 'GROWTH'] },
  { ticker: '9988.HK', name: 'Alibaba', market: 'HK', themes: ['GROWTH', 'VALUE'] },
  { ticker: '3690.HK', name: 'Meituan', market: 'HK', themes: ['GROWTH'] },
  { ticker: '1810.HK', name: 'Xiaomi', market: 'HK', themes: ['GROWTH', 'AI'] },
  { ticker: '1211.HK', name: 'BYD', market: 'HK', themes: ['GROWTH'] },
  { ticker: '9618.HK', name: 'JD.com', market: 'HK', themes: ['GROWTH', 'VALUE'] },
  { ticker: '9888.HK', name: 'Baidu', market: 'HK', themes: ['AI', 'VALUE'] },
  { ticker: '0005.HK', name: 'HSBC', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '0388.HK', name: 'HKEX', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '1024.HK', name: 'Kuaishou', market: 'HK', themes: ['GROWTH'] },
  { ticker: '2318.HK', name: 'Ping An', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '1299.HK', name: 'AIA Group', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '0939.HK', name: 'China Construction Bank', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '1398.HK', name: 'ICBC', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '2269.HK', name: 'Wuxi Biologics', market: 'HK', themes: ['GROWTH'] },
  { ticker: '2020.HK', name: 'ANTA Sports', market: 'HK', themes: ['GROWTH'] },
  { ticker: '9961.HK', name: 'Trip.com', market: 'HK', themes: ['GROWTH'] },
  { ticker: '2382.HK', name: 'Sunny Optical', market: 'HK', themes: ['GROWTH'] },
  { ticker: '0669.HK', name: 'Techtronic', market: 'HK', themes: ['GROWTH'] },

  // —— Japan ——
  { ticker: '7203.T', name: 'Toyota', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '6758.T', name: 'Sony', market: 'JP', themes: ['GROWTH'] },
  { ticker: '9984.T', name: 'SoftBank Group', market: 'JP', themes: ['AI', 'GROWTH'] },
  { ticker: '6861.T', name: 'Keyence', market: 'JP', themes: ['GROWTH'] },
  { ticker: '8306.T', name: 'Mitsubishi UFJ', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '4063.T', name: 'Shin-Etsu Chemical', market: 'JP', themes: ['GROWTH', 'DIVIDEND'] },
  { ticker: '8035.T', name: 'Tokyo Electron', market: 'JP', themes: ['AI', 'GROWTH'] },
  { ticker: '6857.T', name: 'Advantest', market: 'JP', themes: ['AI', 'GROWTH'] },
  { ticker: '6981.T', name: 'Murata Manufacturing', market: 'JP', themes: ['GROWTH'] },
  { ticker: '4502.T', name: 'Takeda', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '9432.T', name: 'NTT', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '7974.T', name: 'Nintendo', market: 'JP', themes: ['GROWTH'] },
  { ticker: '6098.T', name: 'Recruit Holdings', market: 'JP', themes: ['GROWTH'] },
  { ticker: '6367.T', name: 'Daikin', market: 'JP', themes: ['GROWTH'] },
  { ticker: '7741.T', name: 'Hoya', market: 'JP', themes: ['GROWTH'] },
  { ticker: '6501.T', name: 'Hitachi', market: 'JP', themes: ['AI', 'GROWTH'] },
  { ticker: '7267.T', name: 'Honda', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '8316.T', name: 'Sumitomo Mitsui', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '4568.T', name: 'Daiichi Sankyo', market: 'JP', themes: ['GROWTH'] },
  { ticker: '9983.T', name: 'Fast Retailing', market: 'JP', themes: ['GROWTH'] },

  // —— Europe ——
  { ticker: 'ASML.AS', name: 'ASML', market: 'EU', themes: ['AI', 'GROWTH'] },
  { ticker: 'SAP.DE', name: 'SAP', market: 'EU', themes: ['AI', 'GROWTH'] },
  { ticker: 'MC.PA', name: 'LVMH', market: 'EU', themes: ['GROWTH'] },
  { ticker: 'OR.PA', name: "L'Oréal", market: 'EU', themes: ['GROWTH', 'DIVIDEND'] },
  { ticker: 'NESN.SW', name: 'Nestlé', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'NOVN.SW', name: 'Novartis', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'ROG.SW', name: 'Roche', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'SIE.DE', name: 'Siemens', market: 'EU', themes: ['GROWTH', 'DIVIDEND'] },
  { ticker: 'AIR.PA', name: 'Airbus', market: 'EU', themes: ['GROWTH'] },
  { ticker: 'SAN.PA', name: 'Sanofi', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'BP.L', name: 'BP', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'SHEL.L', name: 'Shell', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'AZN.L', name: 'AstraZeneca', market: 'EU', themes: ['GROWTH', 'DIVIDEND'] },
  { ticker: 'ULVR.L', name: 'Unilever', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'HSBA.L', name: 'HSBC', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'INGA.AS', name: 'ING Group', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'ADYEN.AS', name: 'Adyen', market: 'EU', themes: ['GROWTH'] },
  { ticker: 'PRX.AS', name: 'Prosus', market: 'EU', themes: ['GROWTH', 'VALUE'] },
  { ticker: 'RMS.PA', name: 'Hermès', market: 'EU', themes: ['GROWTH'] },
  { ticker: 'IBE.MC', name: 'Iberdrola', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
];

/** Deduped universe (fixes accidental duplicate entries). */
const DEDUPED: UniverseName[] = (() => {
  const seen = new Set<string>();
  const out: UniverseName[] = [];
  for (const row of POPULAR_UNIVERSE) {
    const key = row.ticker.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
})();

/**
 * Build a scout list for Suggest a Trade.
 * Caps at `max` tickers; for ALL markets, round-robins across regions.
 * When `shuffle` is true, randomize order (and which names are kept when pool > max)
 * so each Suggest press is a new search sample.
 */
export function buildSuggestUniverse(
  market: SuggestMarket,
  theme: SuggestTheme,
  max = 20,
  opts?: { shuffle?: boolean }
): UniverseName[] {
  let pool = DEDUPED;
  if (market !== 'ALL') {
    pool = pool.filter((r) => r.market === market);
  }
  if (theme !== 'ALL') {
    pool = pool.filter((r) => r.themes.includes(theme));
  }

  const shuffle = !!opts?.shuffle;
  const shuffledPool = shuffle ? shuffleCopy(pool) : pool;

  if (market !== 'ALL') {
    return shuffledPool.slice(0, max);
  }

  // Round-robin US → HK → JP → EU for balanced multi-market scout
  const byMkt: Record<string, UniverseName[]> = { US: [], HK: [], JP: [], EU: [] };
  for (const row of shuffledPool) {
    byMkt[row.market]?.push(row);
  }
  if (shuffle) {
    for (const m of Object.keys(byMkt)) {
      byMkt[m] = shuffleCopy(byMkt[m]);
    }
  }
  const order: Array<Exclude<SuggestMarket, 'ALL'>> = ['US', 'HK', 'JP', 'EU'];
  const picked: UniverseName[] = [];
  let i = 0;
  while (picked.length < max) {
    let added = false;
    for (const m of order) {
      if (picked.length >= max) break;
      const next = byMkt[m][i];
      if (next) {
        picked.push(next);
        added = true;
      }
    }
    if (!added) break;
    i += 1;
  }
  return picked;
}

function shuffleCopy<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function universeTickers(market: SuggestMarket, theme: SuggestTheme, max = 20): string[] {
  return buildSuggestUniverse(market, theme, max).map((r) => r.ticker);
}
