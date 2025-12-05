export interface LinkResult {
  link: string;
  status: 'valid' | 'invalid' | 'unknown' | string;
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
