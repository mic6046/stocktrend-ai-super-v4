import type { StockRecommendation } from './recommendation';
import { formatRecommendationDisplay } from './recommendation';
import type { TechnicalBreakdown } from './technical';
import type { HorizonKey } from '../components/analysis/analysisTheme';
import type { AnalysisAskSnapshot } from './assistantChatApi';

const HORIZON_LABEL: Record<HorizonKey, string> = {
  '1W': '1 Week',
  '1M': '1 Month',
  '3M': '3 Months',
  '1Y': '1 Year',
};

/**
 * Maps the SAME data already shown on the Analysis page into the AI Chat
 * context snapshot — nothing here re-derives a verdict. masterRecommendation
 * is the same SSOT object (toStockRecommendation(horizonView, ...)) every
 * other panel on the page reads from, so the chat can only ever explain the
 * on-screen call, never quietly disagree with it.
 */
export function buildAnalysisAskSnapshot(params: {
  masterRecommendation: StockRecommendation | null | undefined;
  quote?: {
    regularMarketPrice?: number | null;
    regularMarketChangePercent?: number | null;
    shortName?: string | null;
    longName?: string | null;
  } | null;
  technicalBreakdown?: TechnicalBreakdown | null;
  horizon?: HorizonKey;
  keyRisks?: string[];
  /** Real news articles already fetched for this ticker — just the headlines, for outside context. */
  news?: Array<{ title?: string | null; headline?: string | null }>;
}): AnalysisAskSnapshot | null {
  const { masterRecommendation: rec, quote, technicalBreakdown: tech, horizon, keyRisks, news } = params;
  if (!rec) return null;

  const macd = tech?.indicators?.macd;
  const macdBullish = macd != null ? macd.macdLine > macd.signalLine : null;
  const volatilityPct = tech?.indicators?.annualizedVolatilityPct;

  const recentHeadlines = (news || [])
    .map((n) => (n.title || n.headline || '').trim())
    .filter(Boolean)
    .slice(0, 3);

  return {
    ticker: rec.ticker,
    name: rec.companyName || quote?.shortName || quote?.longName || rec.ticker,
    price: quote?.regularMarketPrice ?? null,
    changePct: quote?.regularMarketChangePercent ?? null,
    score: rec.overallScore,
    rating: rec.recommendation,
    action: formatRecommendationDisplay(rec),
    actionReason: rec.engine?.currentAction?.why || rec.currentActionReason || null,
    confidence: rec.confidence,
    risk: rec.riskLabel,
    rsi: tech?.indicators?.rsi ?? null,
    macdBullish,
    trend: tech?.quantumRefinement?.trendStrength?.status ?? null,
    volatility: volatilityPct != null ? `${volatilityPct.toFixed(1)}%/yr (annualized)` : null,
    targetPrice: rec.targetPrice,
    expectedReturn: rec.expectedReturn,
    horizon: horizon ? HORIZON_LABEL[horizon] : null,
    keyRisks: keyRisks && keyRisks.length ? keyRisks.slice(0, 6) : undefined,
    bullishFactors: rec.engine?.bullishFactors?.map((f) => f.label).slice(0, 6),
    bearishFactors: rec.engine?.bearishFactors?.map((f) => f.label).slice(0, 6),
    summaryLead: rec.aiExplanation || null,
    // Analyst consensus (analystRating/analystTargetPrice/...) is deliberately
    // NOT set here: it lives in Yahoo's quoteSummary 'financialData' module,
    // not the plain quote object already fetched for this page — verified
    // empirically (a real AAPL quote() call returns undefined for all of
    // recommendationKey/targetMeanPrice/etc). Rather than add a second fetch
    // to every ticker page just to populate a chat field, the server fetches
    // it directly (once per chat conversation) when building the prompt.
    recentHeadlines: recentHeadlines.length ? recentHeadlines : undefined,
  };
}
