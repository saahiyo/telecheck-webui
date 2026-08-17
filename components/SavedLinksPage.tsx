import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Database, RefreshCw, Layers, ShieldCheck, ChevronLeft, ChevronRight, ChevronDown, Search, SlidersHorizontal, X, ArrowUp, ArrowDown, Copy, User, Tag as TagIcon, Plus, Trash2, Crown } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DotmSquare5 } from '@/components/ui/dotm-square-5';
import debounce from 'lodash.debounce';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fetchSavedLinks, validateSavedLinks, getCached, fetchTags, fetchMyProfile, createTag, deleteTag, fetchTagCount } from '../services/api';
import { useAuth } from '@/hooks/useAuth';
import { StoredLink, LinkResult, StoredLinkResponse, MyProfileResponse } from '../types';
import { DEFAULT_TAGS } from '../utils/helpers';
import { formatCompactNumber, parseMemberCountRaw } from '../utils/helpers';
import { toast } from 'sonner';
import { copyText } from '../utils/clipboard';
import ResultCard from './ResultCard';
import LinkCopyModal from './LinkCopyModal';
import { trackSearchQuery, trackFilterChange, trackSortChange, trackLinksRefresh, trackLinksValidate, trackCopyModalOpen, trackPagination } from '../utils/tracking';

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

const savedCardTransition = {
  duration: 0.28,
  ease: 'easeOut' as const,
};

