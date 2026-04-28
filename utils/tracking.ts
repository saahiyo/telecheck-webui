"use client";

import { track } from "@databuddy/sdk";

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    track(eventName, properties);
  }
};

// Validation events
export const trackBulkValidation = (linkCount: number, hasDuplicates: boolean) => {
  trackEvent("bulk_validation_started", {
    link_count: linkCount,
    has_duplicates: hasDuplicates,
    mode: "bulk"
  });
};

export const trackSingleValidation = (link: string) => {
  trackEvent("single_validation_started", {
    mode: "single",
    link_domain: link.includes('t.me') ? 'telegram' : 'other'
  });
};

export const trackValidationComplete = (results: any[]) => {
  const validCount = results.filter(r => r.status?.toLowerCase() === 'valid').length;
  const invalidCount = results.filter(r => r.status?.toLowerCase() === 'invalid').length;
  const megaCount = results.filter(r => r.details?.isMega).length;

  trackEvent("validation_completed", {
    total_results: results.length,
    valid_count: validCount,
    invalid_count: invalidCount,
    mega_count: megaCount,
    success_rate: results.length > 0 ? validCount / results.length : 0
  });
};

// Link interaction events
export const trackLinkCopy = (link: string, context: string) => {
  trackEvent("link_copied", {
    context,
    link_domain: link.includes('t.me') ? 'telegram' : 'other'
  });
};

export const trackLinkPreview = (link: string) => {
  trackEvent("link_preview_opened", {
    link_domain: link.includes('t.me') ? 'telegram' : 'other'
  });
};

export const trackTagModalOpen = (link: string) => {
  trackEvent("tag_modal_opened", {
    link_domain: link.includes('t.me') ? 'telegram' : 'other'
  });
};

export const trackTagToggle = (link: string, tag: string, action: 'added' | 'removed') => {
  trackEvent("tag_toggled", {
    tag,
    action,
    link_domain: link.includes('t.me') ? 'telegram' : 'other'
  });
};

// Saved links events
export const trackSearchQuery = (query: string, resultCount: number) => {
  trackEvent("saved_links_searched", {
    query_length: query.length,
    has_results: resultCount > 0,
    result_count: resultCount
  });
};

export const trackFilterChange = (filter: string, tag?: string) => {
  trackEvent("saved_links_filtered", {
    filter,
    tag_filter: tag || 'all'
  });
};

export const trackSortChange = (sort: string) => {
  trackEvent("saved_links_sorted", {
    sort_method: sort
  });
};

export const trackLinksRefresh = (linkCount: number) => {
  trackEvent("saved_links_refreshed", {
    link_count: linkCount
  });
};

export const trackLinksValidate = (linkCount: number) => {
  trackEvent("saved_links_validated", {
    link_count: linkCount
  });
};

export const trackCopyModalOpen = (linkCount: number) => {
  trackEvent("copy_modal_opened", {
    link_count: linkCount
  });
};

export const trackPagination = (page: number, totalPages: number) => {
  trackEvent("pagination_used", {
    page,
    total_pages: totalPages
  });
};

// UI events
export const trackThemeToggle = (theme: 'light' | 'dark') => {
  trackEvent("theme_toggled", {
    theme
  });
};

export const trackNavigation = (page: string) => {
  trackEvent("navigation_clicked", {
    destination: page
  });
};

export const trackModeSwitch = (mode: 'bulk' | 'single') => {
  trackEvent("mode_switched", {
    mode
  });
};