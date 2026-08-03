/**
 * Curated popular-market universes for Find a Trade +.
 * Kept modest (≤30 per scout) so Consensus scanning stays within API limits.
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
  { ticker: 'NFLX', name: 'Netflix', market: 'US', themes: ['GROWTH'] },
  { ticker: 'INTC', name: 'Intel', market: 'US', themes: ['AI', 'VALUE'] },
  { ticker: 'QCOM', name: 'Qualcomm', market: 'US', themes: ['AI', 'GROWTH', 'DIVIDEND'] },
  { ticker: 'MU', name: 'Micron', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'AMAT', name: 'Applied Materials', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'NOW', name: 'ServiceNow', market: 'US', themes: ['AI', 'GROWTH'] },
  { ticker: 'UBER', name: 'Uber', market: 'US', themes: ['GROWTH'] },
  { ticker: 'ABBV', name: 'AbbVie', market: 'US', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'PG', name: 'Procter & Gamble', market: 'US', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'HD', name: 'Home Depot', market: 'US', themes: ['GROWTH', 'DIVIDEND'] },

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
  { ticker: '2015.HK', name: 'Li Auto', market: 'HK', themes: ['GROWTH'] },
  { ticker: '9868.HK', name: 'XPeng', market: 'HK', themes: ['GROWTH'] },
  { ticker: '9866.HK', name: 'NIO', market: 'HK', themes: ['GROWTH'] },
  { ticker: '9626.HK', name: 'Bilibili', market: 'HK', themes: ['GROWTH'] },
  { ticker: '0981.HK', name: 'SMIC', market: 'HK', themes: ['AI', 'GROWTH'] },
  { ticker: '2388.HK', name: 'BOC Hong Kong', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '0011.HK', name: 'Hang Seng Bank', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '1109.HK', name: 'China Resources Land', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '2688.HK', name: 'ENN Energy', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '1177.HK', name: 'Sino Biopharm', market: 'HK', themes: ['GROWTH'] },
  { ticker: '0883.HK', name: 'CNOOC', market: 'HK', themes: ['VALUE', 'DIVIDEND'] },

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
  { ticker: '6902.T', name: 'Denso', market: 'JP', themes: ['GROWTH'] },
  { ticker: '6752.T', name: 'Panasonic', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '8001.T', name: 'Itochu', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '8058.T', name: 'Mitsubishi Corp', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '9433.T', name: 'KDDI', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: '6594.T', name: 'Nidec', market: 'JP', themes: ['GROWTH'] },
  { ticker: '4901.T', name: 'Fujifilm', market: 'JP', themes: ['GROWTH', 'DIVIDEND'] },
  { ticker: '6954.T', name: 'Fanuc', market: 'JP', themes: ['GROWTH'] },
  { ticker: '6273.T', name: 'SMC', market: 'JP', themes: ['GROWTH'] },
  { ticker: '8411.T', name: 'Mizuho', market: 'JP', themes: ['VALUE', 'DIVIDEND'] },

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
  { ticker: 'BMW.DE', name: 'BMW', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'VOW3.DE', name: 'Volkswagen', market: 'EU', themes: ['VALUE'] },
  { ticker: 'ALV.DE', name: 'Allianz', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'DTE.DE', name: 'Deutsche Telekom', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'IFX.DE', name: 'Infineon', market: 'EU', themes: ['AI', 'GROWTH'] },
  { ticker: 'SU.PA', name: 'Schneider Electric', market: 'EU', themes: ['GROWTH', 'DIVIDEND'] },
  { ticker: 'TTE.PA', name: 'TotalEnergies', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'ABI.BR', name: 'AB InBev', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
  { ticker: 'KER.PA', name: 'Kering', market: 'EU', themes: ['GROWTH'] },
  { ticker: 'ENI.MI', name: 'Eni', market: 'EU', themes: ['VALUE', 'DIVIDEND'] },
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
 */
export function buildSuggestUniverse(
  market: SuggestMarket,
  theme: SuggestTheme,
  max = 30
): UniverseName[] {
  let pool = DEDUPED;
  if (market !== 'ALL') {
    pool = pool.filter((r) => r.market === market);
  }
  if (theme !== 'ALL') {
    pool = pool.filter((r) => r.themes.includes(theme));
  }

  if (market !== 'ALL') {
    return pool.slice(0, max);
  }

  // Round-robin US → HK → JP → EU for balanced multi-market scout
  const byMkt: Record<string, UniverseName[]> = { US: [], HK: [], JP: [], EU: [] };
  for (const row of pool) {
    byMkt[row.market]?.push(row);
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

export function universeTickers(market: SuggestMarket, theme: SuggestTheme, max = 30): string[] {
  return buildSuggestUniverse(market, theme, max).map((r) => r.ticker);
}
