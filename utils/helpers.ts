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
