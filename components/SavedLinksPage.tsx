import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Loader2, Database, RefreshCw, Layers, ShieldCheck, ListChecks, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import debounce from 'lodash.debounce';
import { fetchSavedLinks, validateSavedLinks, getCached } from '../services/api';
import { StoredLink, LinkResult, StoredLinkResponse } from '../types';
import { toast } from 'sonner';
import ResultCard from './ResultCard';
import LinkCopyModal from './LinkCopyModal';

interface SavedLinksPageProps {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export interface SavedLinksPageHandle {
  scrollToBoundary: (target: 'top' | 'bottom') => void;
}

type SavedFilter = 'all' | 'with-description' | 'with-image' | 'with-members' | 'recent';
type SavedSort = 'recently-updated' | 'recently-added' | 'random';

const SORT_CHIPS: Array<{ value: SavedSort; label: string; shortLabel: string }> = [
  { value: 'recently-updated', label: 'Recently Updated', shortLabel: 'Updated' },
  { value: 'recently-added', label: 'Recently Added', shortLabel: 'Added' },
  { value: 'random', label: 'Random', shortLabel: 'Random' },
];

// Client-side filter for metadata attributes (not search — search is server-side)
function filterByMetadata(sourceLinks: StoredLink[], savedFilter: SavedFilter) {
  if (savedFilter === 'all') return sourceLinks;

  return sourceLinks.filter((link) => {
    if (savedFilter === 'with-description') return !!link.description?.trim();
    if (savedFilter === 'with-image') return !!link.image?.trim();
    if (savedFilter === 'with-members') return typeof link.member_count === 'number' && link.member_count > 0;
    if (savedFilter === 'recent') return !!link.checked_at;
    return true;
  });
}

function formatSavedDate(dateValue?: string | number | Date) {
  if (!dateValue) return '';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getSortableTimestamp(dateValue?: string | number | Date) {
  if (!dateValue) return 0;

  const timestamp = new Date(dateValue).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getRandomWeight(link: StoredLink, seed: number) {
  const input = `${seed}:${link.id ?? 'no-id'}:${link.url}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function sortSavedLinks(sourceLinks: StoredLink[], savedSort: SavedSort, randomSeed: number) {
  const sortedLinks = [...sourceLinks];

  if (savedSort === 'recently-updated') {
    return sortedLinks.sort((left, right) => {
      const checkedAtDiff = getSortableTimestamp(right.checked_at) - getSortableTimestamp(left.checked_at);
      if (checkedAtDiff !== 0) return checkedAtDiff;
      return (right.id ?? 0) - (left.id ?? 0);
    });
  }

  if (savedSort === 'recently-added') {
    return sortedLinks.sort((left, right) => {
      const idDiff = (right.id ?? 0) - (left.id ?? 0);
      if (idDiff !== 0) return idDiff;
      return getSortableTimestamp(right.checked_at) - getSortableTimestamp(left.checked_at);
    });
  }

  return sortedLinks.sort((left, right) => {
    const weightDiff = getRandomWeight(left, randomSeed) - getRandomWeight(right, randomSeed);
    if (weightDiff !== 0) return weightDiff;
    return (right.id ?? 0) - (left.id ?? 0);
  });
}

const SavedLinksPage = React.forwardRef<SavedLinksPageHandle, SavedLinksPageProps>(function SavedLinksPage({ searchInputRef }, ref) {
  const PAGE_SIZE = 100;
  
  // Synchronous cache read for instant mount
  const initialCache = getCached<StoredLinkResponse>(`links:${PAGE_SIZE}:0:telegram:`);
  
  const [links, setLinks] = useState<StoredLink[]>(initialCache?.links || []);
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [isSearching, setIsSearching] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [total, setTotal] = useState(initialCache?.total || 0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all');
  const [savedSort, setSavedSort] = useState<SavedSort>('recently-updated');
  const [randomSeed, setRandomSeed] = useState(() => Date.now());
  const [showScrollJump, setShowScrollJump] = useState(false);
  const [scrollJumpTarget, setScrollJumpTarget] = useState<'top' | 'bottom'>('bottom');
  const [scrollJumpContext, setScrollJumpContext] = useState<'container' | 'window'>('window');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const resultsScrollRef = useRef<HTMLDivElement | null>(null);
  const hasDataRef = useRef(false);

  // Debounced handler: updates the query sent to the API after 300ms of inactivity
  const debouncedSetSearch = useMemo(
    () => debounce((q: string) => {
      setDebouncedSearchQuery(q);
      setPage(1); // Reset to first page on new search
    }, 300),
    []
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [debouncedSetSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);            // Instant UI update
    setIsSearching(true);             // Show inline spinner immediately
    debouncedSetSearch(value);        // Delayed API call
  };

  const handleClearSearch = () => {
    debouncedSetSearch.cancel();
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setIsSearching(false);
    setPage(1);
  };

  const loadLinks = useCallback(async (currentPage: number, search: string) => {
    // Only show full-page spinner if it's initial load (no data), otherwise keep cards visible
    if (!hasDataRef.current) setIsLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const data = await fetchSavedLinks({ limit: PAGE_SIZE, offset, search });

      // If request was aborted (null), skip state update to avoid wiping current data
      if (data === null) return;

      setLinks(data.links || []);
      setTotal(data.total || 0);
      hasDataRef.current = (data.links?.length ?? 0) > 0;
    } catch (error) {
      toast.error('Failed to load saved links from database.');
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    loadLinks(page, debouncedSearchQuery);
  }, [page, debouncedSearchQuery]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadLinks(page, debouncedSearchQuery);
  };

  const handleSortChange = (nextSort: SavedSort) => {
    if (nextSort === 'random') {
      setRandomSeed(Date.now());
    }

    setSavedSort(nextSort);
  };

  const handleValidate = async () => {
    if (links.length === 0) return;
    setIsValidating(true);
    const toastId = toast.loading('Re-validating ALL stored links and removing expired ones...');
    
    try {
      const result = await validateSavedLinks({ limit: 'all' });
      
      const skipped = result.skipped || 0;
      const msg = skipped > 0
        ? `Kept ${result.kept}, removed ${result.deleted}, skipped ${skipped} (unreachable).`
        : `Kept ${result.kept} links, removed ${result.deleted} expired links.`;

      toast.success(`Validation complete! ${msg}`,
        { id: toastId }
      );

      // Refresh links from DB to reflect deletions
      await loadLinks(page, debouncedSearchQuery);
    } catch (error) {
      toast.error('An error occurred during validation.', { id: toastId });
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidatePage = async () => {
    if (links.length === 0) return;
    setIsValidating(true);
    const offset = (page - 1) * PAGE_SIZE;
    const toastId = toast.loading(`Validating ${links.length} links on this page...`);
    
    try {
      const result = await validateSavedLinks({
        limit: String(PAGE_SIZE),
        offset
      });
      
      const skipped = result.skipped || 0;
      const msg = skipped > 0
        ? `Kept ${result.kept}, removed ${result.deleted}, skipped ${skipped} (unreachable).`
        : `Kept ${result.kept} links, removed ${result.deleted} expired links.`;

      toast.success(`Page validated! ${msg}`,
        { id: toastId }
      );

      // Refresh current page
      await loadLinks(page, debouncedSearchQuery);
    } catch (error) {
      toast.error('An error occurred during page validation.', { id: toastId });
    } finally {
      setIsValidating(false);
    }
  };

  // Client-side: filter by metadata attributes only, search is handled server-side
  const filteredLinks = useMemo(() => filterByMetadata(links, savedFilter), [links, savedFilter]);
  const sortedLinks = useMemo(() => sortSavedLinks(filteredLinks, savedSort, randomSeed), [filteredLinks, savedSort, randomSeed]);

  // Pre-compute adapted results so React.memo'd ResultCards receive stable object references
  const adaptedResults = useMemo(() => sortedLinks.map((savedLink, idx) => ({
    key: savedLink.id || idx,
    result: {
      link: savedLink.url,
      status: savedLink.status || 'valid',
      reason: `Saved on ${formatSavedDate(savedLink.checked_at || Date.now())}`,
      details: {
        title: savedLink.title || savedLink.description || 'Database Link',
        description: savedLink.description,
        image: savedLink.image,
        memberCountRaw: savedLink.member_count?.toLocaleString(),
        checkedAt: savedLink.checked_at,
        savedStatus: savedLink.status,
        savedId: savedLink.id
      }
    } as LinkResult
  })), [sortedLinks]);

  const hasPagination = total > PAGE_SIZE;

  // Summary text
  const savedLinksSummary = (() => {
    if (debouncedSearchQuery) {
      return `${filteredLinks.length} results for "${debouncedSearchQuery}" · ${total} matched`;
    }
    if (savedFilter !== 'all') {
      return `${filteredLinks.length} filtered · ${links.length} loaded · ${total} total`;
    }
    if (total > links.length) {
      return `${links.length}/${total} saved`;
    }
    return `${total} saved`;
  })();

  // Throttle scroll handler with rAF to avoid firing setState on every scroll pixel
  const scrollRafRef = useRef<number>(0);
  const updateScrollJumpState = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const container = resultsScrollRef.current;
      const containerMaxScrollTop = container ? container.scrollHeight - container.clientHeight : 0;
      const pageMaxScrollTop = document.documentElement.scrollHeight - window.innerHeight;

      const useContainer = containerMaxScrollTop > 24;
      const currentScrollTop = useContainer
        ? container?.scrollTop || 0
        : window.scrollY || document.documentElement.scrollTop || 0;
      const maxScrollTop = useContainer ? containerMaxScrollTop : pageMaxScrollTop;

      setScrollJumpContext(useContainer ? 'container' : 'window');

      if (maxScrollTop <= 24) {
        setShowScrollJump(false);
        setScrollJumpTarget('bottom');
        return;
      }

      setShowScrollJump(currentScrollTop > 32);
      setScrollJumpTarget(currentScrollTop >= maxScrollTop / 2 ? 'top' : 'bottom');
    });
  }, []);

  useEffect(() => {
    updateScrollJumpState();
  }, [filteredLinks.length, page, savedFilter, searchQuery, updateScrollJumpState]);

  useEffect(() => {
    const handleResize = () => updateScrollJumpState();
    const handleWindowScroll = () => updateScrollJumpState();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [updateScrollJumpState]);

  const scrollToBoundary = useCallback((target: 'top' | 'bottom') => {
    const container = resultsScrollRef.current;
    const containerMaxScrollTop = container ? container.scrollHeight - container.clientHeight : 0;
    const targetTop = target === 'top' ? 0 : Number.MAX_SAFE_INTEGER;

    if (containerMaxScrollTop > 24 && container) {
      container.scrollTo({
        top: targetTop,
        behavior: 'smooth'
      });
      return;
    }

    window.scrollTo({
      top: targetTop,
      behavior: 'smooth'
    });
  }, []);

  const handleScrollJump = () => {
    scrollToBoundary(scrollJumpTarget);
  };

  React.useImperativeHandle(ref, () => ({
    scrollToBoundary,
  }), [scrollToBoundary]);



  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="flex gap-3 sm:flex-row sm:items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-full flex items-center justify-center shadow-sm">
            <Database size={18} className="text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">Saved Links</h2>
            <p className="text-xs text-gray-500 font-medium">{savedLinksSummary}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0 sm:hidden">
          <button 
            onClick={() => setIsCopyModalOpen(true)}
            disabled={links.length === 0}
            title="Copy links"
            aria-label="Copy links"
            className="h-10 w-10 bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all rounded-lg flex items-center justify-center shadow-sm"
          >
            <Copy size={15} />
          </button>
          <button 
            onClick={handleRefresh}
            disabled={isLoading || isValidating}
            title="Refresh saved links"
            aria-label="Refresh saved links"
            className="h-10 w-10 bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all rounded-lg flex items-center justify-center shadow-sm"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={handleValidatePage}
            disabled={isValidating || links.length === 0}
            title="Validate this page"
            aria-label="Validate this page"
            className="h-10 w-10 bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all rounded-lg flex items-center justify-center shadow-sm"
          >
            {isValidating ? <Loader2 size={15} className="animate-spin" /> : <ListChecks size={15} />}
          </button>
          <button 
            onClick={handleValidate}
            disabled={isValidating || links.length === 0}
            title={isValidating ? 'Validating...' : 'Validate all links'}
            aria-label={isValidating ? 'Validating...' : 'Validate all links'}
            className="h-10 w-10 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all rounded-lg flex items-center justify-center shadow-sm"
          >
            {isValidating ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          </button>
        </div>

        <div className="hidden sm:flex sm:items-center sm:gap-2 shrink-0">
          <button
            onClick={() => setIsCopyModalOpen(true)}
            disabled={links.length === 0}
            className="text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all px-3 py-2 rounded-md flex items-center justify-center gap-2 shadow-sm"
          >
            <Copy size={14} />
            <span>Copy Links</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading || isValidating}
            className="text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all px-3 py-2 rounded-md flex items-center justify-center gap-2 shadow-sm"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleValidatePage}
            disabled={isValidating || links.length === 0}
            className="text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all px-3 py-2 rounded-md flex items-center justify-center gap-2 shadow-sm"
          >
            {isValidating ? <Loader2 size={14} className="animate-spin" /> : <ListChecks size={14} />}
            <span>Validate Page</span>
          </button>
          <button
            onClick={handleValidate}
            disabled={isValidating || links.length === 0}
            className="text-xs font-semibold bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all px-4 py-2 rounded-md flex items-center justify-center gap-2 shadow-sm"
          >
            {isValidating ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            <span>{isValidating ? 'Validating...' : 'Validate All'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex items-stretch gap-2 flex-1">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <Loader2 size={14} className="text-gray-400 animate-spin" />
              ) : (
                <Search size={14} className="text-gray-400" />
              )}
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by title, link, or description..."
              className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] focus:border-black dark:focus:border-white outline-none transition-all text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="relative sm:hidden shrink-0">
            <div className={`h-full w-11 rounded-lg border flex items-center justify-center transition-colors ${
              savedFilter === 'all'
                ? 'bg-white dark:bg-black border-gray-200 dark:border-[#333] text-gray-500 dark:text-gray-400'
                : 'bg-gray-100 dark:bg-[#111] border-black dark:border-white text-black dark:text-white'
            }`}>
              <SlidersHorizontal size={15} />
            </div>
            <select
              aria-label="Filter saved links"
              value={savedFilter}
              onChange={(e) => setSavedFilter(e.target.value as typeof savedFilter)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              <option value="all">All links</option>
              <option value="with-description">Has description</option>
              <option value="with-image">Has image</option>
              <option value="with-members">Has members</option>
              <option value="recent">Has saved date</option>
            </select>
          </div>
        </div>

        <div className="relative sm:w-52 hidden sm:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SlidersHorizontal size={14} className="text-gray-400" />
          </div>
          <select
            value={savedFilter}
            onChange={(e) => setSavedFilter(e.target.value as typeof savedFilter)}
            className="w-full appearance-none pl-9 pr-10 py-2.5 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] focus:border-black dark:focus:border-white outline-none transition-all text-sm text-black dark:text-white"
          >
            <option value="all">All links</option>
            <option value="with-description">Has description</option>
            <option value="with-image">Has image</option>
            <option value="with-members">Has members</option>
            <option value="recent">Has saved date</option>
          </select>
        </div>
      </div>

      {isLoading && links.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-black min-h-[400px]">
          <Loader2 className="w-8 h-8 text-black dark:text-white animate-spin mb-4" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Loading Database Links</h3>
          <p className="text-xs text-gray-500 mt-1">Fetching latest links from the server...</p>
        </div>
      ) : links.length === 0 && !isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50">
          <div className="w-14 h-14 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-4 shadow-sm">
            {debouncedSearchQuery ? (
              <Search size={24} className="text-gray-300 dark:text-gray-600" />
            ) : (
              <Layers size={24} className="text-gray-300 dark:text-gray-600" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
            {debouncedSearchQuery ? 'No Matches Found' : 'No Links Found'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
            {debouncedSearchQuery
              ? `No results found for "${debouncedSearchQuery}". Try a different search term.`
              : 'There are no valid links returned from the database.'}
          </p>
          <button 
            onClick={debouncedSearchQuery ? handleClearSearch : handleRefresh}
            className="mt-6 text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-4 py-2 rounded-md"
          >
            {debouncedSearchQuery ? 'Clear Search' : 'Refresh Database'}
          </button>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50">
          <div className="w-14 h-14 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Search size={22} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">No Matches Found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
            No links match the current filter. Try changing the filter to widen results.
          </p>
          <button
            onClick={() => {
              handleClearSearch();
              setSavedFilter('all');
            }}
            className="mt-6 text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-4 py-2 rounded-md"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Sort
            </span>
            {SORT_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => handleSortChange(chip.value)}
                aria-pressed={savedSort === chip.value}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  savedSort === chip.value
                    ? 'border-black bg-black text-white shadow-sm dark:border-white dark:bg-white dark:text-black'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-black dark:border-[#333] dark:bg-black dark:text-gray-400 dark:hover:border-[#444] dark:hover:text-white'
                }`}
              >
                <span className="sm:hidden">{chip.shortLabel}</span>
                <span className="hidden sm:inline">{chip.label}</span>
              </button>
            ))}
          </div>

          <div
            ref={resultsScrollRef}
            onScroll={updateScrollJumpState}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pb-4 pr-1 custom-scrollbar"
          >
            {adaptedResults.map((adapted) => (
              <ResultCard key={adapted.key} result={adapted.result} />
            ))}
          </div>

          {showScrollJump && (
            <button
              onClick={handleScrollJump}
              className={`fixed right-3 sm:right-5 z-30 h-11 w-11 sm:h-auto sm:w-auto sm:px-3 sm:py-2 rounded-full sm:rounded-xl bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-white shadow-lg border border-black/10 dark:border-white/10 transition-all flex items-center justify-center ${
                hasPagination ? 'bottom-12 sm:bottom-8' : 'bottom-2 sm:bottom-4'
              }`}
              title={scrollJumpTarget === 'top' ? 'Scroll to top' : 'Scroll to bottom'}
              aria-label={scrollJumpTarget === 'top' ? 'Scroll to top' : 'Scroll to bottom'}
            >
              <span className="sm:hidden">
                {scrollJumpTarget === 'top' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </span>
              <span className="hidden sm:flex items-center gap-2 text-xs font-semibold">
                {scrollJumpTarget === 'top' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                <span>{scrollJumpTarget === 'top' ? 'Top' : 'Bottom'}</span>
              </span>
            </button>
          )}
          
          {hasPagination && (
            <div className="flex items-center justify-between pt-4 pb-2 border-t border-gray-200 dark:border-[#333] mt-auto shrink-0">
              <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
                Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                  disabled={page >= Math.ceil(total / PAGE_SIZE) || isLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <LinkCopyModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        links={sortedLinks}
        totalInDb={total}
      />
    </div>
  );
});

export default SavedLinksPage;
