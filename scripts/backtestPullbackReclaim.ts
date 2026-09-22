/**
 * Compares two different philosophies for "pullback buy", holding the SETUP
 * DEFINITION constant so only entry TIMING differs:
 *
 * - ANTICIPATORY (existing): quantumRecommendationEngine.ts's "PULLBACK BUY"
 *   setupTag — trend BULL + strong (80+) whale/institutional/smart-money
 *   accumulation + price within 3% of support. Fires before any confirmation
 *   the decline has stopped.
 * - CONFIRMATORY (new): the SAME trend-BULL + strong-accumulation context
 *   gate, but instead of "near support," requires pullbackReclaim.ts's
 *   evaluatePullbackReclaim() to show a confirmed reclaim (2+ closes back
 *   above the MA5/10/30 cluster, structure not broken).
 *
 * First pass at this (see git history) compared the tag against the reclaim
 * evaluator with NO context gate on the confirmatory side — that produced
 * 12x more confirmatory signals and wasn't a fair test, since it was
 * comparing two different setups (one gated on accumulation, one not), not
 * two entry timings for the same setup. This version fixes that: both sides
 * require the identical trend+accumulation context.
 *
 * The accumulation check here (whale/inst/smart >= 80) is a simplified
 * approximation of the engine's actual strongAccumulation flag (which also
 * requires the other two measures not be actively bearish) — that internal
 * flag isn't exposed on QuantumEngineOutput, so this is the closest
 * reasonable proxy without duplicating engine internals.
 *
 * Usage: npx tsx scripts/backtestPullbackReclaim.ts [HOLDING_DAYS]
 */
import YahooFinanceImport from 'yahoo-finance2';
import { buildQuantumInputFromMarketData } from '../src/lib/quantumInputBuilder';
import { runQuantumRecommendationEngine } from '../src/lib/quantumRecommendationEngine';
import { evaluatePullbackReclaim } from '../src/lib/pullbackReclaim';

const YahooFinanceConstructor = (YahooFinanceImport as any).default || YahooFinanceImport;
const yahooFinance = new YahooFinanceConstructor({
  validation: { logErrors: false, logOptionsErrors: false, allowAdditionalProps: true },
}) as any;

const TICKERS = ['AMD', 'NVDA', 'TSLA', 'PLTR', 'META', 'GOOGL', 'AMZN', 'MSFT', 'AAPL', 'SMCI'];
const LOOKBACK_BARS = 260; // ~1 trading year warmup before indicators are considered stable
const STEP_BARS = 1; // daily — a 2-close reclaim window is easy to skip over with weekly steps

type FireEvent = {
  ticker: string;
  asOfDate: string;
  kind: 'anticipatory' | 'confirmatory';
  entryPrice: number;
  realizedReturn: number;
};

