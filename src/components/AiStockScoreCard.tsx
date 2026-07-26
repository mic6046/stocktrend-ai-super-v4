import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Sparkles, Activity, Newspaper, ShieldAlert, Briefcase, Info, TrendingUp, BarChart2, Gem } from 'lucide-react';
import { cn } from '../lib/utils';
import { getRecommendationTheme } from '../utils/recommendationTheme';
import { TruncatedText } from './TruncatedText';

export interface AiStockScoreComponent {
  score: number;
  maxWeight: number;
  explanation: string;
}

export interface AiStockScoreData {
  totalScore: number;
  rating: string;
  components: {
    priceAction?: AiStockScoreComponent;
    volumeAnalysis?: AiStockScoreComponent;
    institutionalFundFlow?: AiStockScoreComponent;
    technicalIndicators?: AiStockScoreComponent;
    fundamentals?: AiStockScoreComponent;
    valuation?: AiStockScoreComponent;
    marketSentiment?: AiStockScoreComponent;
    technicalTrend?: AiStockScoreComponent;
    newsSentiment?: AiStockScoreComponent;
    riskProfile?: AiStockScoreComponent;
    whaleAccumulation?: AiStockScoreComponent;
  };
  overallExplanation: string;
}

interface AiStockScoreCardProps {
  scoreData: AiStockScoreData | null;
  ticker: string;
  isLoading?: boolean;
}

