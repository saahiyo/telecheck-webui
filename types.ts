export interface LinkResult {
  link: string;
  status: 'valid' | 'invalid' | 'mega' | 'unknown' | string;
  reason?: string;
  details?: any; // For any extra data API might return
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
}

export interface StoredLinkResponse {
  total: number;
  limit: number;
  offset: number;
  links: StoredLink[];
}

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
  contributors: Contributor[];
}

export interface MyProfileResponse {
  username: string | null;
  recovery_key?: string;
  links_added: number;
  rank: number | null;
  first_seen?: string;
  last_seen?: string;
}
