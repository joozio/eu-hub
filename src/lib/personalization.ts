import { EUComparison } from '@/lib/eu-comparisons';
import { PriorityTheme, UserProfile } from '@/types';

const THEME_KEYWORDS: Record<PriorityTheme, string[]> = {
  cost_of_living: ['inflation', 'price', 'food', 'rent', 'housing', 'debt', 'income', 'wage', 'energy', 'bill'],
  jobs: ['job', 'employment', 'unemployment', 'worker', 'salary', 'career', 'business', 'traineeship'],
  family: ['family', 'child', 'children', 'parent', 'school', 'education', 'leave', 'healthcare'],
  rights: ['rights', 'protection', 'consumer', 'privacy', 'gdpr', 'directive', 'regulation', 'freedom'],
  climate: ['climate', 'co2', 'emission', 'renewable', 'green', 'energy', 'environment'],
  digital: ['digital', 'ai', 'platform', 'data', 'privacy', 'chips', 'internet', 'technology'],
};

const STAT_THEME_MAP: Record<string, PriorityTheme[]> = {
  inflation: ['cost_of_living'],
  food_inflation: ['cost_of_living'],
  median_income: ['cost_of_living', 'jobs'],
  minimum_wages: ['cost_of_living', 'jobs'],
  housing_prices: ['cost_of_living'],
  housing_cost_burden: ['cost_of_living', 'family'],
  unemployment: ['jobs'],
  youth_unemployment: ['jobs'],
  gdp_growth: ['jobs'],
  life_expectancy: ['family'],
  tertiary_education: ['family', 'jobs'],
  gender_pay_gap: ['rights', 'jobs'],
  gini: ['rights'],
  renewable_energy: ['climate'],
  greenhouse_gas: ['climate'],
  internet_access: ['digital'],
};

const THEME_LABELS: Record<PriorityTheme, string> = {
  cost_of_living: 'Cost of living',
  jobs: 'Jobs',
  family: 'Family',
  rights: 'Rights',
  climate: 'Climate',
  digital: 'Digital',
};

export interface RelevanceResult {
  score: number;
  themes: PriorityTheme[];
  reasons: string[];
}

export function normalizePriorityThemes(profile: UserProfile): PriorityTheme[] {
  return (profile.priorityThemes || []).filter((theme): theme is PriorityTheme => theme in THEME_LABELS);
}

export function inferThemesFromText(text: string): PriorityTheme[] {
  const normalized = text.toLowerCase();
  const themes = new Set<PriorityTheme>();

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS) as [PriorityTheme, string[]][]) {
    if (keywords.some((keyword) => normalized.includes(keyword))) themes.add(theme);
  }

  return Array.from(themes);
}

export function scoreByProfileThemes(profile: UserProfile, inferredThemes: PriorityTheme[]): RelevanceResult {
  const selectedThemes = normalizePriorityThemes(profile);
  if (selectedThemes.length === 0) {
    return {
      score: 0,
      themes: inferredThemes,
      reasons: inferredThemes.slice(0, 2).map((theme) => `${THEME_LABELS[theme]} focus`),
    };
  }

  let score = 0;
  const reasons: string[] = [];
  for (const theme of selectedThemes) {
    if (inferredThemes.includes(theme)) {
      score += 0.14;
      reasons.push(`${THEME_LABELS[theme]} match`);
    }
  }

  return {
    score,
    themes: inferredThemes,
    reasons,
  };
}

export function scoreFeedLikeItem(
  profile: UserProfile,
  item: { title: string; description?: string; summary?: string; relevanceScore?: number }
): RelevanceResult {
  const inferred = inferThemesFromText([item.title, item.description || '', item.summary || ''].join(' '));
  const themeScore = scoreByProfileThemes(profile, inferred);
  const base = typeof item.relevanceScore === 'number' ? item.relevanceScore : 0.5;

  return {
    score: Math.max(0, Math.min(1, base + themeScore.score)),
    themes: themeScore.themes,
    reasons: themeScore.reasons,
  };
}

export function scoreComparisonItem(profile: UserProfile, item: EUComparison): RelevanceResult {
  const inferred = inferThemesFromText(`${item.topic} ${item.euValue} ${item.worldAvg} ${item.category}`);
  const scored = scoreByProfileThemes(profile, inferred);
  return {
    score: Math.max(0, Math.min(1, 0.5 + scored.score)),
    themes: inferred,
    reasons: scored.reasons,
  };
}

export function getIndicatorPriorityWeight(indicatorId: string, profile: UserProfile): number {
  const selectedThemes = normalizePriorityThemes(profile);
  const indicatorThemes = STAT_THEME_MAP[indicatorId] || [];

  if (selectedThemes.length === 0 || indicatorThemes.length === 0) return 1;
  const matched = indicatorThemes.filter((theme) => selectedThemes.includes(theme));
  return 1 + matched.length * 0.2;
}

export function explainIndicatorRelevance(indicatorId: string, profile: UserProfile): string[] {
  const selectedThemes = normalizePriorityThemes(profile);
  const indicatorThemes = STAT_THEME_MAP[indicatorId] || [];

  return indicatorThemes
    .filter((theme) => selectedThemes.includes(theme))
    .map((theme) => `${THEME_LABELS[theme]} focus`);
}

export function getThemeLabel(theme: PriorityTheme): string {
  return THEME_LABELS[theme];
}

export const PRIORITY_THEME_OPTIONS: Array<{ id: PriorityTheme; label: string; description: string }> = [
  { id: 'cost_of_living', label: 'Cost of living', description: 'Prices, wages, rent, inflation' },
  { id: 'jobs', label: 'Jobs & income', description: 'Employment, job market, salaries' },
  { id: 'family', label: 'Family wellbeing', description: 'Healthcare, education, parental support' },
  { id: 'rights', label: 'Rights & protections', description: 'Consumer rights, privacy, legal protections' },
  { id: 'climate', label: 'Climate & environment', description: 'Emissions, renewables, green policies' },
  { id: 'digital', label: 'Digital future', description: 'AI, tech regulation, internet and data' },
];
