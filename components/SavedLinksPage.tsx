import React, { useState, useEffect } from 'react';
import { Loader2, Database, RefreshCw, Layers, ShieldCheck, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X, Globe2 } from 'lucide-react';
import { fetchSavedLinks, checkBulkLinks } from '../services/api';
import { StoredLink, LinkResult } from '../types';
import { toast } from 'sonner';
import ResultCard from './ResultCard';

function filterSavedLinks(
  sourceLinks: StoredLink[],
  searchQuery: string,
  savedFilter: 'all' | 'with-description' | 'with-image' | 'with-members' | 'recent'
) {
  return sourceLinks.filter((link) => {
    const matchesFilter =
      savedFilter === 'all' ||
      (savedFilter === 'with-description' && !!link.description?.trim()) ||
      (savedFilter === 'with-image' && !!link.image?.trim()) ||
      (savedFilter === 'with-members' && typeof link.member_count === 'number' && link.member_count > 0) ||
      (savedFilter === 'recent' && !!link.checked_at);
    const query = searchQuery.trim().toLowerCase();

    if (!matchesFilter) return false;
    if (!query) return true;

    return [
      link.url,
      link.title,
      link.description,
      link.status,
      link.member_count?.toString()
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

function getSavedLinksSummary(
  isSearchAllMode: boolean,
  filteredCount: number,
  loadedCount: number,
  totalCount: number,
  sourceCount: number
) {
  if (isSearchAllMode) {
    return `${filteredCount}/${sourceCount || totalCount} saved`;
  }

  if (totalCount > loadedCount) {
    return `${filteredCount}/${loadedCount} loaded | ${totalCount} total`;
  }

  return `${filteredCount}/${loadedCount} loaded`;
}

export default function SavedLinksPage() {
  const [links, setLinks] = useState<StoredLink[]>([]);
  const [allLinks, setAllLinks] = useState<StoredLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedFilter, setSavedFilter] = useState<'all' | 'with-description' | 'with-image' | 'with-members' | 'recent'>('all');
  const [searchScope, setSearchScope] = useState<'page' | 'all'>('page');
  const PAGE_SIZE = 100;

  const loadLinks = async (currentPage: number) => {
    setIsLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const data = await fetchSavedLinks(PAGE_SIZE, offset);
      setLinks(data.links || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error('Failed to load saved links from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLinks(page);
  }, [page]);

  useEffect(() => {
    if (searchScope !== 'all' || allLinks.length > 0 || total === 0) return;

    const loadAllLinks = async () => {
      setIsLoadingAll(true);
      try {
        let combined: StoredLink[] = [];
        let offset = 0;
        let fetchedTotal = total;

        while (offset < fetchedTotal) {
          const data = await fetchSavedLinks(PAGE_SIZE, offset);
          const batch = data.links || [];

          combined = [...combined, ...batch];
          fetchedTotal = data.total || fetchedTotal;

          if (batch.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }

        setAllLinks(combined);
      } catch (error) {
        toast.error('Failed to load all saved links.');
        setSearchScope('page');
      } finally {
        setIsLoadingAll(false);
      }
    };

    loadAllLinks();
  }, [searchScope, allLinks.length, total]);

  const handleRefresh = async () => {
    setAllLinks([]);
    await loadLinks(page);
  };

  const handleValidate = async () => {
    if (links.length === 0) return;
    setIsValidating(true);
    const toastId = toast.loading('Re-validating stored links. Please wait...');
    
    try {
      // Extract URLs from current links
      const urls = links.map(l => l.url);
      
      // We can chunk them in batches of 100 to avoid overwhelming the server
      const BATCH_SIZE = 100;
      let validUrls = new Set<string>();
      
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        const batchResults = await checkBulkLinks(batch);
        
        batchResults.forEach(r => {
          if (r.status === 'valid' || r.status === 'mega') {
            validUrls.add(r.link);
          }
        });
      }
      
      // Keep only those whose url is in validUrls
      const freshValidLinks = links.filter(l => validUrls.has(l.url));
      
      setLinks(freshValidLinks);
      toast.success(`Validation complete! Kept ${freshValidLinks.length} valid links out of ${links.length}.`, { id: toastId });
    } catch (error) {
      toast.error('An error occurred during bulk validation.', { id: toastId });
    } finally {
      setIsValidating(false);
    }
  };

  const sourceLinks = searchScope === 'all' ? allLinks : links;
  const filteredLinks = filterSavedLinks(sourceLinks, searchQuery, savedFilter);
  const isSearchAllMode = searchScope === 'all';
  const savedLinksSummary = getSavedLinksSummary(
    isSearchAllMode,
    filteredLinks.length,
    links.length,
    total,
    sourceLinks.length
  );

  if (isLoading && links.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-black min-h-[400px]">
        <Loader2 className="w-8 h-8 text-black dark:text-white animate-spin mb-4" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Loading Database Links</h3>
        <p className="text-xs text-gray-500 mt-1">Fetching latest links from the server...</p>
      </div>
    );
  }

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
            onClick={handleRefresh}
            disabled={isLoading || isValidating}
            title="Refresh saved links"
            aria-label="Refresh saved links"
            className="h-10 w-10 bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all rounded-lg flex items-center justify-center shadow-sm"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={handleValidate}
            disabled={isValidating || links.length === 0}
            title={isValidating ? 'Validating loaded links' : 'Validate loaded links'}
            aria-label={isValidating ? 'Validating loaded links' : 'Validate loaded links'}
            className="h-10 w-10 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all rounded-lg flex items-center justify-center shadow-sm"
          >
            {isValidating ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          </button>
        </div>

        <div className="hidden sm:flex sm:items-center sm:gap-2 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isLoading || isValidating}
            className="text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all px-3 py-2 rounded-md flex items-center justify-center gap-2 shadow-sm"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
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
        <div className="flex items-center justify-between gap-3 shrink-0 sm:hidden">
          <div className="inline-flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#111] rounded-lg border border-gray-200 dark:border-[#333]">
            <button
              onClick={() => setSearchScope('page')}
              title="Search current page"
              aria-label="Search current page"
              aria-pressed={searchScope === 'page'}
              className={`h-8 w-8 rounded-md flex items-center justify-center transition-all ${
                searchScope === 'page'
                  ? 'bg-white dark:bg-[#222] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-gray-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <Layers size={14} />
            </button>
            <button
              onClick={() => setSearchScope('all')}
              title="Search all saved links"
              aria-label="Search all saved links"
              aria-pressed={searchScope === 'all'}
              className={`h-8 w-8 rounded-md flex items-center justify-center transition-all ${
                searchScope === 'all'
                  ? 'bg-white dark:bg-[#222] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                  : 'text-gray-500 hover:text-black dark:hover:text-white'
              }`}
            >
              <Globe2 size={14} />
            </button>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            {isSearchAllMode ? 'All Links' : 'This Page'}
          </span>
        </div>

        <div className="hidden sm:inline-flex p-1 bg-gray-100 dark:bg-[#111] rounded-lg border border-gray-200 dark:border-[#333] w-full sm:w-auto">
          <button
            onClick={() => setSearchScope('page')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              searchScope === 'page'
                ? 'bg-white dark:bg-[#222] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            This Page
          </button>
          <button
            onClick={() => setSearchScope('all')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              searchScope === 'all'
                ? 'bg-white dark:bg-[#222] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            Search All
          </button>
        </div>

        <div className="flex items-stretch gap-2 flex-1">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={14} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isSearchAllMode ? 'Search across all saved links' : 'Search this page by title, link, description, or member count'}
              className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] focus:border-black dark:focus:border-white outline-none transition-all text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
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

      {isSearchAllMode && (
        <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          {isLoadingAll
            ? 'Loading all saved links for global search...'
            : `Global search is active across ${sourceLinks.length || total} saved links.`}
        </div>
      )}

      {links.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50">
          <div className="w-14 h-14 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Layers size={24} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">No Links Found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
            There are no valid links returned from the database, or they have all been filtered out.
          </p>
          <button 
            onClick={handleRefresh}
            className="mt-6 text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-4 py-2 rounded-md"
          >
            Refresh Database
          </button>
        </div>
      ) : (isSearchAllMode && isLoadingAll) ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-black min-h-[320px]">
          <Loader2 className="w-8 h-8 text-black dark:text-white animate-spin mb-4" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Preparing Global Search</h3>
          <p className="text-xs text-gray-500 mt-1">Fetching all saved links so search can run across the full database.</p>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50">
          <div className="w-14 h-14 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Search size={22} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">No Matches Found</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
            {isSearchAllMode
              ? 'Try a different search term or change the filter to widen the results across all saved links.'
              : 'Try a different search term or change the filter to widen the results on this page.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSavedFilter('all');
            }}
            className="mt-6 text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-4 py-2 rounded-md"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pb-4 custom-scrollbar">
            {filteredLinks.map((savedLink, idx) => {
              // Adapt StoredLink to LinkResult for ResultCard
              const adaptedResult: LinkResult = {
                link: savedLink.url,
                status: savedLink.status || 'valid', // Assume database links are valid primarily
                reason: `Saved on ${new Date(savedLink.checked_at || Date.now()).toLocaleDateString()}`,
                details: {
                  title: savedLink.title || savedLink.description || 'Database Link',
                  description: savedLink.description,
                  image: savedLink.image,
                  memberCountRaw: savedLink.member_count?.toLocaleString(),
                  checkedAt: savedLink.checked_at,
                  savedStatus: savedLink.status,
                  savedId: savedLink.id
                }
              };
              
              return <ResultCard key={savedLink.id || idx} result={adaptedResult} />;
            })}
          </div>
          
          {!isSearchAllMode && total > PAGE_SIZE && (
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
    </div>
  );
}
