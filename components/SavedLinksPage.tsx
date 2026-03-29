import React, { useState, useEffect } from 'react';
import { Loader2, Database, RefreshCw, Layers } from 'lucide-react';
import { fetchSavedLinks, checkBulkLinks } from '../services/api';
import { StoredLink, LinkResult } from '../types';
import { toast } from 'sonner';
import ResultCard from './ResultCard';

export default function SavedLinksPage() {
  const [links, setLinks] = useState<StoredLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [total, setTotal] = useState(0);

  const loadLinks = async () => {
    setIsLoading(true);
    try {
      const data = await fetchSavedLinks(100, 0); // Fetch up to 100 recent links
      setLinks(data.links || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error('Failed to load saved links from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleValidate = async () => {
    if (links.length === 0) return;
    setIsValidating(true);
    const toastId = toast.loading('Re-validating stored links. Please wait...');
    
    try {
      // Extract URLs from current links
      const urls = links.map(l => l.url);
      
      // We can chunk them in batches of 10-20 to avoid overwhelming the server
      const BATCH_SIZE = 10;
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-full flex items-center justify-center shadow-sm">
            <Database size={18} className="text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">Saved Links</h2>
            <p className="text-xs text-gray-500 font-medium">
              Loaded {links.length} {total > links.length ? `(out of ${total} total)` : ''} recent valid links
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleValidate}
            disabled={isValidating || links.length === 0}
            className="text-xs font-semibold bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all px-4 py-2 rounded-md flex items-center gap-2 shadow-sm"
          >
            {isValidating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {isValidating ? 'Validating...' : 'Validate All'}
          </button>
        </div>
      </div>

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
            onClick={loadLinks}
            className="mt-6 text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-4 py-2 rounded-md"
          >
            Refresh Database
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pb-10">
          {links.map((savedLink, idx) => {
            // Adapt StoredLink to LinkResult for ResultCard
            const adaptedResult: LinkResult = {
              link: savedLink.url,
              status: savedLink.status || 'valid', // Assume database links are valid primarily
              reason: `Saved on ${new Date(savedLink.checked_at || Date.now()).toLocaleDateString()}`,
              details: {
                title: savedLink.title || savedLink.description || 'Database Link'
              }
            };
            
            return <ResultCard key={savedLink.id || idx} result={adaptedResult} />;
          })}
        </div>
      )}
    </div>
  );
}
