export interface UserProfile {
  country: string;
  age: number;
  relationshipStatus?: string;
  employmentStatus?: string;
  industry?: string;
  housingStatus?: string;
  isParent?: boolean;
  otherDetails?: string;
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