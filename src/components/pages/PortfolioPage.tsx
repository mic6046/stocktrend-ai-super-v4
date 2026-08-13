import React, { useMemo, useState } from 'react';
import { Briefcase, Plus, Trash2 } from 'lucide-react';
import { GlassCard, SectionLabel } from '../analysis/GlassCard';
import {
  loadPortfolio,
  removeHolding,
  upsertHolding,
  type PortfolioHolding,
} from '../../lib/portfolioStore';
import { cn } from '../../lib/utils';
import { toHkTickerIfNumeric } from '../../lib/tickerNormalize';

type QuoteInfo = {
  price?: number;
  name?: string;
  signal?: string;
  risk?: string;
};

type PortfolioPageProps = {
  quotes?: Record<string, QuoteInfo>;
  onOpenTicker: (ticker: string) => void;
};

export function PortfolioPage({ quotes = {}, onOpenTicker }: PortfolioPageProps) {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => loadPortfolio());
  const [ticker, setTicker] = useState('');
  const [qty, setQty] = useState('10');
  const [avg, setAvg] = useState('');

  const rows = useMemo(() => {
    return holdings.map((h) => {
      const q = quotes[h.ticker] || {};
      const price = q.price;
      const value = price != null ? price * h.quantity : null;
      const cost = h.avgCost * h.quantity;
      const pl = value != null ? value - cost : null;
      const plPct = pl != null && cost > 0 ? (pl / cost) * 100 : null;
      return { ...h, price, value, pl, plPct, name: q.name || h.name, signal: q.signal, risk: q.risk };
    });
  }, [holdings, quotes]);

  const totals = useMemo(() => {
    let value = 0;
    let cost = 0;
    let has = false;
    for (const r of rows) {
      if (r.value != null) {
        value += r.value;
        cost += r.avgCost * r.quantity;
        has = true;
      }
    }
    const pl = has ? value - cost : null;
    const plPct = pl != null && cost > 0 ? (pl / cost) * 100 : null;
    return { value: has ? value : null, pl, plPct };
  }, [rows]);

  const add = () => {
    const t = toHkTickerIfNumeric(ticker);
    const q = Number(qty);
    const a = Number(avg);
    if (!t || !(q > 0) || !(a >= 0)) return;
    setHoldings(upsertHolding(t, q, a));
    setTicker('');
    setQty('10');
    setAvg('');
  };

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400">Holdings</p>
        <h2 className="mt-1 text-2xl font-sans font-bold text-white">Portfolio</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          Enter what you own. We calculate value and unrealised P/L automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard padding="sm">
          <p className="text-[10px] uppercase text-gray-500">Current value</p>
          <p className="mt-1 text-xl font-mono font-bold text-white">
            {totals.value != null ? `$${totals.value.toFixed(2)}` : '—'}
          </p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-[10px] uppercase text-gray-500">Unrealised P/L</p>
          <p
            className={cn(
              'mt-1 text-xl font-mono font-bold',
              (totals.pl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {totals.pl != null ? `${totals.pl >= 0 ? '+' : ''}$${totals.pl.toFixed(2)}` : '—'}
          </p>
        </GlassCard>
        <GlassCard padding="sm">
          <p className="text-[10px] uppercase text-gray-500">P/L %</p>
          <p
            className={cn(
              'mt-1 text-xl font-mono font-bold',
              (totals.plPct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {totals.plPct != null
              ? `${totals.plPct >= 0 ? '+' : ''}${totals.plPct.toFixed(2)}%`
              : '—'}
          </p>
        </GlassCard>
      </div>

      <GlassCard padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Stock"
            className="min-h-[44px] rounded-xl border border-white/10 bg-[#111113] px-3 text-base text-white font-mono focus:outline-none focus:border-emerald-500/50"
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Quantity"
            inputMode="decimal"
            className="min-h-[44px] rounded-xl border border-white/10 bg-[#111113] px-3 text-base text-white font-mono focus:outline-none focus:border-emerald-500/50"
          />
          <input
            value={avg}
            onChange={(e) => setAvg(e.target.value)}
            placeholder="Average cost"
            inputMode="decimal"
            className="min-h-[44px] rounded-xl border border-white/10 bg-[#111113] px-3 text-base text-white font-mono focus:outline-none focus:border-emerald-500/50"
          />
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-emerald-500 px-4 text-[12px] font-bold text-black hover:bg-emerald-400 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Save
          </button>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionLabel icon={<Briefcase className="w-3.5 h-3.5 text-emerald-400" />}>Positions</SectionLabel>
        {!rows.length ? (
          <p className="text-[13px] text-gray-500 text-center py-8">No holdings yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-gray-500 border-b border-white/5">
                  <th className="py-2 px-2">Stock</th>
                  <th className="py-2 px-2">Qty</th>
                  <th className="py-2 px-2">Avg cost</th>
                  <th className="py-2 px-2">Price</th>
                  <th className="py-2 px-2">Value</th>
                  <th className="py-2 px-2">P/L</th>
                  <th className="py-2 px-2">P/L %</th>
                  <th className="py-2 px-2">AI</th>
                  <th className="py-2 px-2">Risk</th>
                  <th className="py-2 px-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ticker} className="border-b border-white/[0.04]">
                    <td className="py-2.5 px-2">
                      <button
                        type="button"
                        className="font-mono font-bold text-white hover:text-emerald-400 cursor-pointer"
                        onClick={() => onOpenTicker(r.ticker)}
                      >
                        {r.ticker}
                      </button>
                      <p className="text-[10px] text-gray-500 truncate max-w-[100px]">{r.name || ''}</p>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[12px]">{r.quantity}</td>
                    <td className="py-2.5 px-2 font-mono text-[12px]">${r.avgCost.toFixed(2)}</td>
                    <td className="py-2.5 px-2 font-mono text-[12px]">
                      {r.price != null ? `$${r.price.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[12px]">
                      {r.value != null ? `$${r.value.toFixed(2)}` : '—'}
                    </td>
                    <td
                      className={cn(
                        'py-2.5 px-2 font-mono text-[12px]',
                        (r.pl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {r.pl != null ? `${r.pl >= 0 ? '+' : ''}$${r.pl.toFixed(2)}` : '—'}
                    </td>
                    <td
                      className={cn(
                        'py-2.5 px-2 font-mono text-[12px]',
                        (r.plPct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      )}
                    >
                      {r.plPct != null
                        ? `${r.plPct >= 0 ? '+' : ''}${r.plPct.toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-[11px] text-cyan-300">{r.signal || '—'}</td>
                    <td className="py-2.5 px-2 text-[11px] text-gray-300">{r.risk || '—'}</td>
                    <td className="py-2.5 px-2">
                      <button
                        type="button"
                        onClick={() => setHoldings(removeHolding(r.ticker))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-gray-500">
          Open a ticker to refresh live price and AI recommendation. Positions sync with the Analysis “owns shares” toggle.
        </p>
      </GlassCard>
    </div>
  );
}