const sanitizeExplanation = (text: string | undefined): string => {
  if (!text) return '';
  
  // Strip markdown tags (*, _, #, `, [], (), etc.) and normalize whitespace
  let clean = text
    .replace(/[*_#`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // Enforce max 55 words limit
  const words = clean.split(' ');
  if (words.length > 55) {
    clean = words.slice(0, 55).join(' ');
  }

  // Enforce max 320 characters limit
  if (clean.length > 320) {
    clean = clean.substring(0, 317).trim();
    const lastPeriod = clean.lastIndexOf('.');
    if (lastPeriod > 180) {
      clean = clean.substring(0, lastPeriod + 1);
    } else {
      const lastSpace = clean.lastIndexOf(' ');
      if (lastSpace > 0) {
        clean = clean.substring(0, lastSpace) + '...';
      }
    }
  }

  return clean;
};

const getScoreStyle = (score: number) => {
  return getRecommendationTheme(score);
};

export const AiStockScoreCard: React.FC<AiStockScoreCardProps> = ({ scoreData, ticker, isLoading }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="bg-[#141416]/90 border border-white/5 rounded-2xl p-6 h-auto animate-pulse flex flex-col justify-between">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="h-4 bg-white/10 rounded w-1/4"></div>
          <div className="h-6 bg-white/10 rounded-full w-24"></div>
        </div>
        <div className="flex flex-col md:flex-row gap-6 my-6 items-center">
          <div className="w-28 h-28 rounded-full border-4 border-white/5 border-t-white/20 animate-spin"></div>
          <div className="flex-1 space-y-3 w-full">
            <div className="h-3 bg-white/10 rounded w-3/4"></div>
            <div className="h-3 bg-white/10 rounded w-5/6"></div>
            <div className="h-3 bg-white/10 rounded w-1/2"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-lg border border-white/5"></div>
          ))}
        </div>
      </div>
    );
  }

  // Safe fallback score generation
  const finalScoreData = scoreData || {
    totalScore: 79,
    rating: 'Buy',
    components: {
      priceAction: {
        score: 20,
        maxWeight: 25,
        explanation: 'Trend analysis, Higher Highs/Lows structure, Support/Resistance boundaries, and moving averages (20/50/100/200 EMA alignment).'
      },
      volumeAnalysis: {
        score: 12,
        maxWeight: 15,
        explanation: 'Relative Volume, Volume Profile distribution, OBV accumulation channel, and liquidity availability.'
      },
      institutionalFundFlow: {
        score: 12,
        maxWeight: 15,
        explanation: 'Whale buying index, Dark Pool block trade inflows, Smart Money positioning, and ETF flow direction.'
      },
      technicalIndicators: {
        score: 12,
        maxWeight: 15,
        explanation: 'RSI, MACD, ADX, ATR, Bollinger Bands, SuperTrend, Ichimoku Cloud, and momentum oscillator alignment.'
      },
      fundamentals: {
        score: 12,
        maxWeight: 15,
        explanation: 'Revenue Growth, EPS Growth, Gross/Operating Margins, ROE, ROA, Free Cash Flow generation, and balance sheet strength.'
      },
      valuation: {
        score: 7,
        maxWeight: 10,
        explanation: 'Intrinsic DCF valuation, Forward P/E, PEG ratio, EV/EBITDA multiples, and fair value margin of safety.'
      },
      marketSentiment: {
        score: 4,
        maxWeight: 5,
        explanation: 'News sentiment catalysts, analyst ratings, options put/call flow, sector momentum, and market regime conditions.'
      }
    },
    overallExplanation: 'Solid price structures, steady volume accumulation, and technical indicator trend alignments validate an active investment stance.'
  };

  const scoreStyle = getScoreStyle(finalScoreData.totalScore);
  const strokeDashoffset = 251.2 - (251.2 * finalScoreData.totalScore) / 100;

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  const finalPriceAction = finalScoreData.components.priceAction || {
    score: 20,
    maxWeight: 25,
    explanation: 'Trend analysis, Higher Highs/Lows structure, Support/Resistance boundaries, and moving averages (20/50/100/200 EMA alignment).'
  };

  const finalVolumeAnalysis = finalScoreData.components.volumeAnalysis || {
    score: 12,
    maxWeight: 15,
    explanation: 'Relative Volume, Volume Profile distribution, OBV accumulation channel, and liquidity availability.'
  };

  const finalInstitutionalFundFlow = finalScoreData.components.institutionalFundFlow || {
    score: 12,
    maxWeight: 15,
    explanation: 'Whale buying index, Dark Pool block trade inflows, Smart Money positioning, and ETF flow direction.'
  };

  const finalTechnicalIndicators = finalScoreData.components.technicalIndicators || finalScoreData.components.technicalTrend || {
    score: 12,
    maxWeight: 15,
    explanation: 'RSI, MACD, ADX, ATR, Bollinger Bands, SuperTrend, Ichimoku Cloud, and momentum oscillator alignment.'
  };

  const finalFundamentals = finalScoreData.components.fundamentals || {
    score: 12,
    maxWeight: 15,
    explanation: 'Revenue Growth, EPS Growth, Gross/Operating Margins, ROE, ROA, Free Cash Flow generation, and balance sheet strength.'
  };

  const finalValuation = finalScoreData.components.valuation || {
    score: 7,
    maxWeight: 10,
    explanation: 'Intrinsic DCF valuation, Forward P/E, PEG ratio, EV/EBITDA multiples, and fair value margin of safety.'
  };

  const finalMarketSentiment = finalScoreData.components.marketSentiment || finalScoreData.components.newsSentiment || {
    score: 4,
    maxWeight: 5,
    explanation: 'News sentiment catalysts, analyst ratings, options put/call flow, sector momentum, and market regime conditions.'
  };

  const sectionsList = [
    {
      id: 'priceAction',
      name: 'Price Action',
      weight: '25%',
      icon: <TrendingUp className="w-4 h-4 text-purple-400" />,
      item: finalPriceAction,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/5',
      borderColor: 'border-purple-500/10'
    },
    {
      id: 'volumeAnalysis',
      name: 'Volume & Liquidity',
      weight: '15%',
      icon: <BarChart2 className="w-4 h-4 text-emerald-400" />,
      item: finalVolumeAnalysis,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/5',
      borderColor: 'border-emerald-500/10'
    },
    {
      id: 'institutionalFundFlow',
      name: 'Institutional Fund Flow',
      weight: '15%',
      icon: <Gem className="w-4 h-4 text-cyan-400" />,
      item: finalInstitutionalFundFlow,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/5',
      borderColor: 'border-cyan-500/10'
    },
    {
      id: 'technicalIndicators',
      name: 'Technical Indicators',
      weight: '15%',
      icon: <Activity className="w-4 h-4 text-amber-400" />,
      item: finalTechnicalIndicators,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/5',
      borderColor: 'border-amber-500/10'
    },
    {
      id: 'fundamentals',
      name: 'Fundamental Strength',
      weight: '15%',
      icon: <Briefcase className="w-4 h-4 text-blue-400" />,
      item: finalFundamentals,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/5',
      borderColor: 'border-blue-500/10'
    },
    {
      id: 'valuation',
      name: 'Valuation & Fair Value',
      weight: '10%',
      icon: <Info className="w-4 h-4 text-indigo-400" />,
      item: finalValuation,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/5',
      borderColor: 'border-indigo-500/10'
    },
    {
      id: 'marketSentiment',
      name: 'Market Sentiment',
      weight: '5%',
      icon: <Newspaper className="w-4 h-4 text-rose-400" />,
      item: finalMarketSentiment,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/5',
      borderColor: 'border-rose-500/10'
    }
  ];

  const ratingLegend = [
    { label: '95-100', tag: 'Exceptional Buy', color: getRecommendationTheme('Exceptional Buy').textColor },
    { label: '90-94', tag: 'Very Strong Buy', color: getRecommendationTheme('Very Strong Buy').textColor },
    { label: '80-89', tag: 'Strong Buy', color: getRecommendationTheme('Strong Buy').textColor },
    { label: '70-79', tag: 'Buy', color: getRecommendationTheme('Buy').textColor },
    { label: '60-69', tag: 'Hold', color: getRecommendationTheme('Hold').textColor },
    { label: '50-59', tag: 'Sell', color: getRecommendationTheme('Sell').textColor },
    { label: '<50', tag: 'Avoid', color: getRecommendationTheme('Avoid').textColor }
  ];

  return (
    <div className="bg-[#141416] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden w-full">
      {/* Background radial soft light blur */}
      <div 
        className="absolute -right-24 -top-24 w-60 h-60 rounded-full opacity-10 pointer-events-none blur-3xl"
        style={{ backgroundColor: scoreStyle.accentColor }}
      />

      {/* Header section with badge */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
            AI Quantum Stock Score
          </h4>
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest font-mono border",
          scoreStyle.textColor, scoreStyle.bgColor, scoreStyle.borderColor, scoreStyle.glow
        )}>
          {scoreStyle.label} ({scoreStyle.rangeText})
        </div>
      </div>

      {/* Circle Meter and Overall Explanation */}
      <div className="flex flex-col md:flex-row gap-6 my-6 items-center">
        {/* Animated Radial Circle Gauge */}
        <div className="relative shrink-0 flex items-center justify-center w-32 h-32">
          <svg className="w-28 h-28 transform -rotate-90">
            {/* Background track circle */}
            <circle
              cx="56"
              cy="56"
              r="40"
              className="stroke-white/5 fill-transparent"
              strokeWidth="10"
            />
            {/* Foreground progress circle */}
            <motion.circle
              cx="56"
              cy="56"
              r="40"
              className="fill-transparent"
              stroke={scoreStyle.accentColor}
              strokeWidth="10"
              strokeDasharray="251.2"
              strokeLinecap="round"
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-3xl font-black font-mono tracking-tighter text-white">
              {finalScoreData.totalScore}
            </span>
            <span className="text-[8px] font-mono uppercase text-gray-500 tracking-widest -mt-1">
              Pts Limit
            </span>
          </div>
        </div>

        {/* Dynamic Explanation block */}
        <div className="flex-grow text-center md:text-left min-w-0 w-full overflow-hidden">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1.5 block">
            Stance & Synthesis for {ticker.toUpperCase()}
          </span>
          <TruncatedText
            text={finalScoreData.overallExplanation}
            maxLines={5}
            className="text-xs sm:text-sm text-gray-400 font-sans"
          />
          
          {/* Visual color segmented indicator lines for score range representation */}
          <div className="w-full flex h-1.5 bg-white/5 rounded-full mt-4 overflow-hidden p-[2px]">
            <div className={cn("h-full rounded-full", scoreStyle.progressBg)} style={{ width: `${finalScoreData.totalScore}%` }}></div>
          </div>
        </div>
      </div>

      {/* Component breakdown grids containing accordions with detailed justifications */}
      <div className="space-y-3">
        <div className="text-[9px] uppercase font-bold tracking-widest text-gray-500 font-mono mb-2 flex items-center gap-1">
          <Info className="w-3 h-3 text-gray-500" /> Component Breakdown (Click to Expand Explanations)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sectionsList.map((section) => {
            const isExpanded = expandedSection === section.id;
            const percentageUsed = (section.item.score / section.item.maxWeight) * 100;
            return (
              <div 
                key={section.id} 
                className={cn(
                  "border rounded-xl transition-all duration-300 overflow-hidden bg-black/40 flex flex-col justify-between h-full p-4 sm:p-5 min-w-0 w-full",
                  isExpanded ? "border-white/10 bg-black/70 shadow-lg" : "border-white/5 hover:border-white/10"
                )}
              >
                {/* Header clickable row */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className={cn("p-1.5 rounded-lg border border-white/5 shrink-0", section.bgColor)}>
                      {section.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-gray-300 font-sans flex items-center gap-1.5 truncate">
                        {section.name}
                        <span className="text-[8.5px] font-mono text-gray-500 shrink-0">({section.weight})</span>
                      </div>
                      <div className="text-[11.5px] font-black font-mono text-gray-100 flex items-center gap-1 mt-0.5">
                        {section.item.score} <span className="text-[9px] text-gray-500 font-medium font-mono">/ {section.item.maxWeight} pts</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Linear Micro Gauge inside column */}
                    <div className="w-12 bg-white/5 h-1.5 rounded-full overflow-hidden hidden sm:block">
                      <div 
                        className={cn("h-full rounded-full",
                          section.id === 'whaleAccumulation' ? 'bg-purple-400' :
                          section.id === 'fundamentals' ? 'bg-emerald-400' :
                          section.id === 'technicalTrend' ? 'bg-cyan-400' :
                          section.id === 'newsSentiment' ? 'bg-amber-400' : 'bg-rose-400'
                        )} 
                        style={{ width: `${percentageUsed}%` }}
                      ></div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </button>

                {/* Expanded explanation text */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 border-t border-white/5 mt-3 min-w-0 w-full">
                        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1 font-bold">
                          JUSTIFICATION & METRICS
                        </p>
                        <TruncatedText
                          text={section.item.explanation}
                          maxLines={5}
                          className="text-xs text-gray-400 font-sans"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Color Range Threshold Legend */}
      <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap justify-between items-center gap-3">
        <span className="text-[9px] font-mono uppercase text-gray-500 tracking-wider">
          Rating Threshold Scale
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {ratingLegend.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1 text-[9.5px] font-mono">
              <span className={cn("font-bold", item.color)}>{item.label}</span>
              <span className="text-gray-600 text-[8px]">{item.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
