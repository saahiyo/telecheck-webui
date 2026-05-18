import { LinkResult, StatsData, ContributorsResponse, MyProfileResponse, RateLimitInfo } from '../types';
import { formatCompactNumber } from '../utils/helpers';
import {
  appendContributorIdentity,
  getContributorIdentity,
  getContributorHeaders,
  getContributorPayload,
  rememberContributorProfile,
} from '../utils/contributorIdentity';

const BASE_URL =
  process.env.NEXT_PUBLIC_TELECHECK_API_URL?.replace(/\/$/, '') ||
  'https://telecheck.vercel.app';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 2; // 2 minutes
const ASYNC_JOB_INITIAL_POLL_MS = 500;
const ASYNC_JOB_MAX_POLL_MS = 1500;
const ASYNC_JOB_POLL_BACKOFF_MS = 250;

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

export function getMyProfileCacheKey() {
  return `profile:${getContributorIdentity().deviceId}`;
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

// ── Rate Limit Tracking ──
let _lastRateLimitInfo: RateLimitInfo | null = null;

function extractRateLimitInfo(response: Response): RateLimitInfo | null {
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  if (limit && remaining && reset) {
    const info: RateLimitInfo = {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
    };
    _lastRateLimitInfo = info;
    return info;
  }
  return null;
}

export function getLastRateLimitInfo(): RateLimitInfo | null {
  return _lastRateLimitInfo;
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
    const params = appendContributorIdentity(
      new URLSearchParams({ link: cleanLink })
    );

    const response = await fetch(
      `${BASE_URL}/?${params.toString()}`,
      { headers: getContributorHeaders() }
    );

    extractRateLimitInfo(response);

    if (response.status === 429) {
      const data = await response.json();
      return {
        link: cleanLink,
        status: 'unknown',
        reason: data.error || 'Rate limited. Please wait.',
      };
    }

    if (!response.ok) throw new Error('Failed to check link');

    const data = await response.json();
    clearCache('contributors:');
    clearCache('profile:');
    clearCache('links:');
    clearCache('stats');

    return {
      link: cleanLink,
      status: data.status?.toLowerCase() || 'unknown',
      reason: data.reason || data.message || undefined,
      cached: data.cached === true,
      details: data.metadata ? {
        ...data.metadata,
        image: data.metadata.photo || data.metadata.image,
        memberCount: data.metadata.memberCount,
        memberCountCompact: formatCompactNumber(data.metadata.memberCount),
        memberCountRaw: data.metadata.memberCount?.toLocaleString(),
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
// ASYNC JOB POLLING (for QStash background processing)
// --------------------------------------------
export type JobStatus = {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  total_links: number;
  processed_links: number;
  valid_count: number;
  invalid_count: number;
  unknown_count: number;
  results: any[];
  error?: string;
};

export const pollJobStatus = async (jobId: string): Promise<JobStatus | null> => {
  try {
    const response = await fetch(`${BASE_URL}/jobs/${jobId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

// --------------------------------------------
// BULK LINK CHECK (with async QStash support)
// --------------------------------------------
export const checkBulkLinks = async (
  links: string[],
  options?: {
    onAsyncJob?: (jobId: string) => void;
    onProgress?: (processed: number, total: number) => void;
    onStreamResults?: (results: LinkResult[]) => void;
    forceAsync?: boolean;
  }
): Promise<LinkResult[]> => {
  try {
    const cleanLinks = links.map(l => l.trim()).filter(Boolean);
    if (!cleanLinks.length) return [];

    const asyncParam = (options?.forceAsync || cleanLinks.length > 25) ? '?async=true' : '';

    const response = await fetch(`${BASE_URL}/${asyncParam}`, {
      method: 'POST',
      headers: getContributorHeaders('application/json'),
      body: JSON.stringify({
        links: cleanLinks,
        ...getContributorPayload(),
      })
    });

    extractRateLimitInfo(response);

    if (response.status === 429) {
      const data = await response.json();
      return cleanLinks.map(l => ({
        link: l,
        status: 'unknown',
        reason: data.error || 'Rate limited. Please wait.',
      }));
    }

    if (response.status !== 200 && response.status !== 202) {
      throw new Error('Failed to validate links');
    }

    const data = await response.json();

    // ── Async Job Flow (Checks for jobId instead of strict 202 status) ──
    if (data.jobId) {
      options?.onAsyncJob?.(data.jobId);

      const results: LinkResult[] = [];
      let lastProcessed = 0;
      let pollDelay = ASYNC_JOB_INITIAL_POLL_MS;

      while (true) {
        await new Promise(r => setTimeout(r, pollDelay));
        const job = await pollJobStatus(data.jobId);
        if (!job) {
          pollDelay = Math.min(pollDelay + ASYNC_JOB_POLL_BACKOFF_MS, ASYNC_JOB_MAX_POLL_MS);
          continue;
        }

        options?.onProgress?.(job.processed_links, job.total_links);

        if (job.results && job.results.length > lastProcessed) {
          const newResults: LinkResult[] = [];
          for (const r of job.results.slice(lastProcessed)) {
            const meta = r.metadata || {};
            newResults.push({
              link: r.url || r.link || 'Unknown',
              status: r.status?.toLowerCase() || 'unknown',
              cached: r.cached === true,
              details: {
                ...meta,
                image: meta.photo || meta.image,
                memberCount: meta.memberCount,
                memberCountCompact: formatCompactNumber(meta.memberCount),
                memberCountRaw: meta.memberCount?.toLocaleString(),
              }
            });
          }
          results.push(...newResults);
          options?.onStreamResults?.(newResults);
          lastProcessed = job.results.length;
          pollDelay = ASYNC_JOB_INITIAL_POLL_MS;
        } else {
          pollDelay = Math.min(pollDelay + ASYNC_JOB_POLL_BACKOFF_MS, ASYNC_JOB_MAX_POLL_MS);
        }

        if (job.status === 'completed' || job.status === 'failed') {
          break;
        }
      }

      clearCache('contributors:');
      clearCache('profile:');
      clearCache('links:');
      clearCache('stats');
      return results;
    }

    // ── Synchronous Flow ──
    clearCache('contributors:');
    clearCache('profile:');
    clearCache('links:');
    clearCache('stats');

    let apiResults: any[] = [];

    if (data.jobId) {
      // This is handled above, but just in case
      apiResults = [];
    } else if (data.groups) {
      apiResults = [
        ...(data.groups.valid || []),
        ...(data.groups.invalid || []),
        ...(data.groups.unknown || [])
      ];
    } else if (data.valid || data.invalid || data.unknown) {
      // Handle alternative grouping format
      apiResults = [
        ...(Array.isArray(data.valid) ? data.valid : []),
        ...(Array.isArray(data.invalid) ? data.invalid : []),
        ...(Array.isArray(data.unknown) ? data.unknown : [])
      ];
    } else if (Array.isArray(data)) {
      apiResults = data;
    } else if (data.data && Array.isArray(data.data)) {
      apiResults = data.data;
    } else if (Array.isArray(data.results)) {
      apiResults = data.results;
    } else if (data.error) {
      console.warn('API returned error with 200 status:', data.error);
      return cleanLinks.map(l => ({
        link: l,
        status: 'unknown',
        reason: typeof data.error === 'string' ? data.error : 'API Error'
      }));
    } else {
      console.warn('Unexpected API response:', data);
      const preview = JSON.stringify(data).substring(0, 40);
      return cleanLinks.map(l => ({
        link: l,
        status: 'unknown',
        reason: `Invalid API response: ${preview}...`
      }));
    }

    return apiResults.map(r => {
      const meta = r.metadata || {};
      return {
        link: r.link || r.url || 'Unknown Link',
        status: r.status?.toLowerCase() || 'unknown',
        reason: r.reason || r.message || undefined,
        cached: r.cached === true,
        details: {
          ...meta,
          image: meta.photo || meta.image,
          memberCount: meta.memberCount,
          memberCountCompact: formatCompactNumber(meta.memberCount),
          memberCountRaw: meta.memberCount?.toLocaleString(),
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
    appendContributorIdentity(params);

    const response = await fetch(`${BASE_URL}/links/validate?${params.toString()}`, {
      method: 'POST',
      headers: getContributorHeaders()
    });

    if (!response.ok) throw new Error('Failed to validate links');

    // After mutation, clear the links cache so we don't serve stale invalid links
    clearCache('links:');
    clearCache('contributors:');
    clearCache('profile:');
    clearCache('stats');

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
  search = '',
  tag = '',
  user = ''
}: {
  limit?: number;
  offset?: number;
  platform?: string;
  search?: string;
  tag?: string;
  user?: string;
}): Promise<import('../types').StoredLinkResponse | null> => {
  try {
    const cacheKey = `links:${limit}:${offset}:${platform}:${search}:${tag}:${user}`;
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
    if (tag && tag !== 'All') params.set('tag', tag);
    if (user) params.set('username', user);

    const response = await fetch(
      `${BASE_URL}/links?${params.toString()}`,
      { signal: controller.signal, headers: getContributorHeaders() }
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
  const profileParams = appendContributorIdentity(new URLSearchParams());
  const cacheKey = getMyProfileCacheKey();
  const cached = getCached<MyProfileResponse>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${BASE_URL}/contributors/me?${profileParams.toString()}`, {
      headers: getContributorHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch my profile');

    const data = rememberContributorProfile(await response.json());
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Error fetching my profile:', error);
    return { username: null, links_added: 0, rank: null };
  }
};

// --------------------------------------------
// TAGS
// --------------------------------------------
export const fetchTags = async (): Promise<string[]> => {
  const cacheKey = 'tags';
  const cached = getCached<{tags: string[]}>(cacheKey);
  if (cached) return cached.tags;

  try {
    const response = await fetch(`${BASE_URL}/tags`);
    if (!response.ok) throw new Error('Failed to fetch tags');

    const data = await response.json();
    setCache(cacheKey, data);
    return data.tags || [];
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
};

export const updateLinkTags = async (url: string, tags: string[]): Promise<boolean> => {
  try {
    const response = await fetch(`${BASE_URL}/links/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, tags })
    });
    
    if (!response.ok) throw new Error('Failed to update tags');
    
    // Clear links cache since data has changed
    clearCache('links:');
    clearCache('tags'); // Clear tags cache in case a new tag was added
    
    return true;
  } catch (error) {
    console.error('Error updating link tags:', error);
    return false;
  }
};
