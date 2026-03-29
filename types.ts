export interface LinkResult {
  link: string;
  status: 'valid' | 'invalid' | 'mega' | 'unknown' | string;
  reason?: string;
  details?: any; // For any extra data API might return
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

export interface GroupedResponse {
  groups: {
    valid: LinkResult[];
    invalid: LinkResult[];
    unknown: LinkResult[];
  };
  total?: number;
  credits?: string;
}

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export interface StoredLink {
  id: number;
  url: string;
  status?: string;
  title?: string;
  description?: string;
  image?: string;
  member_count?: number;
  checked_at?: string;
}

export interface StoredLinkResponse {
  total: number;
  limit: number;
  offset: number;
  links: StoredLink[];
}