async function backtestTicker(ticker: string, holdingDays: number): Promise<FireEvent[]> {
  const chart = await yahooFinance.chart(ticker, { period1: '2022-01-01', interval: '1d' }).catch((e: any) => {
    console.error(ticker, 'chart fetch failed:', e.message);
    return null;
  });
  const fullHistory = (chart?.quotes || []).filter((h: any) => h?.close != null && Number.isFinite(Number(h.close)));
  if (fullHistory.length < LOOKBACK_BARS + holdingDays + 10) return [];

  const events: FireEvent[] = [];
  let inAnticipatoryCooldown = false;
  let inConfirmatoryCooldown = false;

  for (let i = LOOKBACK_BARS; i < fullHistory.length - holdingDays; i += STEP_BARS) {
    const asOfHistory = fullHistory.slice(0, i + 1);
    const asOfBar = fullHistory[i];
    const futureBar = fullHistory[i + holdingDays];
    const entryPrice = asOfBar.close;
    const realizedReturn = entryPrice > 0 ? ((futureBar.close - entryPrice) / entryPrice) * 100 : 0;

    // Anticipatory: the engine's existing setupTag.
    const input = buildQuantumInputFromMarketData({
      horizon: '1M',
      ticker,
      quote: { regularMarketPrice: asOfBar.close, regularMarketVolume: asOfBar.volume },
      history: asOfHistory,
      userHasPosition: false,
    });
    const out = runQuantumRecommendationEngine(input);
    const anticipatoryFires = out.setupTag === 'PULLBACK BUY';

    // Same context gate the anticipatory tag already requires, applied to
    // the confirmatory side too — the only thing allowed to differ is the
    // price-timing condition (near support vs confirmed reclaim).
    const trendIsBull = !!input.technical?.trend?.includes('BULL');
    const hasStrongAccum =
      (input.whaleScore ?? 0) >= 80 || (input.institutionalScore ?? 0) >= 80 || (input.smartMoneyScore ?? 0) >= 80;

    // Confirmatory: same context, reclaim-confirmed timing instead of near-support timing.
    const reclaim = evaluatePullbackReclaim(asOfHistory);
    const confirmatoryFires =
      trendIsBull &&
      hasStrongAccum &&
      reclaim?.criteria.reclaimTrigger === 'PASS' &&
      reclaim?.criteria.higherLow !== 'FAIL';

    // One event per "episode" — don't count every single day a multi-day
    // signal keeps firing as a separate independent trade.
    if (anticipatoryFires && !inAnticipatoryCooldown) {
      events.push({ ticker, asOfDate: new Date(asOfBar.date).toISOString().slice(0, 10), kind: 'anticipatory', entryPrice, realizedReturn });
    }
    inAnticipatoryCooldown = anticipatoryFires;

    if (confirmatoryFires && !inConfirmatoryCooldown) {
      events.push({ ticker, asOfDate: new Date(asOfBar.date).toISOString().slice(0, 10), kind: 'confirmatory', entryPrice, realizedReturn });
    }
    inConfirmatoryCooldown = confirmatoryFires;
  }

  return events;
}

function summarize(events: FireEvent[], kind: 'anticipatory' | 'confirmatory') {
  const list = events.filter((e) => e.kind === kind);
  if (!list.length) {
    console.log(`${kind.padEnd(13)} n=0`);
    return;
  }
  const hits = list.filter((e) => e.realizedReturn > 0).length;
  const avgReturn = list.reduce((sum, e) => sum + e.realizedReturn, 0) / list.length;
  const worst = Math.min(...list.map((e) => e.realizedReturn));
  const best = Math.max(...list.map((e) => e.realizedReturn));
  console.log(
    `${kind.padEnd(13)} n=${String(list.length).padEnd(4)} hitRate=${((hits / list.length) * 100).toFixed(1)}%  avgReturn=${avgReturn.toFixed(2)}%  worst=${worst.toFixed(1)}%  best=${best.toFixed(1)}%`
  );
}

async function main() {
  const holdingDays = Number(process.argv[2]) || 15;
  console.log(`Comparing anticipatory vs confirmatory pullback-buy signals, ${holdingDays}-trading-day holding window, ${TICKERS.length} tickers...\n`);

  const allEvents: FireEvent[] = [];
  for (const ticker of TICKERS) {
    const events = await backtestTicker(ticker, holdingDays);
    allEvents.push(...events);
    console.log(
      `${ticker.padEnd(6)} anticipatory=${events.filter((e) => e.kind === 'anticipatory').length}  confirmatory=${events.filter((e) => e.kind === 'confirmatory').length}`
    );
  }

  console.log('\n=== Overall ===');
  summarize(allEvents, 'anticipatory');
  summarize(allEvents, 'confirmatory');

  console.log('\n=== Per-ticker detail ===');
  for (const ticker of TICKERS) {
    const tickerEvents = allEvents.filter((e) => e.ticker === ticker);
    if (!tickerEvents.length) continue;
    console.log(`\n${ticker}:`);
    summarize(tickerEvents, 'anticipatory');
    summarize(tickerEvents, 'confirmatory');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
