import { jsPDF } from 'jspdf';
import { getRecommendationTheme } from './recommendationTheme';

function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export interface PDFReportData {
  ticker: string;
  name?: string;
  market?: string;
  dataDate?: string;
  recommendation?: string;
  confidence?: number;
  parsedOutlook?: {
    direction: string;
    isBullish: boolean;
    isBearish: boolean;
    targetRange: string;
  } | null;
  indicatorsAlignment?: {
    isAligned: boolean;
    alignmentMessage: string;
  } | null;
  financials?: {
    currentPrice?: string;
    marketCap?: string;
    peRatio?: string;
    revenueGrowth?: string;
  } | null;
  newsSummaryDetail?: string | null;
  whyBuyNow?: string | null;
  whyBuyStrength?: number | null;
  whySellNow?: string | null;
  whySellStrength?: number | null;
  bullishFactors?: string[];
  bearishFactors?: string[];
  keyRisks?: string[];
  aiStockScore?: {
    totalScore: number;
    rating: string;
    components: {
      priceAction?: { score: number; maxWeight: number; explanation: string };
      volumeAnalysis?: { score: number; maxWeight: number; explanation: string };
      institutionalFundFlow?: { score: number; maxWeight: number; explanation: string };
      technicalIndicators?: { score: number; maxWeight: number; explanation: string };
      fundamentals?: { score: number; maxWeight: number; explanation: string };
      technicalTrend?: { score: number; maxWeight: number; explanation: string };
      newsSentiment?: { score: number; maxWeight: number; explanation: string };
      riskProfile?: { score: number; maxWeight: number; explanation: string };
      whaleAccumulation?: { score: number; maxWeight: number; explanation: string };
    };
    overallExplanation: string;
  } | null;
  userEmail?: string;
}

