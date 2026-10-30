/**
 * EU Hub API Service
 * Real integrations: Mistral AI (chat), Eurostat (stats)
 * Curated content: Real EU legislation with profile-enhanced personalization
 */

import { UserProfile } from '@/types';
import { getCountryName } from '@/lib/countries';

// ============================================================
// EU Content Feed - Real legislation, curated data
// ============================================================

const EU_LEGISLATION = [
  {
    id: 'eu-ai-act',
    title: 'EU AI Act - Full Application from August 2025',
    description: 'The world\'s first comprehensive AI regulation. Establishes risk-based rules for AI systems across all EU member states, with requirements for transparency, human oversight, and safety.',
    date: '2025-08-02',
    type: 'legislation' as const,
    relevanceScore: 0.95,
    countryCodes: ['ALL'],
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689',
    topics: ['technology', 'business', 'employment'],
    ageRelevance: { min: 18, max: 65 },
    industries: ['tech', 'healthcare', 'finance'],
    employmentRelevance: ['employed', 'self-employed'],
  },
  {
    id: 'eu-dsa',
    title: 'Digital Services Act - Platform Accountability',
    description: 'New rules holding online platforms accountable for content moderation, algorithmic transparency, and user protection. Applies to all platforms serving EU users.',
    date: '2024-02-17',
    type: 'legislation' as const,
    relevanceScore: 0.90,
    countryCodes: ['ALL'],
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065',
    topics: ['technology', 'consumer_rights'],
    ageRelevance: { min: 13, max: 100 },
    industries: ['tech', 'services'],
    employmentRelevance: [] as string[],
  },
  {
    id: 'eu-dma',
    title: 'Digital Markets Act - Breaking Big Tech Monopolies',
    description: 'Landmark regulation targeting tech gatekeepers (Apple, Google, Meta, Amazon, Microsoft, ByteDance). Requires interoperability, bans self-preferencing, and gives users more choice.',
    date: '2024-03-07',
    type: 'legislation' as const,
    relevanceScore: 0.88,
    countryCodes: ['ALL'],
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R1925',
    topics: ['technology', 'consumer_rights', 'business'],
    ageRelevance: { min: 18, max: 100 },
    industries: ['tech'],
    employmentRelevance: ['self-employed'],
  },
  {
    id: 'eu-green-deal',
    title: 'European Green Deal - Fit for 55 Package',
    description: 'The EU\'s plan to cut greenhouse gas emissions by 55% by 2030 and reach climate neutrality by 2050. Includes carbon border tax, renewable energy targets, and energy efficiency rules.',
    date: '2025-01-15',
    type: 'legislation' as const,
    relevanceScore: 0.85,
    countryCodes: ['ALL'],
    sourceUrl: 'https://ec.europa.eu/info/strategy/priorities-2019-2024/european-green-deal_en',
    topics: ['environment', 'energy', 'housing'],
    ageRelevance: { min: 18, max: 100 },
    industries: ['manufacturing', 'agriculture'],
    employmentRelevance: [] as string[],
  },
  {
    id: 'eu-csrd',
    title: 'Corporate Sustainability Reporting Directive (CSRD)',
    description: 'Large companies must report on sustainability impacts. Affects approximately 50,000 companies across the EU. Phased rollout from 2024 to 2028.',
    date: '2024-01-01',
    type: 'legislation' as const,
    relevanceScore: 0.75,
    countryCodes: ['ALL'],
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022L2464',
    topics: ['business', 'environment'],
    ageRelevance: { min: 25, max: 65 },
    industries: ['finance', 'manufacturing', 'services'],
    employmentRelevance: ['employed', 'self-employed'],
  },
  {
    id: 'eu-chips-act',
    title: 'European Chips Act - Semiconductor Sovereignty',
    description: 'EUR 43 billion to boost European semiconductor production to 20% of global supply by 2030. Aims to reduce dependence on Asian chip manufacturers.',
    date: '2023-09-21',
    type: 'legislation' as const,
    relevanceScore: 0.72,
    countryCodes: ['ALL'],
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R1781',
    topics: ['technology', 'employment', 'industry'],
    ageRelevance: { min: 20, max: 60 },
    industries: ['tech', 'manufacturing'],
    employmentRelevance: ['employed'],
  },
  {
    id: 'eu-youth-guarantee',
    title: 'Reinforced Youth Guarantee 2025',
    description: 'Every young person under 30 receives an offer of employment, education, apprenticeship, or traineeship within 4 months of becoming unemployed. EUR 2.5 billion in new funding.',
    date: '2025-06-01',
    type: 'legislation' as const,
    relevanceScore: 0.92,
    countryCodes: ['ALL'],
    sourceUrl: 'https://ec.europa.eu/social/main.jsp?catId=1079',
    topics: ['employment', 'education'],
    ageRelevance: { min: 18, max: 30 },
    industries: [] as string[],
    employmentRelevance: ['unemployed', 'student'],
  },
  {
    id: 'eu-right-to-repair',
    title: 'Right to Repair Directive',
    description: 'Consumers can demand repair of products instead of replacement. Manufacturers must provide spare parts and repair manuals for up to 10 years after purchase.',
    date: '2024-07-01',
    type: 'legislation' as const,
    relevanceScore: 0.80,
    countryCodes: ['ALL'],
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024L1799',
    topics: ['consumer_rights', 'environment'],
    ageRelevance: { min: 18, max: 100 },
    industries: [] as string[],
    employmentRelevance: [] as string[],
  },
  {
    id: 'eu-eidas2',
    title: 'EU Digital Identity Wallet (eIDAS 2.0)',
    description: 'Every EU citizen will have access to a digital identity wallet by 2026. Enables secure digital identification, document storage, and cross-border transactions.',
    date: '2025-11-01',
    type: 'proposal' as const,
    relevanceScore: 0.87,
    countryCodes: ['ALL'],
    sourceUrl: 'https://digital-strategy.ec.europa.eu/en/policies/eidas-regulation',
    topics: ['technology', 'consumer_rights'],
    ageRelevance: { min: 16, max: 100 },
    industries: ['tech', 'finance'],
    employmentRelevance: [] as string[],
  },
  {
    id: 'eu-net-zero',
    title: 'Net-Zero Industry Act',
    description: 'Target: 40% of clean tech manufacturing in Europe by 2030. Streamlines permits for solar panels, wind turbines, batteries, and heat pumps. New funding for green tech startups.',
    date: '2024-06-28',
    type: 'legislation' as const,
    relevanceScore: 0.78,
    countryCodes: ['ALL'],
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1735',
    topics: ['energy', 'business', 'employment'],
    ageRelevance: { min: 22, max: 55 },
    industries: ['manufacturing'],
    employmentRelevance: ['self-employed'],
  },
  // Proposals
  {
    id: 'eu-digital-euro',
    title: 'Digital Euro Proposal - New EU Currency for the Digital Age',
    description: 'The ECB is preparing a digital euro for all eurozone citizens. Free to use, privacy-preserving, and available offline. Legislative proposal under review by European Parliament.',
    date: '2025-03-01',
    type: 'proposal' as const,
    relevanceScore: 0.82,
    countryCodes: ['ALL'],
    sourceUrl: 'https://www.ecb.europa.eu/paym/digital_euro/html/index.en.html',
    topics: ['technology', 'consumer_rights'],
    ageRelevance: { min: 18, max: 100 },
    industries: ['finance', 'tech'],
    employmentRelevance: [] as string[],
  },
  {
    id: 'eu-social-climate-fund',
    title: 'Social Climate Fund - EUR 86.7B for Vulnerable Households',
    description: 'New fund to support households, micro-enterprises, and transport users affected by energy transition costs. Starts 2026, funded by EU Emissions Trading System revenues.',
    date: '2025-01-15',
    type: 'proposal' as const,
    relevanceScore: 0.80,
    countryCodes: ['ALL'],
    sourceUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0955',
    topics: ['energy', 'housing', 'consumer_rights'],
    ageRelevance: { min: 18, max: 100 },
    industries: [] as string[],
    employmentRelevance: ['unemployed', 'retired'],
  },
  // Statistics
  {
    id: 'eu-eurostat-quality-of-life',
    title: 'Eurostat: EU Quality of Life Index 2024',
    description: 'Latest Eurostat data shows EU citizens report 7.1/10 life satisfaction on average. Nordic countries lead (7.8), while Southern and Eastern Europe show fastest improvement rates.',
    date: '2025-02-01',
    type: 'statistic' as const,
    relevanceScore: 0.75,
    countryCodes: ['ALL'],
    sourceUrl: 'https://ec.europa.eu/eurostat/web/quality-of-life',
    topics: ['consumer_rights'],
    ageRelevance: { min: 18, max: 100 },
    industries: [] as string[],
    employmentRelevance: [] as string[],
  },
  {
    id: 'eu-employment-stats',
    title: 'EU Employment Rate Hits Record 75.3% in 2024',
    description: 'Eurostat reports highest-ever employment rate for people aged 20-64 in the EU. Gender gap narrowing but still 10.3 percentage points. Youth employment improving in most member states.',
    date: '2025-01-20',
    type: 'statistic' as const,
    relevanceScore: 0.78,
    countryCodes: ['ALL'],
    sourceUrl: 'https://ec.europa.eu/eurostat/databrowser/view/lfsi_emp_a/default/table',
    topics: ['employment'],
    ageRelevance: { min: 18, max: 65 },
    industries: [] as string[],
    employmentRelevance: ['employed', 'unemployed', 'student'],
  },
];

