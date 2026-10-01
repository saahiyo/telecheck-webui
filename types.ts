export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  memberCount?: number;
  memberCountCompact?: string;
  memberCountRaw?: string;
  type?: string;
  checkedAt?: string;
  savedStatus?: string;
  savedId?: number;
  contributorUsername?: string | null;
  contributorLinksAdded?: number | string | null;
  contributorFirstSeen?: string | null;
  contributorLastSeen?: string | null;
  [key: string]: any;
}

export interface LinkResult {
  link: string;
  status: 'valid' | 'invalid' | 'mega' | 'unknown' | string;
  reason?: string;
  details?: LinkMetadata;
  tags?: string[];
  cached?: boolean;
}

export interface StatsData {
  total_checked?: number;
  valid_links?: number;
  invalid_links?: number;
  [key: string]: number | undefined;
}

export interface BulkCheckResponse {
  results: LinkResult[];
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export interface GroupedResponse {
  groups: {
    valid: LinkResult[];
    invalid: LinkResult[];
    unknown: LinkResult[];
  };
  total?: number;
  credits?: string;
  truncated?: boolean;
  warning?: string;
  jobId?: string;
  status?: string;
  message?: string;
  total_links?: number;
}

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export interface StoredLink {
  id: number;
  url: string;
  platform?: string;
  status?: string;
  title?: string;
  description?: string;
  image?: string;
  member_count?: number;
  checked_at?: string;
  tags?: string[];
  contributor_username?: string | null;
  contributor_links_added?: number | string | null;
  contributor_first_seen?: string | null;
  contributor_last_seen?: string | null;
  raw_metadata?: {
    memberCountRaw?: string;
    [key: string]: any;
  } | null;
}

export interface StoredLinkResponse {
  total: number;
  limit: number;
  offset: number;
  links: StoredLink[];
}

export type LeaderboardTimeframe = 'all' | 'weekly' | 'daily';

export interface Contributor {
  rank: number;
  username: string;
  links_added: number;
  first_seen: string;
  last_seen: string;
}

export interface ContributorsResponse {
  total: number;
  limit: number;
  offset: number;
  timeframe?: LeaderboardTimeframe;
  contributors: Contributor[];
}

export interface MyProfileResponse {
  username: string | null;
  recovery_key?: string;
  links_added: number;
  rank: number | null;
  first_seen?: string;
  last_seen?: string;
  is_banned?: boolean;
  banned?: boolean;
  status?: string;
  contact?: string;
}
