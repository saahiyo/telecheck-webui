import { LinkResult, StatsData } from '../types';

const BASE_URL =
  process.env.NEXT_PUBLIC_TELECHECK_API_URL?.replace(/\/$/, '') ||
  'https://telecheck.vercel.app';

// --------------------------------------------
// STATS
// --------------------------------------------
export const fetchStats = async (): Promise<StatsData> => {
  try {
    const response = await fetch(`${BASE_URL}/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');

    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    return { total_checked: 0, valid_links: 0, invalid_links: 0 };
  }
};

// --------------------------------------------
// SINGLE LINK CHECK
// --------------------------------------------
export const checkSingleLink = async (link: string): Promise<LinkResult> => {
  try {
    const cleanLink = link.trim();

    const response = await fetch(
      `${BASE_URL}/?link=${encodeURIComponent(cleanLink)}`
    );

    if (!response.ok) throw new Error('Failed to check link');

    const data = await response.json();

    return {
      link: cleanLink,
      status: data.status?.toLowerCase() || 'unknown',
      reason: data.reason || data.message || undefined,
      details: data.metadata
    };
  } catch (error) {
    return {
      link,
      status: 'unknown',
      reason: error instanceof Error ? error.message : 'Network error'
    };
  }
};

// --------------------------------------------
// BULK LINK CHECK
// --------------------------------------------
export const checkBulkLinks = async (
  links: string[]
): Promise<LinkResult[]> => {
  try {
    const cleanLinks = links.map(l => l.trim()).filter(Boolean);
    if (!cleanLinks.length) return [];

    const response = await fetch(`${BASE_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links: cleanLinks })
    });

    if (!response.ok) throw new Error('Failed to validate links');

    const data = await response.json();

    let results: any[] = [];

    if (data.groups) {
      results = [
        ...(data.groups.valid || []),
        ...(data.groups.invalid || []),
        ...(data.groups.unknown || [])
      ];
    } else if (Array.isArray(data)) {
      results = data;
    } else if (Array.isArray(data.results)) {
      results = data.results;
    } else {
      console.warn('Unexpected API response:', data);
      return cleanLinks.map(l => ({
        link: l,
        status: 'unknown',
        reason: 'Invalid API response'
      }));
    }

    return results.map(r => ({
      link: r.link || r.url || 'Unknown Link',
      status: r.status?.toLowerCase() || 'unknown',
      reason: r.reason || r.message || undefined,
      details: r.metadata
    }));
  } catch (error) {
    console.error('Bulk check error:', error);
    return links.map(l => ({
      link: l,
      status: 'unknown',
      reason: 'Network or API Error'
    }));
  }
};

// --------------------------------------------
// SAVED LINKS (with search + abort control)
// --------------------------------------------

// Global controller to cancel previous requests
let controller: AbortController | null = null;

export const fetchSavedLinks = async ({
  limit = 50,
  offset = 0,
  platform = 'telegram',
  search = ''
}: {
  limit?: number;
  offset?: number;
  platform?: string;
  search?: string;
}): Promise<import('../types').StoredLinkResponse> => {
  try {
    // Cancel previous request (important for search typing)
    if (controller) controller.abort();
    controller = new AbortController();

    const params = new URLSearchParams({
      platform,
      limit: String(limit),
      offset: String(offset)
    });

    if (search) params.set('search', search);

    const response = await fetch(
      `${BASE_URL}/links?${params.toString()}`,
      { signal: controller.signal }
    );

    if (!response.ok) throw new Error('Failed to fetch saved links');

    const data = await response.json();

    return {
      ...data,
      links: Array.isArray(data.links) ? data.links : []
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Silent cancel (expected behavior)
      return { total: 0, limit, offset, links: [] };
    }

    console.error('Error fetching saved links:', error);
    return { total: 0, limit, offset, links: [] };
  }
};