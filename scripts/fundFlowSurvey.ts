/**
 * Aggregates the peakAnalog.ts fund-flow cross-tab across MANY tickers, to
 * test at scale whether the pattern found on GOOG/0388.HK generalizes:
 * does INFLOW at a peak precede a pullback more often than chance, and does
 * OUTFLOW at a trough precede a rebound more often than chance?
 *
 * Usage: npx tsx scripts/fundFlowSurvey.ts [YEARS_BACK]
 */
import YahooFinanceImport from 'yahoo-finance2';
import { analyzePeakAnalogs, type FundFlowLabel } from '../src/lib/peakAnalog';

const YahooFinanceConstructor = (YahooFinanceImport as any).default || YahooFinanceImport;
const yahooFinance = new YahooFinanceConstructor({
  validation: { logErrors: false, logOptionsErrors: false, allowAdditionalProps: true },
}) as any;

const TICKERS = [
  // US tech / large-cap, touched earlier this session
  'GOOG', 'AMD', 'NVDA', 'TSLA', 'PLTR', 'META', 'AMZN', 'MSFT', 'AAPL', 'SMCI',
  // US watchlist
  'IBM', 'QCOM', 'CSCO', 'LITE', 'IBIT', 'ILMN', 'ANET', 'MSI', 'MP', 'VRT',
  // HK watchlist
  '0388.HK', '0700.HK', '1928.HK', '9626.HK', '9688.HK', '9888.HK',
  '2438.HK', '2533.HK', '3650.HK', '9880.HK', '3896.HK', '6181.HK',
];

type AggBucket = Record<string, number>;
function bump(bucket: AggBucket, key: string) {
  bucket[key] = (bucket[key] ?? 0) + 1;
}
function rate(bucket: AggBucket, key: string): string {
  const total = Object.values(bucket).reduce((a, b) => a + b, 0);
  if (!total) return 'n/a (0 samples)';
  return `${(((bucket[key] ?? 0) / total) * 100).toFixed(0)}% (${bucket[key] ?? 0}/${total})`;
}

async function main() {
  const yearsBack = Number(process.argv[2]) || 2;
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - yearsBack);

  const peaksByFlow: Record<FundFlowLabel, AggBucket> = { INFLOW: {}, OUTFLOW: {}, NEUTRAL: {} };
  const troughsByFlow: Record<FundFlowLabel, AggBucket> = { INFLOW: {}, OUTFLOW: {}, NEUTRAL: {} };
  let tickersUsed = 0;

  for (const ticker of TICKERS) {
    const chart = await yahooFinance
      .chart(ticker, { period1: period1.toISOString().slice(0, 10), interval: '1d' })
      .catch((e: any) => {
        console.error(ticker, 'fetch failed:', e.message);
        return null;
      });
    const history = (chart?.quotes || []).filter((h: any) => h?.close != null && Number.isFinite(Number(h.close)));
    if (!history.length) continue;

    const result = analyzePeakAnalogs(history);
    if (!result) continue;
    tickersUsed++;

    for (const p of result.peaks) {
      if (p.outcome === 'TOO_RECENT') continue;
      bump(peaksByFlow[p.fundFlow], p.outcome);
    }
    for (const t of result.troughs) {
      if (t.outcome === 'TOO_RECENT') continue;
      bump(troughsByFlow[t.fundFlow], t.outcome);
    }
    console.log(`${ticker.padEnd(9)} peaks=${result.peaks.length}  troughs=${result.troughs.length}`);
  }

  console.log(`\n=== Aggregate across ${tickersUsed} tickers ===`);

  console.log('\nAt PEAKS (resistance tests), by fund flow at the peak:');
  for (const flow of ['INFLOW', 'OUTFLOW', 'NEUTRAL'] as FundFlowLabel[]) {
    const b = peaksByFlow[flow];
    const total = Object.values(b).reduce((a, x) => a + x, 0);
    console.log(`  ${flow.padEnd(8)} n=${String(total).padEnd(4)} pullback rate: ${rate(b, 'PULLBACK')}  breakout rate: ${rate(b, 'BREAKOUT')}  mixed rate: ${rate(b, 'MIXED')}`);
  }

  console.log('\nAt TROUGHS (support tests), by fund flow at the trough:');
  for (const flow of ['INFLOW', 'OUTFLOW', 'NEUTRAL'] as FundFlowLabel[]) {
    const b = troughsByFlow[flow];
    const total = Object.values(b).reduce((a, x) => a + x, 0);
    console.log(`  ${flow.padEnd(8)} n=${String(total).padEnd(4)} rebound rate: ${rate(b, 'REBOUND')}  breakdown rate: ${rate(b, 'BREAKDOWN')}  mixed rate: ${rate(b, 'MIXED')}`);
  }
}

main();
