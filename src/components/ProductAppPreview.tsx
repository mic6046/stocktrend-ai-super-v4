import React from 'react';
import {
  Activity,
  LayoutDashboard,
  Search,
  Bot,
  Star,
  Briefcase,
  LineChart,
  Newspaper,
  Bell,
  Settings,
  LogOut,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';

/** Static visual clone of the signed-in shell — used for marketing screenshots / landing preview. */
export function ProductAppPreview() {
  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex overflow-hidden">
      <aside className="hidden lg:flex w-56 shrink-0 border-r border-white/5 bg-[#08080a] flex-col">
        <div className="px-3 py-3 border-b border-white/5">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 px-1">Navigate</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {[
            { label: 'Dashboard', Icon: LayoutDashboard, active: true },
            { label: 'Find Trades', Icon: Search },
            { label: 'AI Signals', Icon: Bot },
            { label: 'Watchlist', Icon: Star },
            { label: 'Portfolio', Icon: Briefcase },
            { label: 'Analysis', Icon: LineChart },
            { label: 'News', Icon: Newspaper },
            { label: 'Alerts', Icon: Bell },
            { label: 'Settings', Icon: Settings },
          ].map(({ label, Icon, active }) => (
            <div
              key={label}
              className={
                active
                  ? 'relative flex items-center gap-3 rounded-xl px-3 min-h-[44px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                  : 'flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-gray-400 border border-transparent'
              }
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-emerald-400" />
              )}
              <Icon className="h-4 w-4" />
              <span className="text-[12px] font-semibold">{label}</span>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/5 p-3 space-y-2">
          <div className="text-[10px] text-gray-500 font-mono truncate px-1">trader@quantum.node</div>
          <div className="w-full inline-flex items-center justify-center gap-2 min-h-[40px] rounded-xl border border-rose-500/30 bg-rose-500/10 text-[12px] font-bold text-rose-300">
            <LogOut className="h-4 w-4" /> Sign out
          </div>
          <div className="pt-1 space-y-1 text-[10px] text-gray-500">
            <p>Risk Warning</p>
            <p>Terms of Use</p>
            <p>Privacy Policy</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-white/5 px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 bg-[#050505]/92">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-black" />
            </div>
            <span className="text-sm font-extrabold tracking-tight uppercase truncate">
              QUANTUM<span className="text-emerald-500">NODE</span>
            </span>
          </div>
          <div className="hidden sm:block flex-1 max-w-xl mx-auto">
            <div className="h-9 rounded-full border border-white/10 bg-[#111113] px-4 flex items-center text-sm text-gray-500 font-mono">
              Search ticker...
            </div>
          </div>
          <div className="flex-1 sm:flex-none" />
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 h-9 items-center gap-1.5 text-[10px] font-mono text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
            </div>
            <div className="h-9 w-9 rounded-full border border-white/10 shrink-0" />
            <div className="relative h-9 w-9 rounded-full border border-white/10 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-gray-300" />
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center">
                2
              </span>
            </div>
          </div>
        </header>

        <div className="bg-[#0A0A0C] border-b border-white/5 py-2 px-3 sm:px-4 flex gap-4 sm:gap-6 font-mono text-[11px] overflow-x-auto [-webkit-overflow-scrolling:touch]">
          {[
            ['S&P 500', '5,310.50', '+0.23%', true],
            ['NASDAQ', '16,580.20', '+0.42%', true],
            ['DOW 30', '39,210.40', '-0.12%', false],
            ['RUSSELL 2000', '2,050.20', '+0.26%', true],
            ['BITCOIN', '68,540.00', '+1.85%', true],
          ].map(([name, px, ch, up]) => (
            <div key={String(name)} className="flex gap-2 shrink-0">
              <span className="text-gray-500">{name}</span>
              <span className="text-white font-semibold">{px}</span>
              <span className={up ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {ch}
              </span>
            </div>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 space-y-5 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400">
                Market Command Center
              </p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-white tracking-tight">Market Today</h2>
              <p className="mt-1 text-[13px] text-gray-500">
                A quick read of major indices and AI-ranked opportunities.
              </p>
            </div>
            <div className="rounded-xl bg-emerald-500 px-4 min-h-[44px] inline-flex items-center justify-center text-[12px] font-bold uppercase text-black shrink-0">
              Find Trades
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['S&P 500', '5310.50', '+0.23%', true],
              ['NASDAQ', '16580.20', '+0.42%', true],
              ['DOW 30', '39210.40', '-0.12%', false],
              ['RUSSELL 2000', '2050.20', '+0.26%', true],
            ].map(([n, p, c, up]) => (
              <div key={String(n)} className="rounded-2xl border border-white/10 bg-[#121214]/85 p-3.5">
                <p className="text-[10px] font-mono uppercase text-gray-500">{n}</p>
                <p className="mt-1 text-xl font-mono font-bold text-white">{p}</p>
                <p className={`mt-1 text-[12px] font-mono font-semibold flex items-center gap-1 ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {c}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-[#121214]/85 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-300 font-mono">
                AI Market Outlook
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center">
              <div className="shrink-0">
                <p className="text-[10px] uppercase text-gray-500">AI Market Sentiment</p>
                <p className="mt-1 text-2xl font-black text-emerald-400">BULLISH</p>
                <p className="mt-1 text-[12px] font-mono text-cyan-300">Confidence 78%</p>
              </div>
              <p className="text-[13px] text-gray-300 leading-relaxed flex-1">
                Technology and semiconductor momentum remains strong across major indices.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              ['Top AI Opportunities', [['NVDA', 'BUY', '87%'], ['MSFT', 'BUY', '81%'], ['AAPL', 'HOLD', '64%']]],
              ['Watch', [['TSLA', 'WAIT', '58%'], ['AMD', 'HOLD', '61%']]],
              ['Risk Alerts', [['META', 'REDUCE', '72%'], ['COIN', 'SELL', '69%']]],
            ].map(([title, rows]) => (
              <div key={String(title)} className="rounded-2xl border border-white/10 bg-[#121214]/85 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-300 font-mono mb-3">
                  {title as string}
                </p>
                <div className="space-y-2">
                  {(rows as string[][]).map(([t, s, c]) => (
                    <div key={t} className="flex items-center justify-between text-[12px] border-b border-white/[0.04] pb-2">
                      <span className="font-mono font-bold text-white">{t}</span>
                      <span className="text-cyan-300 font-semibold">{s}</span>
                      <span className="font-mono text-gray-400">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
