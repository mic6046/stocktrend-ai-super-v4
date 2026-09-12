/**
 * Retrospective backtest for the Quantum recommendation engine.
 *
 * Walks forward through a ticker's real daily-bar history, truncating the
 * array at each "as-of" date before calling the exact same
 * buildQuantumInputFromMarketData -> runQuantumRecommendationEngine path the
 * live app uses — so the engine only ever sees data that existed at that
 * point in time (no look-ahead). Grades each snapshot against the real price
 * once the horizon elapses, using the SAME direction/target-hit rules as the
 * live outcome tracker (server/recommendationOutcomes.ts) so the numbers
 * mean the same thing.
 *
 * Usage:
 *   npx tsx scripts/backtest.ts [TICKER] [HORIZON]
 *   npx tsx scripts/backtest.ts AMD 1M
 *
 * Known limitations (see the chat writeup for the full list):
 * - Survivorship bias: only tests tickers that still exist today.
 * - No historical news archive, so sentimentScore/newsBias are neutralized
 *   here rather than reflecting what real news sentiment was on that date.
 * - Walks in weekly steps, not every single day, to keep runtime sane.
 */
import YahooFinanceImport from 'yahoo-finance2';
import { buildQuantumInputFromMarketData } from '../src/lib/quantumInputBuilder';
import { runQuantumRecommendationEngine } from '../src/lib/quantumRecommendationEngine';
import type { HorizonKey } from '../src/components/analysis/analysisTheme';

const YahooFinanceConstructor = (YahooFinanceImport as any).default || YahooFinanceImport;
const yahooFinance = new YahooFinanceConstructor({
  validation: { logErrors: false, logOptionsErrors: false, allowAdditionalProps: true },
}) as any;

// Same buckets server/recommendationOutcomes.ts grades live recommendations
// with — kept identical on purpose so a backtested hit rate and a live hit
// rate mean the same thing.
const BULLISH_ACTIONS = new Set(['STRONG BUY', 'BUY']);
const BEARISH_ACTIONS = new Set(['SELL', 'REDUCE', 'AVOID NEW POSITION']);

const HORIZON_TRADING_DAYS: Record<string, number> = { '1W': 5, '1M': 21, '3M': 63, '1Y': 252 };
const LOOKBACK_BARS = 260; // ~1 trading year of history before the engine's indicators are considered stable
const STEP_BARS = 5; // walk forward roughly weekly

type Snapshot = {
  asOfDate: string;
  verdict: string;
  confidence: number;
  setupTag: string | null;
  entryPrice: number;
  targetPrice: number;
  expectedReturn: number;
  realizedReturn: number;
  directionHit: boolean | null;
  targetHit: boolean | null;
};

function directionHitFor(action: string, realizedReturn: number): boolean | null {
  if (BULLISH_ACTIONS.has(action)) return realizedReturn > 0;
  if (BEARISH_ACTIONS.has(action)) return realizedReturn < 0;
  if (action === 'HOLD') return Math.abs(realizedReturn) < 5;
  return null;
}

function targetHitFor(entryPrice: number, targetPrice: number, futurePrice: number): boolean | null {
  if (!(targetPrice > 0) || !(entryPrice > 0)) return null;
  return targetPrice >= entryPrice ? futurePrice >= targetPrice : futurePrice <= targetPrice;
}

