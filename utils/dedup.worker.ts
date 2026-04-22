/**
 * Web Worker for offloading link extraction and deduplication tasks.
 * This prevents the main thread from freezing when processing very large lists.
 */

// Helper functions for extraction and deduplication (duplicated here to avoid complex imports in standard workers if needed, 
// but Next.js/Webpack usually handles imports in workers well)
const URL_REGEX = /(https?:\/\/[^\s,]+|t\.me\/[^\s,]+)/g;

const extractUrls = (text: string): string[] => {
    return (text.match(URL_REGEX) || []).map(l => l.trim());
};

const deduplicateLinks = (links: string[]): { unique: string[]; duplicateCount: number } => {
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

self.onmessage = (e: MessageEvent<string>) => {
    const text = e.data;
    if (!text) {
        self.postMessage({ unique: [], duplicateCount: 0 });
        return;
    }

    const allLinks = extractUrls(text);
    const result = deduplicateLinks(allLinks);
    
    self.postMessage(result);
};