function calculateRelevance(
  item: typeof EU_LEGISLATION[0],
  profile: UserProfile
): number {
  let score = item.relevanceScore;
  const { country, age, employmentStatus, industry, isParent, housingStatus } = profile;

  // Age relevance
  if (age >= item.ageRelevance.min && age <= item.ageRelevance.max) {
    score += 0.05;
  }

  // Youth-specific boost
  if (age < 30 && item.topics.includes('employment')) score += 0.08;
  if (age < 30 && item.id === 'eu-youth-guarantee') score += 0.15;

  // Tech workers boost
  if (age >= 20 && age <= 45 && item.topics.includes('technology')) score += 0.05;

  // Country-specific
  if (item.countryCodes.includes(country)) score += 0.10;

  // Employment status match
  if (employmentStatus && item.employmentRelevance.includes(employmentStatus)) {
    score += 0.08;
  }
  // Unemployed → boost employment topics
  if (employmentStatus === 'unemployed' && item.topics.includes('employment')) {
    score += 0.10;
  }
  // Student → boost education
  if (employmentStatus === 'student' && item.topics.includes('education')) {
    score += 0.08;
  }

  // Industry match
  if (industry && item.industries.includes(industry)) {
    score += 0.10;
  }

  // Parent → boost family/education/consumer rights
  if (isParent && (item.topics.includes('consumer_rights') || item.topics.includes('education'))) {
    score += 0.06;
  }

  // Housing → boost housing/energy topics
  if (housingStatus === 'renter' && (item.topics.includes('housing') || item.topics.includes('energy'))) {
    score += 0.06;
  }

  return Math.min(score, 1.0);
}

