import { useCallback, useRef } from 'react';
import { loadSuggestedBuys, removeSuggestedBuy } from './suggestedBuysStore';
import { scanSuggestedBuysForFade, type FadeAlertFireEvent } from './suggestedBuyFadeWatcher';

/**
 * No background timer — deliberately, same as the Take Partial Profit
 * watcher. Re-checks tracked suggestions only when the caller explicitly
 * triggers scanNow() (Today's Picks calls this on its own open/refresh
 * cycle). Firing a fade alert stops tracking that ticker — one report per
 * pick, not a repeating nag.
 */
export function useSuggestedBuyFadeWatcher(onFire: (event: FadeAlertFireEvent) => void) {
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const scanNow = useCallback(async () => {
    const suggestions = loadSuggestedBuys();
    if (!suggestions.length) return;

    const fires = await scanSuggestedBuysForFade(suggestions);
    for (const fire of fires) {
      removeSuggestedBuy(fire.ticker);
      onFireRef.current(fire);
    }
  }, []);

  return { scanNow };
}
