'use client';

import { useState, useRef } from 'react';

const GLOSSARY: Record<string, string> = {
  'Directive': 'EU law that sets binding goals, but lets each member state choose HOW to implement it nationally.',
  'Regulation': 'EU law that is directly and immediately binding in ALL member states — no national adaptation needed.',
  'GDPR': 'General Data Protection Regulation (2016/679). Governs how organisations process EU citizens\' personal data.',
  'AI Act': 'EU\'s AI Regulation (2024/1689). World\'s first comprehensive AI law with risk-based rules for AI systems.',
  'DSA': 'Digital Services Act. Holds online platforms accountable for illegal content and algorithmic transparency.',
  'DMA': 'Digital Markets Act. Regulates "gatekeeper" tech companies to ensure fair competition in digital markets.',
  'ETS': 'EU Emissions Trading System. Cap-and-trade scheme covering ~40% of EU greenhouse gas emissions.',
  'Eurostat': 'The statistical office of the EU, producing official statistics for 27 member states.',
  'HICP': 'Harmonised Index of Consumer Prices — the EU\'s standard inflation measure used for the ECB\'s 2% target.',
  'GDP': 'Gross Domestic Product. Total monetary value of goods and services produced in a country in a year.',
  'Gini Coefficient': 'Measures income inequality: 0 = perfect equality, 100 = maximum inequality.',
  'Eurozone': '20 EU countries that use the Euro (€) as their currency, sharing the ECB monetary policy.',
  'ECB': 'European Central Bank. Sets monetary policy and interest rates for the 20 Eurozone countries.',
  'EP': 'European Parliament. The only directly elected EU institution — 720 MEPs representing 450M citizens.',
  'European Commission': 'The EU\'s executive arm. Proposes legislation, enforces EU law, manages the EU budget.',
  'Council of the EU': 'Represents EU governments. Together with the Parliament, passes EU laws and the budget.',
  'Single Market': 'Area of 30 countries (EU + EEA) with free movement of goods, services, capital, and people.',
  'Schengen Area': '27 countries with no passport controls at internal borders. Not identical to EU membership.',
  'ERDF': 'European Regional Development Fund. Finances infrastructure and innovation in EU\'s less developed regions.',
  'ESF': 'European Social Fund. EU\'s main fund for investing in people — jobs, education, social inclusion.',
  'Cohesion Policy': 'EU strategy to reduce economic disparities between regions through structural funds.',
};

interface GlossaryTipProps {
  term: string;
  children?: React.ReactNode;
}

export function GlossaryTip({ term, children }: GlossaryTipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const definition = GLOSSARY[term];

  if (!definition) return <>{children || term}</>;

  const show = () => {
    clearTimeout(timeoutRef.current);
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 150);
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span
        tabIndex={0}
        role="term"
        aria-describedby={`gloss-${term.replace(/\s+/g, '-')}`}
        className="underline decoration-dotted decoration-eu-blue-vivid cursor-help text-inherit"
      >
        {children || term}
      </span>
      {visible && (
        <span
          id={`gloss-${term.replace(/\s+/g, '-')}`}
          role="tooltip"
          className="absolute z-50 bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white rounded-xl shadow-xl text-xs leading-relaxed pointer-events-none animate-fade-in"
          style={{ minWidth: '220px' }}
        >
          <strong className="block text-eu-gold mb-1 font-semibold">{term}</strong>
          {definition}
          <span className="absolute bottom-[-6px] left-4 w-3 h-3 bg-gray-900 rotate-45" />
        </span>
      )}
    </span>
  );
}
