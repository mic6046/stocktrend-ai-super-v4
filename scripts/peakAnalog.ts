/**
 * Peak Analog Finder — run this against any ticker to see how it has
 * historically behaved at local peaks: breakout continuation vs pullback vs
 * indecisive chop, what distinguished the two outcomes (RSI, volume, extension
 * above the 50-day MA), and how today's setup compares to those fingerprints.
 *
 * This is historical pattern-matching for ONE stock's own past behavior —
 * not a general model, and it doesn't feed back into the recommendation
 * engine. Originally built from a live worked example on 0700.HK, which
 * showed 14 pullbacks and 0 clean breakouts across 19 peaks over 2 years.
 *
 * Usage: npx tsx scripts/peakAnalog.ts TICKER [YEARS_BACK]
 *   npx tsx scripts/peakAnalog.ts 0700.HK 2
 */
import YahooFinanceImport from 'yahoo-finance2';
import { analyzePeakAnalogs } from '../src/lib/peakAnalog';

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

  console.log('\n=== All identified local peaks ===');
  console.log('date         price      RSI  volRatio  volTrendIntoPeak  %aboveMA50   outcome');
  for (const p of result.peaks) {
    console.log(
      `${p.date}  ${p.price.toFixed(2).padStart(9)}  ${fmt(p.rsi, 0).padStart(4)}  ${p.volRatio.toFixed(2).padStart(7)}x  ${fmtPct(p.volTrendIntoPeakPct).padStart(7)}  ${fmtPct(p.pctAboveMA50).padStart(7)}   ${p.outcome} (${p.outcomeDetail})`
    );
  }

  const n = result.peaks.length;
  const resolved = result.peaks.filter((p) => p.outcome === 'BREAKOUT' || p.outcome === 'PULLBACK');
  const breakouts = resolved.filter((p) => p.outcome === 'BREAKOUT').length;
  const pullbacks = resolved.filter((p) => p.outcome === 'PULLBACK').length;
  console.log(`\n${n} peaks total | ${breakouts} breakout / ${pullbacks} pullback / ${n - breakouts - pullbacks} mixed or too recent`);

  if (result.breakoutFingerprint) {
    console.log(`\n=== Signal fingerprint: BREAKOUT peaks (n=${result.breakoutFingerprint.count}) ===`);
    console.log('avg RSI at peak:', fmt(result.breakoutFingerprint.avgRsi));
    console.log('avg volume ratio at peak:', fmt(result.breakoutFingerprint.avgVolRatio, 2), 'x');
    console.log('avg volume trend into peak:', fmtPct(result.breakoutFingerprint.avgVolTrendPct));
    console.log('avg % above MA50:', fmtPct(result.breakoutFingerprint.avgPctAboveMA50));
  } else {
    console.log('\n(No resolved breakout peaks in this window — not enough history to fingerprint that outcome.)');
  }

  if (result.pullbackFingerprint) {
    console.log(`\n=== Signal fingerprint: PULLBACK peaks (n=${result.pullbackFingerprint.count}) ===`);
    console.log('avg RSI at peak:', fmt(result.pullbackFingerprint.avgRsi));
    console.log('avg volume ratio at peak:', fmt(result.pullbackFingerprint.avgVolRatio, 2), 'x');
    console.log('avg volume trend into peak:', fmtPct(result.pullbackFingerprint.avgVolTrendPct));
    console.log('avg % above MA50:', fmtPct(result.pullbackFingerprint.avgPctAboveMA50));
  } else {
    console.log('\n(No resolved pullback peaks in this window — not enough history to fingerprint that outcome.)');
  }

  console.log('\n=== Current state ===');
  console.log('date:', result.current.date);
  console.log('price:', result.current.price.toFixed(2));
  console.log('RSI:', fmt(result.current.rsi));
  console.log('volume ratio (vs 20d avg):', fmt(result.current.volRatio, 2), 'x');
  console.log('volume trend into today:', fmtPct(result.current.volTrendIntoPeakPct));
  console.log('% above MA50:', fmtPct(result.current.pctAboveMA50));
  console.log('is at/near a local high right now:', result.current.isNearRecentHigh);
}

main();