export const fetchLatestEUContent = async (country: string, age: number) => {
  // Build minimal profile from params (feed page passes country+age)
  let profile: UserProfile = { country, age };
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('userProfile');
      if (saved) profile = { ...profile, ...JSON.parse(saved) };
    } catch { /* use defaults */ }
  }

  const data = EU_LEGISLATION.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    date: item.date,
    type: item.type,
    relevanceScore: calculateRelevance(item, profile),
    countryCodes: item.countryCodes,
    sourceUrl: item.sourceUrl,
    summary: getStaticSummary(item.id, country, age),
  })).sort((a, b) => b.relevanceScore - a.relevanceScore);

  return { success: true, data };
};

function getStaticSummary(id: string, country: string, age: number): string {
  const cn = getCountryName(country);

  const summaries: Record<string, string> = {
    'eu-ai-act': `As a ${age}-year-old in ${cn}, the AI Act means AI systems you interact with daily (from chatbots to hiring tools) must now meet safety and transparency standards. High-risk AI in employment, education, and healthcare will be strictly regulated.`,
    'eu-dsa': `The DSA gives you stronger rights over how online platforms show you content. Platforms must explain their algorithms and you can opt out of profiling-based recommendations.`,
    'eu-dma': `You'll see more choice on your devices: alternative app stores on iPhones, easier switching between messaging apps, and fairer search results not rigged by Big Tech.`,
    'eu-green-deal': `In ${cn}, this means higher energy efficiency standards for buildings, more renewable energy, and a carbon border tax on imports. Your energy bills should stabilize as renewable capacity grows.`,
    'eu-csrd': `If you work for or invest in a large company in ${cn}, they must now disclose sustainability data. This affects roughly 50,000 EU companies and their supply chains.`,
    'eu-chips-act': `${cn} can attract semiconductor investment under this act. More chip production in Europe means more high-tech jobs and less supply chain disruption risk.`,
    'eu-youth-guarantee': age < 30
      ? `This directly benefits you: if you're unemployed, ${cn} must offer you a job, training, or apprenticeship within 4 months. EUR 2.5 billion in new funding is available.`
      : `This program supports young people under 30 in ${cn} with guaranteed employment or training offers within 4 months of unemployment.`,
    'eu-right-to-repair': `You can now demand manufacturers repair your devices instead of replacing them. Spare parts and repair manuals must be available for up to 10 years in ${cn}.`,
    'eu-eidas2': `By 2026, you'll get a digital identity wallet from ${cn}'s government. Store your ID, diplomas, and medical records digitally. Use it across all 27 EU countries.`,
    'eu-net-zero': `${cn} is streamlining permits for clean energy projects. If you're in green tech or energy, this opens new business and employment opportunities.`,
    'eu-digital-euro': `A digital euro would let you make instant payments anywhere in the EU, online and offline, without bank fees. Still under proposal - watch for updates affecting ${cn}.`,
    'eu-social-climate-fund': `Starting 2026, vulnerable households in ${cn} can access EU funds to cope with rising energy costs from climate policies. If energy bills are a concern, this fund is designed for you.`,
    'eu-eurostat-quality-of-life': `EU citizens rate their life satisfaction at 7.1/10 on average. As a ${age}-year-old in ${cn}, see how your country compares in the Stats section.`,
    'eu-employment-stats': age < 30
      ? `Good news for young workers: EU youth employment is improving. As a ${age}-year-old in ${cn}, the job market is statistically better than it was 5 years ago.`
      : `EU employment hit a record 75.3% in 2024. ${cn}'s labor market is part of this positive trend, with new opportunities across sectors.`,
  };

  return summaries[id] || `This EU policy may affect citizens in ${cn}. Check the source for details specific to your situation.`;
}

// ============================================================
// Eurostat Data
// ============================================================

export const fetchEurostatData = async (country: string, indicators: string[]) => {
  try {
    const { fetchRealEurostatData } = await import('./eurostat');
    return await fetchRealEurostatData(country, indicators);
  } catch (error) {
    console.error('Eurostat fetch failed:', error);
    return { success: false as const, data: [] };
  }
};

export const fetchEurostatWithComparison = async (country: string, indicators: string[]) => {
  try {
    const { fetchWithEUComparison } = await import('./eurostat');
    return await fetchWithEUComparison(country, indicators);
  } catch (error) {
    console.error('Eurostat comparison fetch failed:', error);
    return { success: false as const, country: [], eu: [] };
  }
};

// ============================================================
// Ask EU - Mistral AI Chat
// ============================================================

export const askEUQuestion = async (question: string, profile: { country: string; age: number }) => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        country: profile.country,
        age: profile.age,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, answer: data.answer };
  } catch (error) {
    console.error('Ask EU failed:', error);
    return {
      success: false,
      answer: 'Sorry, I couldn\'t reach the AI service right now. Please try again in a moment.',
    };
  }
};