async function backtest(ticker: string, horizon: HorizonKey): Promise<Snapshot[]> {
  const chart = await yahooFinance.chart(ticker, { period1: '2021-01-01', interval: '1d' }).catch((e: any) => {
    console.error('chart fetch failed:', e.message);
    return null;
  });
  const fullHistory = (chart?.quotes || []).filter((h: any) => h?.close != null && Number.isFinite(Number(h.close)));
  if (fullHistory.length < LOOKBACK_BARS + 30) {
    throw new Error(`Not enough history for ${ticker}: ${fullHistory.length} bars`);
  }

  const horizonTradingDays = HORIZON_TRADING_DAYS[horizon] ?? 21;
  const snapshots: Snapshot[] = [];

  for (
    let i = LOOKBACK_BARS;
    i < fullHistory.length - horizonTradingDays;
    i += STEP_BARS
  ) {
    const asOfHistory = fullHistory.slice(0, i + 1); // truncate — no look-ahead past this bar
    const asOfBar = fullHistory[i];
    const futureBar = fullHistory[i + horizonTradingDays];

    const input = buildQuantumInputFromMarketData({
      horizon,
      ticker,
      quote: { regularMarketPrice: asOfBar.close, regularMarketVolume: asOfBar.volume },
      history: asOfHistory,
      userHasPosition: false,
    });
    const out = runQuantumRecommendationEngine(input);

    const entryPrice = out.currentPrice;
    const realizedReturn = entryPrice > 0 ? ((futureBar.close - entryPrice) / entryPrice) * 100 : 0;

    snapshots.push({
      asOfDate: new Date(asOfBar.date).toISOString().slice(0, 10),
      verdict: out.finalVerdict,
      confidence: out.confidence,
      setupTag: out.setupTag,
      entryPrice,
      targetPrice: out.targetPrice,
      expectedReturn: out.expectedReturn,
      realizedReturn: Number(realizedReturn.toFixed(2)),
      directionHit: directionHitFor(out.finalVerdict, realizedReturn),
      targetHit: targetHitFor(entryPrice, out.targetPrice, futureBar.close),
    });
  }

  return snapshots;
}

function summarize(snapshots: Snapshot[]) {
  const byVerdict = new Map<string, Snapshot[]>();
  for (const s of snapshots) {
    const list = byVerdict.get(s.verdict) ?? [];
    list.push(s);
    byVerdict.set(s.verdict, list);
  }

  console.log('\n=== Summary by verdict ===');
  for (const [verdict, list] of byVerdict) {
    const graded = list.filter((s) => s.directionHit != null);
    const hits = graded.filter((s) => s.directionHit).length;
    const avgExpected = list.reduce((sum, s) => sum + s.expectedReturn, 0) / list.length;
    const avgRealized = list.reduce((sum, s) => sum + s.realizedReturn, 0) / list.length;
    console.log(
      `${verdict.padEnd(20)} n=${String(list.length).padEnd(4)} directionHitRate=${
        graded.length ? ((hits / graded.length) * 100).toFixed(1) + '%' : 'n/a'
      }  avgExpected=${avgExpected.toFixed(1)}%  avgRealized=${avgRealized.toFixed(1)}%`
    );
  }

  const tagged = snapshots.filter((s) => s.setupTag);
  if (tagged.length) {
    console.log('\n=== Summary by setup tag ===');
    const byTag = new Map<string, Snapshot[]>();
    for (const s of tagged) {
      const list = byTag.get(s.setupTag!) ?? [];
      list.push(s);
      byTag.set(s.setupTag!, list);
    }
    for (const [tag, list] of byTag) {
      const graded = list.filter((s) => s.directionHit != null);
      const hits = graded.filter((s) => s.directionHit).length;
      const avgRealized = list.reduce((sum, s) => sum + s.realizedReturn, 0) / list.length;
      console.log(
        `${tag.padEnd(20)} n=${String(list.length).padEnd(4)} directionHitRate=${
          graded.length ? ((hits / graded.length) * 100).toFixed(1) + '%' : 'n/a'
        }  avgRealized=${avgRealized.toFixed(1)}%`
      );
    }
  }
}

async function main() {
  const ticker = process.argv[2] || 'AMD';
  const horizon = (process.argv[3] || '1M') as HorizonKey;

  console.log(`Backtesting ${ticker} @ ${horizon} horizon (weekly steps, ${LOOKBACK_BARS}-bar warmup)...`);
  const snapshots = await backtest(ticker, horizon);
  console.log(`\nGenerated ${snapshots.length} historical snapshots.\n`);

  console.log('asOfDate     verdict              conf  setupTag        entry     target    expRet  realRet  dirHit  tgtHit');
  for (const s of snapshots) {
    console.log(
      [
        s.asOfDate,
        s.verdict.padEnd(20),
        String(s.confidence).padStart(3) + '%',
        (s.setupTag ?? '-').padEnd(15),
        s.entryPrice.toFixed(2).padStart(8),
        s.targetPrice.toFixed(2).padStart(8),
        (s.expectedReturn.toFixed(1) + '%').padStart(7),
        (s.realizedReturn.toFixed(1) + '%').padStart(7),
        String(s.directionHit ?? '-').padStart(6),
        String(s.targetHit ?? '-').padStart(6),
      ].join('  ')
    );
  }

  summarize(snapshots);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
