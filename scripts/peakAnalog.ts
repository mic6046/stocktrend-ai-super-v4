/**
 * Peak & Trough Analog Finder — run this against any ticker to see how it has
 * historically behaved at local peaks AND troughs: breakout vs pullback at
 * highs, rebound vs breakdown at lows, what distinguished the outcomes (RSI,
 * volume, extension above the 50-day MA, and fund-flow state), and how
 * today's setup compares.
 *
 * This is historical pattern-matching for ONE stock's own past behavior —
 * not a general model, and it doesn't feed back into the recommendation
 * engine. Fund flow is the same technical-indicator proxy (accumulation/
 * distribution, institutional flow, smart-money index) that already feeds
 * whaleScore/institutionalScore elsewhere in the app — not literal 13F
 * filings or real order-flow data.
 *
 * Usage: npx tsx scripts/peakAnalog.ts TICKER [YEARS_BACK]
 *   npx tsx scripts/peakAnalog.ts 0700.HK 2
 */
import YahooFinanceImport from 'yahoo-finance2';
import { analyzePeakAnalogs, type FundFlowLabel, type OutcomeCounts } from '../src/lib/peakAnalog';

const YahooFinanceConstructor = (YahooFinanceImport as any).default || YahooFinanceImport;
const yahooFinance = new YahooFinanceConstructor({
  validation: { logErrors: false, logOptionsErrors: false, allowAdditionalProps: true },
}) as any;

function fmtPct(n: number | null): string {
  return n == null ? 'n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
function fmt(n: number | null, digits = 1): string {
  return n == null ? 'n/a' : n.toFixed(digits);
}
function fmtCounts(counts: OutcomeCounts): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return '(none)';
  return Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ') + ` (n=${total})`;
}

async function main() {
  const ticker = process.argv[2];
  const yearsBack = Number(process.argv[3]) || 2;
  if (!ticker) {
    console.error('Usage: npx tsx scripts/peakAnalog.ts TICKER [YEARS_BACK]');
    process.exit(1);
  }

  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - yearsBack);

  const chart = await yahooFinance
    .chart(ticker, { period1: period1.toISOString().slice(0, 10), interval: '1d' })
    .catch((e: any) => {
      console.error('chart fetch failed:', e.message);
      return null;
    });
  const history = (chart?.quotes || []).filter((h: any) => h?.close != null && Number.isFinite(Number(h.close)));
  if (!history.length) {
    console.error('No price history returned for', ticker);
    process.exit(1);
  }
  console.log(
    `${ticker}: ${history.length} daily bars (${new Date(history[0].date).toISOString().slice(0, 10)} to ${new Date(history[history.length - 1].date).toISOString().slice(0, 10)})`
  );

  const result = analyzePeakAnalogs(history);
  if (!result) {
    console.error('Not enough history to run this analysis (need at least ~40 bars).');
    process.exit(1);
  }

  console.log('\n=== All identified local PEAKS (resistance tests) ===');
  console.log('date         price      RSI  volRatio  fundFlow   outcome');
  for (const p of result.peaks) {
    console.log(
      `${p.date}  ${p.price.toFixed(2).padStart(9)}  ${fmt(p.rsi, 0).padStart(4)}  ${p.volRatio.toFixed(2).padStart(7)}x  ${p.fundFlow.padEnd(8)}   ${p.outcome} (${p.outcomeDetail})`
    );
  }
  const nPeaks = result.peaks.length;
  const resolvedPeaks = result.peaks.filter((p) => p.outcome === 'BREAKOUT' || p.outcome === 'PULLBACK');
  const breakouts = resolvedPeaks.filter((p) => p.outcome === 'BREAKOUT').length;
  const pullbacks = resolvedPeaks.filter((p) => p.outcome === 'PULLBACK').length;
  console.log(`\n${nPeaks} peaks total | ${breakouts} breakout / ${pullbacks} pullback / ${nPeaks - breakouts - pullbacks} mixed or too recent`);

  console.log('\n=== All identified local TROUGHS (support tests) ===');
  console.log('date         price      RSI  volRatio  fundFlow   outcome');
  for (const t of result.troughs) {
    console.log(
      `${t.date}  ${t.price.toFixed(2).padStart(9)}  ${fmt(t.rsi, 0).padStart(4)}  ${t.volRatio.toFixed(2).padStart(7)}x  ${t.fundFlow.padEnd(8)}   ${t.outcome} (${t.outcomeDetail})`
    );
  }
  const nTroughs = result.troughs.length;
  const resolvedTroughs = result.troughs.filter((t) => t.outcome === 'REBOUND' || t.outcome === 'BREAKDOWN');
  const rebounds = resolvedTroughs.filter((t) => t.outcome === 'REBOUND').length;
  const breakdowns = resolvedTroughs.filter((t) => t.outcome === 'BREAKDOWN').length;
  console.log(`\n${nTroughs} troughs total | ${rebounds} rebound / ${breakdowns} breakdown / ${nTroughs - rebounds - breakdowns} mixed or too recent`);

  function printFingerprint(label: string, fp: typeof result.breakoutFingerprint) {
    if (!fp) {
      console.log(`\n(No resolved ${label} in this window — not enough history to fingerprint that outcome.)`);
      return;
    }
    console.log(`\n=== Signal fingerprint: ${label.toUpperCase()} (n=${fp.count}) ===`);
    console.log('avg RSI:', fmt(fp.avgRsi));
    console.log('avg volume ratio:', fmt(fp.avgVolRatio, 2), 'x');
    console.log('avg volume trend into it:', fmtPct(fp.avgVolTrendPct));
    console.log('avg % above MA50:', fmtPct(fp.avgPctAboveMA50));
  }
  printFingerprint('breakout peaks', result.breakoutFingerprint);
  printFingerprint('pullback peaks', result.pullbackFingerprint);
  printFingerprint('rebound troughs', result.reboundFingerprint);
  printFingerprint('breakdown troughs', result.breakdownFingerprint);

  console.log('\n=== Fund-flow cross-tab: does inflow/outflow predict the outcome? ===');
  console.log('At PEAKS (resistance tests):');
  for (const flow of ['INFLOW', 'OUTFLOW', 'NEUTRAL'] as FundFlowLabel[]) {
    console.log(`  ${flow.padEnd(8)} -> ${fmtCounts(result.fundFlowCrossTab.peaksByFundFlow[flow])}`);
  }
  console.log('At TROUGHS (support tests):');
  for (const flow of ['INFLOW', 'OUTFLOW', 'NEUTRAL'] as FundFlowLabel[]) {
    console.log(`  ${flow.padEnd(8)} -> ${fmtCounts(result.fundFlowCrossTab.troughsByFundFlow[flow])}`);
  }

  console.log('\n=== Current state ===');
  console.log('date:', result.current.date);
  console.log('price:', result.current.price.toFixed(2));
  console.log('RSI:', fmt(result.current.rsi));
  console.log('volume ratio (vs 20d avg):', fmt(result.current.volRatio, 2), 'x');
  console.log('% above MA50:', fmtPct(result.current.pctAboveMA50));
  console.log('fund flow right now:', result.current.fundFlow);
  console.log('is at/near a local high right now:', result.current.isNearRecentHigh);
  console.log('is at/near a local low right now:', result.current.isNearRecentLow);
}

main();
