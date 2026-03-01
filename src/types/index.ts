export interface UserProfile {
  country: string;
  age: number;
  relationshipStatus?: string;
  employmentStatus?: string;
  industry?: string;
  housingStatus?: string;
  isParent?: boolean;
  otherDetails?: string;
  priorityThemes?: PriorityTheme[];
}

export interface EUContent {
  id: string;
  title: string;
  description: string;
  date: string;
  relevanceScore: number;
  type: 'legislation' | 'statistic' | 'proposal' | 'news';
  countryCodes?: string[];
  ageGroups?: string[];
  sourceUrl: string;
  summary?: string;
  source?: string;
}

export interface FeedItem extends EUContent {
  summary?: string;
  source?: string;
}

export interface EurostatData {
  indicator: string;
  country: string;
  period: string;
  periodLabel: string;
  value: number;
  unit: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

export type SourceId = 'eurostat' | 'ep_rss' | 'ec_presscorner' | 'mistral';
export type FreshnessMode = 'live' | 'cached' | 'stale' | 'snapshot';
export type PriorityTheme = 'cost_of_living' | 'jobs' | 'family' | 'rights' | 'climate' | 'digital';

export interface ProvenanceRef {
  sourceId: SourceId;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  freshness: FreshnessMode;
}

export interface SourceHealth {
  sourceId: SourceId;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  stale: boolean;
}