function getSavedCardDelay(index: number) {
  return Math.min((index % 12) * 0.025, 0.18);
}

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
  const { user, getIdToken } = useAuth();
  const PAGE_SIZE = 100;
  
  // Synchronous cache read for instant mount
  const initialCache = getCached<StoredLinkResponse>(`links:${PAGE_SIZE}:0:telegram:`);
  
  const [links, setLinks] = useState<StoredLink[]>(initialCache?.links || []);
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [isSearching, setIsSearching] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState({ current: 0, total: 0 });
  const [total, setTotal] = useState(initialCache?.total || 0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [savedFilter, setSavedFilter] = useState<SavedFilter>('all');
  const [savedSort, setSavedSort] = useState<SavedSort>('recently-updated');
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [deletedLinkKeys, setDeletedLinkKeys] = useState<Set<string>>(() => new Set());
  const PREDEFINED_TAGS = DEFAULT_TAGS;
  const [availableTags, setAvailableTags] = useState<string[]>(PREDEFINED_TAGS);
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [randomSeed, setRandomSeed] = useState(() => Date.now());

  // Manage Tags panel (top contributors only)
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const authToken = await getIdToken();
        const p = await fetchMyProfile({ authToken, firebaseUid: user?.uid });
        if (active) setProfile(p);
      } catch (err) {
        console.error('Failed to load profile for delete check:', err);
      }
    }
    loadProfile();
    return () => { active = false; };
  }, [getIdToken, user?.uid]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('telecheck_deleted_links');
      if (stored) {
        const parsed: (number | string)[] = JSON.parse(stored);
        setDeletedLinkKeys(new Set(parsed.map(item => String(item))));
      }
    } catch {}
  }, []);

  const isTopContributor = useMemo(() => {
    return profile?.rank !== null && profile?.rank !== undefined && profile.rank <= 5;
  }, [profile]);

  const handleDeleteLink = useCallback((id: number | undefined, url: string) => {
    setDeletedLinkKeys((prev) => {
      const next = new Set(prev);
      if (id) next.add(String(id));
      if (url) next.add(`url:${url}`);
      try {
        localStorage.setItem('telecheck_deleted_links', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const handleUndoDeleteLink = useCallback((id: number | undefined, url: string) => {
    setDeletedLinkKeys((prev) => {
      const next = new Set(prev);
      if (id) next.delete(String(id));
      if (url) next.delete(`url:${url}`);
      try {
        localStorage.setItem('telecheck_deleted_links', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  const isLinkDeleted = useCallback((link: StoredLink) => {
    if (link.id && deletedLinkKeys.has(String(link.id))) return true;
    if (link.url && deletedLinkKeys.has(`url:${link.url}`)) return true;
    return false;
  }, [deletedLinkKeys]);

  const displayTotal = useMemo(() => {
    return Math.max(0, total - deletedLinkKeys.size);
  }, [total, deletedLinkKeys]);
  const [showScrollJump, setShowScrollJump] = useState(false);
  const [scrollJumpTarget, setScrollJumpTarget] = useState<'top' | 'bottom'>('bottom');
  const [scrollJumpContext, setScrollJumpContext] = useState<'container' | 'window'>('window');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const userParam = searchParams.get('user') || '';
  
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const hasDataRef = useRef(false);

  // Close validate menus on outside click
  useEffect(() => {
  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  }, []);

  // Debounced handler: updates the query sent to the API after 300ms of inactivity
  const debouncedSetSearch = useMemo(
    () => debounce((q: string) => {
      setDebouncedSearchQuery(q);
      setPage(1); // Reset to first page on new search
      // Track search query when it actually executes
      if (q.trim()) {
        trackSearchQuery(q, links.length);
      }
    }, 300),
    [links.length]
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

  const loadLinks = useCallback(async (currentPage: number, search: string, tag: string, user: string) => {
    // Only show full-page spinner if it's initial load (no data), otherwise keep cards visible
    if (!hasDataRef.current) setIsLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const data = await fetchSavedLinks({ limit: PAGE_SIZE, offset, search, tag, user });

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
    loadLinks(page, debouncedSearchQuery, selectedTag, userParam);
  }, [page, debouncedSearchQuery, selectedTag, userParam, loadLinks]);

  useEffect(() => {
    let active = true;
    async function loadDynamicTags() {
      try {
        const tags = await fetchTags();
        const resolved = (tags && tags.length > 0) ? tags : DEFAULT_TAGS;
        if (active) setAvailableTags(resolved);

        // Fetch counts for each tag in parallel (dedicated function — no shared abort controller)
        const entries = await Promise.all(
          resolved.map(async (tag) => {
            const count = await fetchTagCount(tag, userParam);
            return [tag, count] as [string, number];
          })
        );
        if (active) setTagCounts(Object.fromEntries(entries));
      } catch {
        if (active) setAvailableTags(DEFAULT_TAGS);
      }
    }
    loadDynamicTags();
    return () => { active = false; };
  }, [userParam]);

  const handleRefresh = async () => {
    setIsLoading(true);
    trackLinksRefresh(links.length);
    await loadLinks(page, debouncedSearchQuery, selectedTag, userParam);
  };

  const handleSortChange = (nextSort: SavedSort) => {
    if (nextSort === 'random') {
      setRandomSeed(Date.now());
    }

    setSavedSort(nextSort);
    trackSortChange(nextSort);
  };

  const handleFilterChange = (nextFilter: SavedFilter) => {
    setSavedFilter(nextFilter);
    trackFilterChange(nextFilter, selectedTag);
  };

  const handleCreateTag = async () => {
    const name = newTagInput.trim();
    if (!name) return;
    if (availableTags.includes(name)) {
      toast.error('Tag already exists');
      return;
    }
    const authToken = await getIdToken();
    if (!authToken) {
      toast.error('Please sign in to manage tags.');
      return;
    }
    setIsCreatingTag(true);
    const ok = await createTag(name, authToken);
    setIsCreatingTag(false);
    if (ok) {
      setAvailableTags(prev => [...prev, name]);
      setNewTagInput('');
      toast.success(`Tag "${name}" created`);
    } else {
      toast.error('Failed to create tag');
    }
  };

  const handleDeleteTag = async (tag: string) => {
    const authToken = await getIdToken();
    if (!authToken) {
      toast.error('Please sign in to manage tags.');
      return;
    }
    setDeletingTag(tag);
    const ok = await deleteTag(tag, authToken);
    setDeletingTag(null);
    if (ok) {
      setAvailableTags(prev => prev.filter(t => t !== tag));
      if (selectedTag === tag) setSelectedTag('All');
      toast.success(`Tag "${tag}" deleted`);
    } else {
      toast.error('Failed to delete tag');
    }
  };

  const handleValidate = async () => {
    if (total === 0) return;
    const authToken = await getIdToken();
    if (!authToken) {
      toast.error('Please sign in before validating saved links.');
      window.dispatchEvent(new Event('app-open-auth-modal'));
      return;
    }

    trackLinksValidate(total);
    setIsValidating(true);
    setValidationProgress({ current: 0, total });
    const toastId = toast.loading('Re-validating ALL stored links...');
    
    try {
      const BATCH_SIZE_VAL = 20;
      let processed = 0;
      let kept = 0;
      let deleted = 0;
      let currentOffset = 0;

      while (processed < total) {
        const result = await validateSavedLinks({ 
          limit: String(BATCH_SIZE_VAL),
          offset: currentOffset,
          authToken
        });

        processed += result.processed;
        kept += result.kept;
        deleted += result.deleted;
        
        // Since links are deleted, the offset only increases by the number of links we KEPT
        currentOffset += result.kept;
        
        setValidationProgress({ current: Math.min(processed, total), total });
        
        if (result.processed === 0) break; // Safety break
      }
      
      toast.success(`Validation complete! Kept ${kept} links, removed ${deleted} expired.`, { id: toastId });
      await loadLinks(page, debouncedSearchQuery, selectedTag, userParam);
    } catch (error) {
      toast.error('An error occurred during validation.', { id: toastId });
    } finally {
      setIsValidating(false);
    }
  };

  const handleValidatePage = async () => {
    if (links.length === 0) return;
    const authToken = await getIdToken();
    if (!authToken) {
      toast.error('Please sign in before validating saved links.');
      window.dispatchEvent(new Event('app-open-auth-modal'));
      return;
    }

    setIsValidating(true);
    const totalToProcess = links.length;
    setValidationProgress({ current: 0, total: totalToProcess });
    const startOffset = (page - 1) * PAGE_SIZE;
    const toastId = toast.loading(`Validating ${totalToProcess} links on this page...`);
    
    try {
      const BATCH_SIZE_VAL = 20;
      let processed = 0;
      let kept = 0;
      let deleted = 0;
      let currentOffset = startOffset;

      while (processed < totalToProcess) {
        const limit = Math.min(BATCH_SIZE_VAL, totalToProcess - processed);
        const result = await validateSavedLinks({
          limit: String(limit),
          offset: currentOffset,
          authToken
        });

        processed += result.processed;
        kept += result.kept;
        deleted += result.deleted;
        
        // Advance offset only by links we didn't delete
        currentOffset += result.kept;
        
        setValidationProgress({ current: processed, total: totalToProcess });
        
        if (result.processed === 0) break;
      }

      toast.success(`Page validated! Kept ${kept} links, removed ${deleted} expired.`, { id: toastId });
      await loadLinks(page, debouncedSearchQuery, selectedTag, userParam);
    } catch (error) {
      toast.error('An error occurred during page validation.', { id: toastId });
    } finally {
      setIsValidating(false);
    }
  };

  // Client-side: filter by metadata attributes and exclude locally deleted links
  const filteredLinks = useMemo(() => {
    return filterByMetadata(links, savedFilter).filter(link => !isLinkDeleted(link));
  }, [links, savedFilter, isLinkDeleted]);
  const sortedLinks = useMemo(() => sortSavedLinks(filteredLinks, savedSort, randomSeed), [filteredLinks, savedSort, randomSeed]);

  const handleCopyLinks = useCallback(async () => {
    if (sortedLinks.length === 0) {
      toast.error('No links to copy.');
      return;
    }
    const urls = Array.from(new Set(sortedLinks.map(l => l.url).filter(Boolean)));
    try {
      await copyText(urls.join('\n'));
      toast.success(`Copied ${urls.length.toLocaleString()} link${urls.length === 1 ? '' : 's'}.`);
    } catch {
      toast.error('Failed to copy links.');
    }
  }, [sortedLinks]);

  // Pre-compute adapted results so React.memo'd ResultCards receive stable object references
  const adaptedResults = useMemo(() => sortedLinks.map((savedLink, idx) => {
    // The DB member_count column is corrupted: backend stores members+online as one int
    // (e.g. "2 408 members, 103 online" → 2408103). Parse the raw string instead.
    const parsedCount = parseMemberCountRaw(savedLink.raw_metadata?.memberCountRaw);
    const memberCount = parsedCount ?? savedLink.member_count;

    return {
      key: savedLink.id || idx,
      result: {
        link: savedLink.url,
        status: savedLink.status || 'valid',
        reason: `Saved on ${formatSavedDate(savedLink.checked_at || Date.now())}`,
        details: {
          title: savedLink.title || savedLink.description || 'Database Link',
          description: savedLink.description,
          image: savedLink.image,
          memberCount,
          memberCountCompact: formatCompactNumber(memberCount),
          memberCountRaw: memberCount?.toLocaleString(),
          checkedAt: savedLink.checked_at,
          savedStatus: savedLink.status,
          savedId: savedLink.id,
          contributorUsername: savedLink.contributor_username,
          contributorLinksAdded: savedLink.contributor_links_added,
          contributorFirstSeen: savedLink.contributor_first_seen,
          contributorLastSeen: savedLink.contributor_last_seen
        },
        tags: savedLink.tags
      } as LinkResult
    };
  }), [sortedLinks]);

  const hasPagination = displayTotal > PAGE_SIZE;

  // ── Virtual scrolling: detect column count from container width ──
  const [columnCount, setColumnCount] = useState(3);

  useEffect(() => {
    const container = resultsScrollRef.current;
    if (!container) return;

    const updateCols = () => {
      const w = container.clientWidth;
      // Match Tailwind breakpoints: lg:grid-cols-3, md:grid-cols-2, else 1
      if (w >= 1024) setColumnCount(3);
      else if (w >= 768) setColumnCount(2);
      else setColumnCount(1);
    };

    updateCols();
    const observer = new ResizeObserver(updateCols);
    observer.observe(container);
    return () => observer.disconnect();
  }, [adaptedResults.length > 0]);

  // Group adapted results into rows based on column count
  const virtualRows = useMemo(() => {
    const rows: (typeof adaptedResults)[] = [];
    for (let i = 0; i < adaptedResults.length; i += columnCount) {
      rows.push(adaptedResults.slice(i, i + columnCount));
    }
    return rows;
  }, [adaptedResults, columnCount]);

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => resultsScrollRef.current,
    estimateSize: () => 120, // estimated row height in px
    overscan: 5,
  });

  // Summary text
  const savedLinksSummary = (() => {
    if (debouncedSearchQuery || selectedTag !== 'All' || userParam) {
      const queryStr = debouncedSearchQuery ? `"${debouncedSearchQuery}"` : '';
      const tagStr = selectedTag !== 'All' ? `[${selectedTag}]` : '';
      const userStr = userParam ? `@${userParam}` : '';
      return `${filteredLinks.length} results ${queryStr} ${tagStr} ${userStr} · ${displayTotal} matched`;
    }
    if (savedFilter !== 'all') {
      return `${filteredLinks.length} filtered · ${filteredLinks.length} loaded · ${displayTotal} total`;
    }
    if (displayTotal > filteredLinks.length) {
      return `${filteredLinks.length}/${displayTotal} saved`;
    }
    return `${displayTotal} saved`;
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

  useEffect(() => {
    const handleValidateTrigger = () => {
      if (!isValidating && links.length > 0) {
        void handleValidate();
      }
    };

    window.addEventListener('app-validate-links', handleValidateTrigger);
    return () => {
      window.removeEventListener('app-validate-links', handleValidateTrigger);
    };
  }, [handleValidate, isValidating, links.length]);

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
            <h1 className="text-lg font-bold text-black dark:text-white">Saved Links</h1>
            <p className="text-xs text-gray-500 font-medium">{savedLinksSummary}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 sm:hidden max-w-[232px]">
          <button
            onClick={() => {
              setIsCopyModalOpen(true);
              trackCopyModalOpen(links.length);
            }}
            disabled={links.length === 0}
            title="Copy link options"
            aria-label="Copy link options"
            className="h-10 w-10 bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all rounded-lg flex items-center justify-center shadow-sm"
          >
            <Layers size={15} />
          </button>
          <button 
            onClick={() => void handleCopyLinks()}
            disabled={sortedLinks.length === 0}
            title="Copy loaded links"
            aria-label="Copy loaded links"
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
            onClick={() => void handleValidatePage()}
            disabled={isValidating || links.length === 0}
            title={isValidating ? 'Validating...' : 'Validate'}
            aria-label={isValidating ? 'Validating...' : 'Validate'}
            className="h-10 w-10 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all rounded-lg flex items-center justify-center shadow-sm"
          >
            {isValidating ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          </button>
        </div>

        <div className="hidden sm:flex sm:items-center sm:gap-2 shrink-0">
          <button
            onClick={() => {
              setIsCopyModalOpen(true);
              trackCopyModalOpen(links.length);
            }}
            disabled={links.length === 0}
            className="text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all px-3 py-2 rounded-md flex items-center justify-center gap-2 shadow-sm"
          >
            <Layers size={14} />
            <span>Copy Links</span>
          </button>
          <button
            onClick={() => void handleCopyLinks()}
            disabled={sortedLinks.length === 0}
            className="text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all px-3 py-2 rounded-md flex items-center justify-center gap-2 shadow-sm"
          >
            <Copy size={14} />
            <span>Copy</span>
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
            onClick={() => void handleValidatePage()}
            disabled={isValidating || links.length === 0}
            className="text-xs font-semibold bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all px-4 py-2 rounded-md flex items-center justify-center gap-2 shadow-sm"
          >
            {isValidating ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            <span>{isValidating ? 'Validating...' : 'Validate'}</span>
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

          {/* Custom filter dropdown — mobile icon + desktop full */}
          <div className="relative shrink-0" ref={filterDropdownRef}>
            {/* Trigger */}
            <button
              type="button"
              onClick={() => setFilterDropdownOpen(o => !o)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-xs font-medium ${
                savedFilter !== 'all' || (userParam && profile?.username && userParam === profile.username)
                  ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 dark:border-[#333] dark:bg-black dark:text-gray-400'
              }`}
            >
              {userParam && profile?.username && userParam === profile.username
                ? <User size={14} />
                : <SlidersHorizontal size={14} />
              }
              <span className="hidden sm:inline">
                {userParam && profile?.username && userParam === profile.username
                  ? 'My Links'
                  : savedFilter === 'all' ? 'All links'
                  : savedFilter === 'with-description' ? 'Has description'
                  : savedFilter === 'with-image' ? 'Has image'
                  : savedFilter === 'with-members' ? 'Has members'
                  : 'Has saved date'
                }
              </span>
              <ChevronDown size={12} className={`hidden sm:block transition-transform ${filterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown panel */}
            <AnimatePresence>
              {filterDropdownOpen && (
                <motion.div
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-black rounded-xl shadow-xl border border-gray-200 dark:border-[#333] py-1 z-[90] overflow-hidden"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  {[
                    { value: 'all', label: 'All links', icon: <SlidersHorizontal size={13} /> },
                    ...(user ? [{ value: 'my-links', label: 'My Links', icon: <User size={13} /> }] : []),
                    { value: 'with-description', label: 'Has description', icon: null },
                    { value: 'with-image', label: 'Has image', icon: null },
                    { value: 'with-members', label: 'Has members', icon: null },
                    { value: 'recent', label: 'Has saved date', icon: null },
                  ].map(({ value, label, icon }) => {
                    const isMyLinks = value === 'my-links';
                    const isActive = isMyLinks
                      ? !!(userParam && profile?.username && userParam === profile.username)
                      : !userParam && savedFilter === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setFilterDropdownOpen(false);
                          if (isMyLinks) {
                            if (!profile?.username) { toast.error('Set a username on your profile first.'); router.push('/profile'); return; }
                            router.push(`/saved?user=${profile.username}`);
                          } else {
                            if (userParam) router.push('/saved');
                            handleFilterChange(value as typeof savedFilter);
                          }
                        }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium transition-colors text-left ${
                          isActive
                            ? 'bg-black text-white dark:bg-white dark:text-black'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {icon && <span className="shrink-0">{icon}</span>}
                        {!icon && <span className="w-[13px] shrink-0" />}
                        {label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      {isValidating && validationProgress.total > 0 && (
        <div className="mb-6 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333] p-3 rounded-lg animate-fade-in">
          <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin text-black dark:text-white" /> 
              Validating Database...
            </span>
            <span>{Math.round((validationProgress.current / validationProgress.total) * 100)}% ({validationProgress.current}/{validationProgress.total})</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
            <div 
              className="h-full bg-black dark:bg-white rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(0,0,0,0.1)] dark:shadow-[0_0_8px_rgba(255,255,255,0.1)]"
              style={{ width: `${(validationProgress.current / validationProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {isLoading && links.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-black min-h-[400px]">
          <div className="mb-6 text-black dark:text-white">
            <DotmSquare5 size={40} />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Loading Database Links</h3>
          <p className="text-xs text-gray-500 mt-1">Fetching latest links from the server...</p>
        </div>
      ) : links.length === 0 && !isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50">
          <div className="w-14 h-14 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-4 shadow-sm">
            {(debouncedSearchQuery || selectedTag !== 'All') ? (
              <Search size={24} className="text-gray-300 dark:text-gray-600" />
            ) : (
              <Layers size={24} className="text-gray-300 dark:text-gray-600" />
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
            {(debouncedSearchQuery || selectedTag !== 'All') ? 'No Matches Found' : 'No Links Found'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
            {debouncedSearchQuery
              ? `No results found for "${debouncedSearchQuery}". Try a different search term.`
              : selectedTag !== 'All'
                ? `No links tagged as "${selectedTag}". Try selecting a different tag.`
                : userParam
                  ? `User @${userParam} hasn't added any links matching this filter.`
                  : 'There are no valid links returned from the database.'}
          </p>
          <button 
            onClick={() => {
              handleClearSearch();
              setSelectedTag('All');
              setSavedFilter('all');
              router.push('/saved');
            }}
            className="mt-6 text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-4 py-2 rounded-md"
          >
            {(debouncedSearchQuery || selectedTag !== 'All' || userParam) ? 'Clear Filters' : 'Refresh Database'}
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
              router.push('/saved');
            }}
            className="mt-6 text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-4 py-2 rounded-md"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 relative">
          {userParam && (
            <div className="mb-4 flex items-center gap-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 animate-fade-in">
              <User size={14} className="text-blue-500" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                Filtering by user: <span className="font-bold">@{userParam}</span>
              </span>
              <button 
                onClick={() => router.push('/saved')}
                className="ml-auto p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-full transition-colors"
                title="Clear user filter"
              >
                <X size={14} className="text-blue-500" />
              </button>
            </div>
          )}
          <div className="mb-4 flex flex-col gap-3">
            {/* Tag Filter Chips */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 shrink-0 min-w-[45px]">
                Tags
              </span>
              <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => { setSelectedTag('All'); setPage(1); }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                    selectedTag === 'All'
                      ? 'border-black bg-black text-white shadow-sm dark:border-white dark:bg-white dark:text-black'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-black dark:border-[#333] dark:bg-black dark:text-gray-400 dark:hover:border-[#444] dark:hover:text-white'
                  }`}
                >
                  All
                </button>
                {availableTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setSelectedTag(t); setPage(1); trackFilterChange(savedFilter, t); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                      selectedTag === t
                        ? 'border-black bg-black text-white shadow-sm dark:border-white dark:bg-white dark:text-black'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-black dark:border-[#333] dark:bg-black dark:text-gray-400 dark:hover:border-[#444] dark:hover:text-white'
                    }`}
                  >
                    {t}
                    {tagCounts[t] !== undefined && tagCounts[t] > 0 && (
                      <span className={`text-[10px] font-semibold tabular-nums px-1 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                        selectedTag === t
                          ? 'bg-white/20 dark:bg-black/20 text-white dark:text-black'
                          : 'bg-gray-100 dark:bg-[#222] text-gray-500 dark:text-gray-400'
                      }`}>
                        {tagCounts[t] > 999 ? '999+' : tagCounts[t]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* Manage Tags button — top contributors only */}
              {isTopContributor && (
                <button
                  type="button"
                  onClick={() => setIsManageTagsOpen(o => !o)}
                  title="Manage tags"
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                    isManageTagsOpen
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-black dark:border-[#333] dark:bg-black dark:text-gray-400 dark:hover:border-[#444] dark:hover:text-white'
                  }`}
                >
                  <Crown size={11} />
                  <span className="hidden sm:inline">Manage</span>
                </button>
              )}
            </div>

            {/* Manage Tags panel — top contributors only */}
            <AnimatePresence>
              {isTopContributor && isManageTagsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <Crown size={12} className="text-yellow-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Tag Management
                    </span>
                  </div>

                  {/* Create new tag */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void handleCreateTag(); }}
                      placeholder="New tag name…"
                      maxLength={32}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] text-xs text-black dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCreateTag()}
                      disabled={isCreatingTag || !newTagInput.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-semibold hover:opacity-80 disabled:opacity-40 transition-opacity"
                    >
                      {isCreatingTag ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      Add
                    </button>
                  </div>

                  {/* Existing tags with delete */}
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300"
                      >
                        <TagIcon size={10} className="text-gray-400" />
                        {tag}
                        <button
                          type="button"
                          onClick={() => void handleDeleteTag(tag)}
                          disabled={deletingTag === tag}
                          className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                          title={`Delete "${tag}"`}
                        >
                          {deletingTag === tag
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Trash2 size={10} />
                          }
                        </button>
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sort Chips */}
            <div className="flex items-center gap-4">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 shrink-0 min-w-[45px]">
                Sort
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {SORT_CHIPS.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => handleSortChange(chip.value)}
                    aria-pressed={savedSort === chip.value}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
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
            </div>
          </div>

          <div
            ref={resultsScrollRef}
            onScroll={updateScrollJumpState}
            className="flex-1 min-h-0 overflow-y-auto pb-4 pr-1 custom-scrollbar"
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowItems = virtualRows[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className={`grid gap-3 ${
                        columnCount === 3
                          ? 'grid-cols-3'
                          : columnCount === 2
                            ? 'grid-cols-2'
                            : 'grid-cols-1'
                      }`}
                      style={{ paddingBottom: '0.75rem' }}
                    >
                      {rowItems.map((adapted, itemIndex) => {
                        const cardIndex = virtualRow.index * columnCount + itemIndex;

                        return (
                          <motion.div
                            key={adapted.key}
                            layout
                            initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            transition={{
                              ...savedCardTransition,
                              delay: getSavedCardDelay(cardIndex),
                            }}
                          >
                            <ResultCard 
                              result={adapted.result} 
                              isTopContributor={isTopContributor}
                              availableTags={availableTags}
                              onCreateTag={async (name) => {
                                if (availableTags.includes(name)) { toast.error('Tag already exists'); return; }
                                const authToken = await getIdToken();
                                if (!authToken) { toast.error('Please sign in to manage tags.'); return; }
                                setIsCreatingTag(true);
                                const ok = await createTag(name, authToken);
                                setIsCreatingTag(false);
                                if (ok) { setAvailableTags(prev => [...prev, name]); toast.success(`Tag "${name}" created`); }
                                else toast.error('Failed to create tag');
                              }}
                              onDeleteTag={async (name) => {
                                const authToken = await getIdToken();
                                if (!authToken) { toast.error('Please sign in to manage tags.'); return; }
                                setDeletingTag(name);
                                const ok = await deleteTag(name, authToken);
                                setDeletingTag(null);
                                if (ok) { setAvailableTags(prev => prev.filter(t => t !== name)); if (selectedTag === name) setSelectedTag('All'); toast.success(`Tag "${name}" deleted`); }
                                else toast.error('Failed to delete tag');
                              }}
                              onDelete={handleDeleteLink}
                              onUndoDelete={handleUndoDeleteLink}
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
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
                {`Showing ${(page - 1) * PAGE_SIZE + 1} - ${Math.min(page * PAGE_SIZE, displayTotal)} of ${displayTotal}`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newPage = Math.max(1, page - 1);
                    setPage(newPage);
                    trackPagination(newPage, Math.ceil(displayTotal / PAGE_SIZE));
                  }}
                  disabled={page === 1 || isLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <button
                  onClick={() => {
                    const newPage = Math.min(Math.ceil(displayTotal / PAGE_SIZE), page + 1);
                    setPage(newPage);
                    trackPagination(newPage, Math.ceil(displayTotal / PAGE_SIZE));
                  }}
                  disabled={page >= Math.ceil(displayTotal / PAGE_SIZE) || isLoading}
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
        totalInDb={displayTotal}
      />
    </div>
  );
});

export default SavedLinksPage;
