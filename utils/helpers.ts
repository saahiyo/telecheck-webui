/**
 * Shared regex for extracting URLs (Telegram links and general HTTP links).
 * Use with `matchAll` for index-aware matching, or `match` for simple extraction.
 */
export const URL_REGEX = /(https?:\/\/[^\s,]+|t\.me\/[^\s,]+)/g;

/**
 * Check if a URL is a mega.nz link.
 */
export const isMegaLink = (url: string): boolean => /mega\.nz/i.test(url);

/**
 * Extract all URLs from a text string.
 */
export const extractUrls = (text: string): string[] => {
    return (text.match(URL_REGEX) || []).map(l => l.trim());
};

/**
 * Deduplicate an array preserving order, returning unique items and duplicate count.
 */
export const deduplicateLinks = (links: string[]): { unique: string[]; duplicateCount: number } => {
    const seen = new Set<string>();
    const unique: string[] = [];
    let duplicateCount = 0;

    for (const link of links) {
        if (seen.has(link)) {
            duplicateCount++;
        } else {
            seen.add(link);
            unique.push(link);
        }
    }

    return { unique, duplicateCount };
};

/**
 * Format a number into a compact human-readable string (e.g. 1.2K, 10.8M, 2.1B).
 */
export const formatCompactNumber = (num: number | undefined | null): string | undefined => {
    if (num == null || isNaN(num)) return undefined;
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (num >= 10_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return num.toLocaleString();
};

export const DEFAULT_TAGS = [
  'Crypto',
  'News',
  'Entertainment',
  'Finance',
  'Gaming',
  'Tech',
  'Education',
  'Music',
  'Sports',
  'Other'
];

/**
 * Extract the true member/subscriber count from a Telegram memberCountRaw string.
 * e.g. "2 408 members, 103 online" → 2408
 *      "4 393 members, 126 online" → 4393
 *      "4 952 subscribers"         → 4952
 *      "1 subscriber"              → 1
 * Returns null if the string can't be parsed.
 */
export const parseMemberCountRaw = (raw: string | undefined | null): number | null => {
  if (!raw) return null;
  // Take everything before the first comma (strips ", 103 online" etc.)
  const beforeComma = raw.split(',')[0];
  // Extract all digit sequences and join them (handles "2 408" → "2408")
  const digits = beforeComma.match(/\d+/g);
  if (!digits) return null;
  const parsed = parseInt(digits.join(''), 10);
  return isNaN(parsed) ? null : parsed;
};

export const normalizeMetadata = (meta: any) => {
  if (!meta) return undefined;

  // Prefer parsing memberCountRaw (accurate) over the raw numeric field
  // which the backend corrupts by merging member + online counts into one integer.
  const parsedCount = parseMemberCountRaw(meta.memberCountRaw);
  const memberCount = parsedCount ?? meta.memberCount;

  return {
    ...meta,
    image: meta.photo || meta.image,
    memberCount,
    memberCountCompact: formatCompactNumber(memberCount),
    memberCountRaw: memberCount?.toLocaleString(),
  };
};

