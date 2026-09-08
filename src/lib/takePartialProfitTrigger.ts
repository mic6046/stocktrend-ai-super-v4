import type { StockRecommendation } from './recommendation';
import { formatRecommendationDisplay } from './recommendation';

export type TakePartialProfitCheck = {
  fire: boolean;
  reason: string;
};

/**
 * Detects the engine's own "TAKE PARTIAL PROFIT" headline — this is not a
 * new signal. positionAwareHeadline() in quantumRecommendationEngine.ts
 * already emits it whenever userHasPosition is true AND price is near
 * resistance with reducing institutional/whale flow. The only thing this
 * adds is reading that signal proactively across held positions instead of
 * only seeing it when you happen to open that ticker's detail page.
 */
export function checkTakePartialProfit(rec: StockRecommendation): TakePartialProfitCheck {
  const label = formatRecommendationDisplay(rec);
  const fire = /take partial profit/i.test(label);
  const reason = rec.engine?.currentAction?.why || rec.currentActionReason || label;
  return { fire, reason };
}