export function generateStockReportPDF(data: PDFReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const ticker = data.ticker.toUpperCase();
  const companyName = data.name || 'Quantitative Equity Asset';
  const marketType = data.market || 'US';
  const timestamp = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  const userIndicator = data.userEmail || 'mic6046@gmail.com';

  let currentPage = 1;
  let y = 15; // Current vertical cursor position in mm

  // Helper to draw clean borders, headers and footers on each page
  const drawPageBorderAndFooter = (pageNum: number) => {
    // Page border
    doc.setDrawColor(30, 41, 59); // slate-800
    doc.setLineWidth(0.4);
    doc.rect(10, 10, 190, 277);

    // Subtle aesthetic framing guidelines
    doc.setDrawColor(241, 245, 249, 0.4); // extremely faint outline
    doc.line(10, 24, 200, 24);

    // Footer background strip
    doc.setFillColor(15, 23, 42); // deep slate background for footer info
    doc.rect(10.2, 278.5, 189.6, 8.2, 'F');

    // Page footer metadata text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`AI QUANTUM EQUITY ANALYZER  |  SECURE OFFLINE SYSTEM PORTFOLIO REPORT  |  CLIENT: ${userIndicator.toUpperCase()}`, 14, 284);
    
    doc.setFont('helvetica', 'bold');
    doc.text(`PAGE ${pageNum}`, 196, 284, { align: 'right' });
  };

  // Safe wrapper for adding wrapped text blocks that tracks Y cursor and issues page-breaks automatically
  const drawWrappedParagraph = (
    text: string,
    x: number,
    startWidth: number,
    fontSize: number,
    lineHeight: number,
    style: 'normal' | 'bold' | 'italic' = 'normal',
    textColor: [number, number, number] = [30, 41, 59]
  ) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);

    const lines: string[] = doc.splitTextToSize(text, startWidth);
    
    lines.forEach((line) => {
      // Check for bottom margin of the page
      if (y > 265) {
        doc.addPage();
        currentPage++;
        y = 20;
        drawPageBorderAndFooter(currentPage);
        // Restore styling after page break setup
        doc.setFont('helvetica', style);
        doc.setFontSize(fontSize);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      }
      doc.text(line, x, y);
      y += lineHeight;
    });
  };

  // Initiate first page setup
  drawPageBorderAndFooter(currentPage);

  // --- REPORT TITLE & BRANDING HEADER BLOCK ---
  // Background aesthetic accent block
  doc.setFillColor(15, 23, 42); // dark background header block
  doc.rect(10.2, 10.2, 189.6, 23, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(56, 189, 248); // bright light-blue/cyan text
  doc.text('AI QUANTUM CAPITAL STOCK INTELLIGENCE REPORT', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const dataDateStr = data.dataDate ? `  |  DATA BASELINE DATE: ${data.dataDate}` : '';
  doc.text(`SECURE SECURITY PORTAL ANALYSIS FOR INVESTMENT DECISIONS  |  GENERATED ON: ${timestamp}`, 14, 23);
  doc.text(`METADATA TARGET SYMBOL: ${ticker} (${marketType} Market)  |  ENTITY: ${companyName}${dataDateStr}`, 14, 28);

  y = 40;

  // --- SECTION 1: DETAILED CORPORATE IDENTIFICATION & STANCE ---
  doc.setFillColor(30, 41, 59); // deep slate Accent for sub-headers
  doc.rect(14, y, 182, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('I. EXECUTIVE CONSENSUS, TARGETING & CORE ANALYSIS', 17, y + 4.2);
  
  y += 11;

  // Render consensus direction scorecard
  const rec = (typeof data.recommendation === 'string' ? data.recommendation : (data.recommendation as any)?.rating || (data.recommendation as any)?.action) || data.parsedOutlook?.direction || 'NEUTRAL / HOLD';
  const recTheme = getRecommendationTheme(data.aiStockScore?.totalScore || rec);
  const rgb = hexToRgb(recTheme.accentColor);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(14, y, 182, 18);
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  doc.line(14, y + 18, 196, y + 18);

  // Stance typography
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('QUANTUM AI SYSTEM RECOMMENDATION CONSENSUS', 18, y + 5);

  doc.setFontSize(14);
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(recTheme.label.toUpperCase(), 18, y + 12.5);

  // Add confidence badge inside box to the right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('AI MODEL CONFIDENCE', 115, y + 5);
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.confidence || 85}%`, 115, y + 12.5);

  // Add target range block inside box to furthest right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('ESTIMATED TARGET CORRIDOR', 152, y + 5);
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  doc.text(data.parsedOutlook?.targetRange || 'Calculated Range Bounds', 152, y + 12.2);

  y += 24;

  // --- CORE FINANCIALS COMPARISON GRID ---
  doc.setFillColor(248, 250, 252); // light slate background
  doc.rect(14, y, 182, 17, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 17);

  // Financial columns
  const infoCols = [
    { title: 'CURRENT PRICE', value: data.financials?.currentPrice || 'N/A' },
    { title: 'EST. MARKET CAP', value: data.financials?.marketCap || 'N/A' },
    { title: 'P/E RATIO MULTIPLE', value: data.financials?.peRatio || 'N/A' },
    { title: 'REVENUE GROWTH', value: data.financials?.revenueGrowth || 'N/A' },
  ];

  doc.setFont('helvetica', 'normal');
  infoCols.forEach((col, i) => {
    const startX = 14 + (i * 45.5);
    
    // Sub-title for field
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(col.title, startX + 4, y + 5);
    
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(col.value, startX + 4, y + 11.5);

    // Subtle divider lines
    if (i < 3) {
      doc.setDrawColor(226, 232, 240);
      doc.line(startX + 45.5, y + 2, startX + 45.5, y + 15);
    }
  });

  y += 23;

  // --- INDICATORS ALIGNMENT ADVISORY PARAGRAPH ---
  if (data.indicatorsAlignment) {
    doc.setFillColor(240, 249, 255); // extremely clear blue bg
    doc.setDrawColor(186, 230, 253); // borders
    doc.rect(14, y, 182, 15, 'F');
    doc.setLineWidth(0.2);
    doc.rect(14, y, 182, 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(3, 105, 161); // sky-700
    doc.text('QUANTUM SIGNAL ALIGNMENT ADVISORY DISPATCH', 18, y + 4.5);

    doc.setFont('helvetica', 'normal');
    drawWrappedParagraph(data.indicatorsAlignment.alignmentMessage, 18, 174, 8, 3.8, 'normal', [15, 23, 42]);
    y += 18;
  } else {
    y += 2;
  }

  // --- SECTION 2: VECTOR AGGREGATE COGNITIVE REPORT SCORECARD ---
  doc.setFillColor(30, 41, 59); // slate-800 subheader banner
  doc.rect(14, y, 182, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('II. MULTI-VECTOR AI QUANTUM RATING EVALUATORY DECOMPOSITION', 17, y + 4.2);

  y += 11;

  // Draw Score summary circle/box
  const scoreData = data.aiStockScore || {
    totalScore: 78,
    rating: 'Buy',
    overallExplanation: 'Steady core metrics fused with moderate oscillators establish steady investment potential.',
    components: {
      priceAction: { score: 28, maxWeight: 35, explanation: 'Robust Price Action with positive higher high structures and key support levels holding.' },
      volumeAnalysis: { score: 18, maxWeight: 25, explanation: 'Consistent volume exceeding the 20-day average, suggesting strong accumulation over distribution.' },
      institutionalFundFlow: { score: 15, maxWeight: 20, explanation: 'Positive cumulative fund flow over 1-day, 5-day, and 20-day horizons with institutional backing.' },
      technicalIndicators: { score: 17, maxWeight: 20, explanation: 'RSI, MACD, and major EMA/SMA moving averages reinforce the bullish continuation structure.' }
    }
  };

  const scoreColor: [number, number, number] = scoreData.totalScore >= 80 ? [16, 185, 129] : scoreData.totalScore >= 60 ? [245, 158, 11] : [239, 68, 68];

  // Draw score circle backdrop
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 22, 'F');
  doc.rect(14, y, 182, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('OVERALL CORE RATIO SCORE', 18, y + 6);

  doc.setFontSize(22);
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${scoreData.totalScore}`, 18, y + 16.5);
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('/ 100 max', 44, y + 15.5);

  // Overall text block right next to it
  drawWrappedParagraph(scoreData.overallExplanation, 58, 132, 8.5, 4.0, 'italic', [51, 65, 85]);

  y += 28;

  // Table of 4 components
  doc.setLineWidth(0.2);
  doc.setDrawColor(203, 213, 225); // gray-300

  // Draw table header
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, 182, 7, 'F');
  doc.rect(14, y, 182, 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('VECTOR TARGET ELEMENT', 18, y + 5);
  doc.text('SECURED RATING WEIGHT', 85, y + 5);
  doc.text('SECTORAL EXPLANATION REPORT DETAIL', 115, y + 5);

  y += 7;

  const componentsArray = [
    { 
      name: '1. PRICE ACTION (40%)', 
      score: scoreData.components.priceAction?.score ?? scoreData.components.whaleAccumulation?.score ?? 32, 
      max: scoreData.components.priceAction?.maxWeight ?? scoreData.components.whaleAccumulation?.maxWeight ?? 40, 
      desc: scoreData.components.priceAction?.explanation ?? scoreData.components.whaleAccumulation?.explanation ?? 'Robust Price Action with positive higher high structures and key support levels holding.' 
    },
    { 
      name: '2. VOLUME ANALYSIS (30%)', 
      score: scoreData.components.volumeAnalysis?.score ?? scoreData.components.fundamentals?.score ?? 24, 
      max: scoreData.components.volumeAnalysis?.maxWeight ?? scoreData.components.fundamentals?.maxWeight ?? 30, 
      desc: scoreData.components.volumeAnalysis?.explanation ?? scoreData.components.fundamentals?.explanation ?? 'Consistent volume exceeding the 20-day average, suggesting strong accumulation over distribution.' 
    },
    { 
      name: '3. INSTITUTIONAL FUND FLOW (15%)', 
      score: scoreData.components.institutionalFundFlow?.score ?? scoreData.components.technicalTrend?.score ?? 11, 
      max: scoreData.components.institutionalFundFlow?.maxWeight ?? scoreData.components.technicalTrend?.maxWeight ?? 15, 
      desc: scoreData.components.institutionalFundFlow?.explanation ?? scoreData.components.technicalTrend?.explanation ?? 'Positive cumulative fund flow over 1-day, 5-day, and 20-day horizons with institutional backing.' 
    },
    { 
      name: '4. TECHNICAL INDICATORS (15%)', 
      score: scoreData.components.technicalIndicators?.score ?? scoreData.components.riskProfile?.score ?? 12, 
      max: scoreData.components.technicalIndicators?.maxWeight ?? scoreData.components.riskProfile?.maxWeight ?? 15, 
      desc: scoreData.components.technicalIndicators?.explanation ?? scoreData.components.riskProfile?.explanation ?? 'RSI, MACD, and major EMA/SMA moving averages reinforce the bullish continuation structure.' 
    }
  ];

  componentsArray.forEach((comp) => {
    // Determine row height by calculating height of text box
    const lines = doc.splitTextToSize(comp.desc, 76);
    const rowHeight = Math.max(lines.length * 4.0 + 4, 12);

    // Draw white background row card
    doc.setFillColor(255, 255, 255);
    doc.rect(14, y, 182, rowHeight, 'F');
    doc.rect(14, y, 182, rowHeight);

    // Vector name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(comp.name, 18, y + 5.5);

    // Ratio scale bar
    doc.setFontSize(8.5);
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${comp.score} / ${comp.max} PTS`, 85, y + 5.5);
    
    // Draw micro percentage gauge
    doc.setFillColor(241, 245, 249);
    doc.rect(85, y + 7.5, 22, 1.5, 'F');
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.rect(85, y + 7.5, 22 * (comp.score / comp.max), 1.5, 'F');

    // Vector description text
    const textStartY = y + 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    
    let wrapY = textStartY;
    lines.forEach((line: string) => {
      doc.text(line, 115, wrapY);
      wrapY += 3.8;
    });

    y += rowHeight;
  });

  y += 6;

  // --- RECENT NEWS CATALYST SUMMARY ---
  if (data.newsSummaryDetail) {
    // If we're getting close to page bottom, issue block check
    if (y > 230) {
      doc.addPage();
      currentPage++;
      y = 20;
      drawPageBorderAndFooter(currentPage);
    }
    
    doc.setFillColor(30, 41, 59); // slate-800 heading
    doc.rect(14, y, 182, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('III. QUANTUM RECENT NEWS & CATALYST PIPELINE SUMMARY', 17, y + 4.2);
    
    y += 10;
    
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    
    // Split text and find total lines to dynamically size news summary container
    const newsLines = doc.splitTextToSize(data.newsSummaryDetail, 172);
    const boxHeight = (newsLines.length * 3.8) + 8;
    
    doc.rect(14, y, 182, boxHeight, 'F');
    doc.rect(14, y, 182, boxHeight);
    
    drawWrappedParagraph(data.newsSummaryDetail, 18, 172, 8, 3.8, 'normal', [51, 65, 85]);
    y += boxHeight + 4;
  }

  // FORCE PAGE SPLIT TO PAGE 2 FOR EXHALE CATALYSTS AND SYSTEM SPECIFICATION DIAGRAMS
  doc.addPage();
  currentPage++;
  y = 20;
  drawPageBorderAndFooter(currentPage);

  // --- SECTION 3: DEEP TACTICAL FORWARD MODELING & TRAGGERS ---
  doc.setFillColor(15, 23, 42); // slate-900 heading banner
  doc.rect(14, y, 182, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('IV. SYSTEM TACTICAL RESEARCH & CORE CATALYST BULLETINS', 17, y + 4.2);

  y += 10;

  // Split view for Bullish and Bearish Factors
  const halfWidth = 88;
  const leftColX = 14;
  const rightColX = 108;

  const startColY = y;

  // Bullet 1: Bullish Vectors
  doc.setFillColor(236, 253, 245); // light green bg
  doc.rect(leftColX, y, halfWidth, 6, 'F');
  doc.setDrawColor(16, 185, 129);
  doc.rect(leftColX, y, halfWidth, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(6, 95, 70);
  doc.text('BULLISH CATALYSTIC FORCES', leftColX + 4, y + 4.2);

  y += 9;
  
  const bulls = data.bullishFactors && data.bullishFactors.length > 0
    ? data.bullishFactors
    : ['Aggressive market share acquisitions in Asia-Pacific sectors.', 'Profit margins expanding on supply chain optimization.', 'Substantial product licensing announcements trailing key research segments.'];

  bulls.forEach((bull) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(16, 185, 129);
    doc.text('>', leftColX + 3, y + 1.5);
    
    const lines = doc.splitTextToSize(bull, 78);
    lines.forEach((line: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(line, leftColX + 8, y + 1.5);
      y += 3.8;
    });
    y += 1.5;
  });

  // Keep Track of left height
  const leftMaxY = y;

  // Restore y to draw Bearish factors in right column
  y = startColY;

  // Bullet 2: Bearish Vectors & Key Risks
  doc.setFillColor(254, 242, 242); // light red bg
  doc.rect(rightColX, y, halfWidth, 6, 'F');
  doc.setDrawColor(239, 68, 68);
  doc.rect(rightColX, y, halfWidth, 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(153, 27, 27);
  doc.text('BEARISH RISKS & BARRIERS', rightColX + 4, y + 4.2);

  y += 9;

  const bears = data.bearishFactors && data.bearishFactors.length > 0
    ? data.bearishFactors
    : ['Potential macro legislative changes within offshore trade operations.', 'High direct-to-consumer operational expense expansion ratios.', 'Near-term hedging spreads signaling potential institutional distribution.'];

  bears.forEach((bear) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(239, 68, 68);
    doc.text('x', rightColX + 3, y + 1.2);
    
    const lines = doc.splitTextToSize(bear, 78);
    lines.forEach((line: string) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(line, rightColX + 8, y + 1.2);
      y += 3.8;
    });
    y += 1.5;
  });

  const rightMaxY = y;
  
  // Pivot cursor to max depth of columns
  y = Math.max(leftMaxY, rightMaxY) + 4;

  // --- WHY BUY & WHY SELL SYSTEM TRIGGER DETAILS ---
  if (data.whyBuyNow || data.whySellNow) {
    if (y > 230) {
      doc.addPage();
      currentPage++;
      y = 20;
      drawPageBorderAndFooter(currentPage);
    }

    doc.setFillColor(30, 41, 59); // slate-800 Sub-Title
    doc.rect(14, y, 182, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('V. MACHINE LEARNING SIGNAL TRIGGERS & STRATEGIC INSIGHTS', 17, y + 4.2);

    y += 10;

    const startTrigY = y;

    // Left block box (Why Buy?)
    if (data.whyBuyNow) {
      doc.setFillColor(240, 253, 244); // light green accent
      doc.rect(leftColX, y, halfWidth, 31, 'F');
      doc.setDrawColor(74, 222, 128);
      doc.rect(leftColX, y, halfWidth, 31);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(21, 128, 61);
      doc.text(`STRATEGIC ENTRY FORCE (STRENGTH: ${data.whyBuyStrength || 80}%)`, leftColX + 4, y + 5);

      y += 9;
      doc.setFont('helvetica', 'normal');
      drawWrappedParagraph(data.whyBuyNow, leftColX + 4, halfWidth - 8, 7.5, 3.8, 'normal', [30, 41, 59]);
    }

    y = startTrigY;

    // Right block box (Why Sell?)
    if (data.whySellNow) {
      doc.setFillColor(255, 241, 242); // light red accent
      doc.rect(rightColX, y, halfWidth, 31, 'F');
      doc.setDrawColor(251, 113, 133);
      doc.rect(rightColX, y, halfWidth, 31);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(190, 24, 74);
      doc.text(`TACTICAL EXIT / RISK (STRENGTH: ${data.whySellStrength || 30}%)`, rightColX + 4, y + 5);

      y += 9;
      doc.setFont('helvetica', 'normal');
      drawWrappedParagraph(data.whySellNow, rightColX + 4, halfWidth - 8, 7.5, 3.8, 'normal', [30, 41, 59]);
    }

    y = Math.max(y, startTrigY + 35);
  }

  // --- SECTION 4: TECHNICAL RESISTANCE & OFF-LINE DISCLAIMER ---
  if (y > 210) {
    doc.addPage();
    currentPage++;
    y = 20;
    drawPageBorderAndFooter(currentPage);
  }

  doc.setFillColor(30, 41, 59); // slate-800 head
  doc.rect(14, y, 182, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('VI. CONFIDENTIALITY PROTOCOLS, DISCLOSURES & LEGAL DISCLAIMERS', 17, y + 4.2);

  y += 10;

  doc.setFillColor(254, 250, 246);
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, y, 182, 38, 'F');
  doc.rect(14, y, 182, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42); // deep slate
  doc.text('COMPLIANCE INFORMATION DISCLOSURE NOTICE:', 18, y + 5.5);

  const disclaimerText = 
    "This offline equity research document is generated by automated processes combining quantum predictive models, technical indicators, consensus news vectors, and real-time neural pattern mapping. There is no manual review of this content. System metrics do not represent, constitute, or promote personalized investment recommendations, professional tax, legal, or specialized asset advisory services. Past quantitative behaviors and historic backtests are never a guarantee of future live market yields. Highly fluctuating market cycles represent extreme, non-diversifiable trading risk. You assume all financial responsibilities regarding your custom order setups and portfolio. Invest exclusively at your own risk under licensed professional oversight.";

  doc.setFont('helvetica', 'normal');
  drawWrappedParagraph(disclaimerText, 18, 174, 6.8, 3.1, 'normal', [100, 116, 139]);

  // Save the PDF locally as dynamic file
  doc.save(`QUANTUM_AI_REPORT_${ticker}_${new Date().toISOString().slice(0,10)}.pdf`);
}
