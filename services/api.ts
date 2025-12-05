import { LinkResult, StatsData } from '../types';

const BASE_URL = 'https://telecheck.vercel.app';

export const fetchStats = async (): Promise<StatsData> => {
  try {
    const response = await fetch(`${BASE_URL}/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    // Return empty stats/zeros on failure to prevent UI crash
    return { total_checked: 0, valid_links: 0, invalid_links: 0 };
  }
};

export const checkSingleLink = async (link: string): Promise<LinkResult> => {
  try {
    // Basic cleanup
    const cleanLink = link.trim();
    const response = await fetch(`${BASE_URL}/?link=${encodeURIComponent(cleanLink)}`);
    if (!response.ok) {
      throw new Error('Failed to check link');
    }
    const data = await response.json();

    // Normalize response if needed
    return {
      link: cleanLink,
      status: data.status?.toLowerCase() || 'unknown',
      reason: data.reason || data.message || 'No details provided'
    };
  } catch (error) {
    return {
      link,
      status: 'unknown',
      reason: error instanceof Error ? error.message : 'Network error'
    };
  }
};

export const checkBulkLinks = async (links: string[]): Promise<LinkResult[]> => {
  try {
    // Filter empty lines
    const cleanLinks = links.map(l => l.trim()).filter(l => l.length > 0);

    if (cleanLinks.length === 0) return [];

    const response = await fetch(`${BASE_URL}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ links: cleanLinks }),
    });

    if (!response.ok) {
      throw new Error('Failed to validate links');
    }

    const data = await response.json();

    // Handle different potential response structures safely
    let results: any[] = [];

    if (data.groups) {
      // Handle new grouped structure
      const valid = data.groups.valid || [];
      const invalid = data.groups.invalid || [];
      const unknown = data.groups.unknown || [];
      results = [...valid, ...invalid, ...unknown];
    } else if (Array.isArray(data)) {
      results = data;
    } else if (data.results && Array.isArray(data.results)) {
      results = data.results;
    } else {
      // Fallback if structure is unexpected
      console.warn('Unexpected API response structure', data);
      return cleanLinks.map(l => ({ link: l, status: 'unknown', reason: 'Invalid API response' }));
    }

    return results.map((r: any) => ({
      link: r.link || r.url || 'Unknown Link',
      status: r.status?.toLowerCase() || 'unknown',
      reason: r.reason || r.message || 'No reason provided'
    }));

  } catch (error) {
    console.error('Bulk check error:', error);
    // Return all as unknown/error
    return links.map(l => ({
      link: l,
      status: 'unknown',
      reason: 'Network or API Error'
    }));
  }
};
