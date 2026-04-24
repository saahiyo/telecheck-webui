import { LinkResult, StatsData, ContributorsResponse, MyProfileResponse } from '../types';

const BASE_URL =
  process.env.NEXT_PUBLIC_TELECHECK_API_URL?.replace(/\/$/, '') ||
  'https://telecheck.vercel.app';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 2; // 2 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// --------------------------------------------
// STATS
// --------------------------------------------
export const fetchStats = async (): Promise<StatsData> => {
  const cacheKey = 'stats:24h';
  const cached = getCached<StatsData>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${BASE_URL}/stats?period=24h`);
    if (!response.ok) throw new Error('Failed to fetch stats');

    const data = await response.json();
    setCache(cacheKey, data);
    return data;
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
      details: data.metadata ? {
        ...data.metadata,
        image: data.metadata.photo || data.metadata.image,
        memberCountRaw: data.metadata.memberCountRaw || data.metadata.member_count?.toLocaleString(),
      } : undefined
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

    return results.map(r => {
      const meta = r.metadata || {};
      return {
        link: r.link || r.url || 'Unknown Link',
        status: r.status?.toLowerCase() || 'unknown',
        reason: r.reason || r.message || undefined,
        details: {
          ...meta,
          image: meta.photo || meta.image,
          memberCountRaw: meta.memberCountRaw || (meta.memberCount ? meta.memberCount.toLocaleString() : undefined),
        }
      };
    });
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
// VALIDATE SAVED LINKS (re-check + delete expired from DB)
// --------------------------------------------
export const validateSavedLinks = async ({
  platform,
  limit = '100',
  offset = 0
}: {
  platform?: string;
  limit?: string;
  offset?: number;
} = {}): Promise<{
  processed: number;
  kept: number;
  deleted: number;
  skipped?: number;
  details?: Array<{ url: string; action: string; status: string }>;
}> => {
  try {
    const params = new URLSearchParams({
      limit: limit,
      offset: String(offset)
    });

    if (platform) params.set('platform', platform);

    const response = await fetch(`${BASE_URL}/links/validate?${params.toString()}`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to validate links');

    // After mutation, clear the links cache so we don't serve stale invalid links
    clearCache('links:');

    return await response.json();
  } catch (error) {
    console.error('Validate links error:', error);
    throw error;
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
}): Promise<import('../types').StoredLinkResponse | null> => {
  try {
    const cacheKey = `links:${limit}:${offset}:${platform}:${search}`;
    const cached = getCached<import('../types').StoredLinkResponse>(cacheKey);
    if (cached) return cached;

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

    const result = {
      ...data,
      links: Array.isArray(data.links) ? data.links : []
    };

    setCache(cacheKey, result);
    return result;

  } catch (error: any) {
    if (error.name === 'AbortError') {
      // Silent cancel — return null so caller knows to skip state update
      return null;
    }

    console.error('Error fetching saved links:', error);
    return { total: 0, limit, offset, links: [] };
  }
};

// --------------------------------------------
// CONTRIBUTORS
// --------------------------------------------
export const fetchContributors = async ({
  limit = 20,
  offset = 0
}: {
  limit?: number;
  offset?: number;
} = {}): Promise<ContributorsResponse> => {
  try {
    const cacheKey = `contributors:${limit}:${offset}`;
    const cached = getCached<ContributorsResponse>(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset)
    });

    const response = await fetch(`${BASE_URL}/contributors?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch contributors');

    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching contributors:', error);
    return { total: 0, limit, offset, contributors: [] };
  }
};

// --------------------------------------------
// MY PROFILE
// --------------------------------------------
export const fetchMyProfile = async (): Promise<MyProfileResponse> => {
  const cacheKey = 'profile';
  const cached = getCached<MyProfileResponse>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${BASE_URL}/contributors/me`);
    if (!response.ok) throw new Error('Failed to fetch my profile');

    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching my profile:', error);
    return { username: null, links_added: 0, rank: null };
  }
};