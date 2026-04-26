'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Layers, Loader2, Link2, Search, Trash2, ArrowRight, Zap, Clipboard, ChevronDown, FileUp } from 'lucide-react';
import StatsWidget from '@/components/StatsWidget';
import ResultCard from '@/components/ResultCard';
import { checkBulkLinks, checkSingleLink } from '@/services/api';
import { LinkResult } from '@/types';
import { toast } from 'sonner';  
import { URL_REGEX, isMegaLink, extractUrls, deduplicateLinks } from '@/utils/helpers';
import { copyText } from '@/utils/clipboard';
import { useSearchParams } from 'next/navigation';
import { saveResults, getResults, clearResults } from '@/utils/db';
import confetti from 'canvas-confetti';


/** Contextual empty-state messages per filter tab */
const emptyMessages: Record<string, string> = {
  all: 'No results yet.',
  valid: 'No valid links found.',
  invalid: 'All links are valid! 🎉',
  mega: 'No Mega.nz links detected.',
};

const triggerSuccessConfetti = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 1000,
  };

  const fire = (particleRatio: number, opts: any) => {
    void confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      colors: ['#000000', '#666666', '#ffffff'],
    });
  };

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};

function ValidatorContent() {
  const searchParams = useSearchParams();
  const defaultMode = searchParams.get('mode') === 'single' ? 'single' : 'bulk';

  const [mode, setMode] = useState<'bulk' | 'single'>(defaultMode);
  const [bulkInput, setBulkInput] = useState('');
  const [singleInput, setSingleInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkingProgress, setCheckingProgress] = useState({ current: 0, total: 0 });
  const [refreshStatsTrigger, setRefreshStatsTrigger] = useState(0);
  const [results, setResults] = useState<LinkResult[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const copyMenuRef = useRef<HTMLDivElement>(null);
  const bulkInputRef = useRef<HTMLTextAreaElement>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const homeResultsScrollRef = useRef<HTMLDivElement>(null);

  // ── Elapsed time timer ──
  useEffect(() => {
    if (isChecking) {
      setElapsedSeconds(0);
      elapsedIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    }
    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  }, [isChecking]);

  // ── Restore from sessionStorage and IndexedDB on mount ──
  useEffect(() => {
    const restoreData = async () => {
      try {
        const savedResults = await getResults();
        if (savedResults && savedResults.length > 0) {
          setResults(savedResults);
          setHasChecked(true);
        }

        const savedBulk = sessionStorage.getItem('telecheck_bulkInput');
        if (savedBulk) setBulkInput(savedBulk);
        
        const savedSingle = sessionStorage.getItem('telecheck_singleInput');
        if (savedSingle) setSingleInput(savedSingle);
      } catch (e) {
        console.error('Error restoring session:', e);
      }
    };
    
    restoreData();
  }, []);

  // ── Persist results to IndexedDB whenever they change ──
  useEffect(() => {
    if (results.length > 0) {
      void saveResults(results);
    } else {
      void clearResults();
    }
  }, [results]);

  // ── Persist inputs to sessionStorage ──
  useEffect(() => {
    sessionStorage.setItem('telecheck_bulkInput', bulkInput);
  }, [bulkInput]);

  useEffect(() => {
    sessionStorage.setItem('telecheck_singleInput', singleInput);
  }, [singleInput]);

  // Update mode if URL changes via shortcut
  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'single' || qMode === 'bulk') {
      setMode(qMode);
      // Give focus when changing via shortcut
      setTimeout(() => {
        if (qMode === 'bulk') bulkInputRef.current?.focus();
        if (qMode === 'single') singleInputRef.current?.focus();
      }, 50);
    }
  }, [searchParams]);

  // Handle global shortcuts triggered by AppLayout moved below runValidation to fix TDZ

  // ── Memoized link count from bulk input ──
  const { detectedLinkCount, detectedDuplicateCount } = useMemo(() => {
    if (!bulkInput.trim()) return { detectedLinkCount: 0, detectedDuplicateCount: 0 };
    const allLinks = extractUrls(bulkInput);
    const { unique, duplicateCount } = deduplicateLinks(allLinks);
    return { detectedLinkCount: unique.length, detectedDuplicateCount: duplicateCount };
  }, [bulkInput]);

  // ── Memoized result counts (single pass) ──
  const { validCount, invalidCount, megaCount } = useMemo(() => {
    let valid = 0, invalid = 0, mega = 0;
    for (const r of results) {
      if (r.status === 'valid') valid++;
      else if (r.status === 'invalid') invalid++;
      else if (r.status === 'mega') mega++;
    }
    return { validCount: valid, invalidCount: invalid, megaCount: mega };
  }, [results]);

  // ── Dynamic page title with result counts ──
  useEffect(() => {
    if (hasChecked && results.length > 0) {
      document.title = `(${validCount} valid, ${invalidCount} invalid) TeleCheck Pro`;
    } else {
      document.title = 'TeleCheck Pro | Telegram Link Validator';
    }
  }, [results.length, hasChecked, validCount, invalidCount]);

  // ── Close export dropdown on outside click ──
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        setCopyMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const runValidation = useCallback(() => {
    if (isChecking) return;
    if (mode === 'bulk') {
      if (bulkInput.trim()) {
        void handleBulkCheck();
      }
    } else {
      if (singleInput.trim()) {
        void handleSingleCheck();
      }
    }
  }, [bulkInput, singleInput, isChecking, mode]);

  // ── Bulk check with dedup + streaming (batched) results ──
  const handleBulkCheck = async () => {
    if (!bulkInput.trim()) return;
    setIsChecking(true);
    setHasChecked(false);
    setResults([]);
    setCheckingProgress({ current: 0, total: 0 });

    const { unique: links, duplicateCount } = await new Promise<{ unique: string[]; duplicateCount: number }>((resolve) => {
      const worker = new Worker(new URL('../utils/dedup.worker.ts', import.meta.url));
      worker.onmessage = (e) => {
        resolve(e.data);
        worker.terminate();
      };
      worker.postMessage(bulkInput);
    });

    if (duplicateCount > 0) {
      toast.info(`Removed ${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''}`);
    }

    const megaLinks = links.filter(l => isMegaLink(l));
    const telegramLinks = links.filter(l => !isMegaLink(l));

    const megaResults: LinkResult[] = megaLinks.map(l => ({
      link: l,
      status: 'mega',
      reason: 'Mega.nz Link'
    }));

    let currentChecked = megaResults.length;
    setCheckingProgress({ current: currentChecked, total: links.length });

    const allResults: LinkResult[] = [...megaResults];

    if (megaResults.length > 0) {
      setResults(megaResults);
      setHasChecked(true);
    }

    if (telegramLinks.length > 0) {
      const BATCH_SIZE = 100; // Increased batch size for efficiency
      const CONCURRENCY = 3; // Parallel requests
      
      const batches: string[][] = [];
      for (let i = 0; i < telegramLinks.length; i += BATCH_SIZE) {
        batches.push(telegramLinks.slice(i, i + BATCH_SIZE));
      }

      let activeIndex = 0;
      const processWorker = async () => {
        while (activeIndex < batches.length) {
          const index = activeIndex++;
          const batch = batches[index];
          try {
            const batchResults = await checkBulkLinks(batch);
            allResults.push(...batchResults);
            setResults(prev => [...prev, ...batchResults]);
            
            // Calculate progress based on total accumulated results
            setCheckingProgress({ 
              current: allResults.length, 
              total: links.length 
            });
          } catch (e) {
            console.error('Batch failed:', e);
          }
        }
      };

      // Start parallel workers
      const workers = Array.from({ length: Math.min(CONCURRENCY, batches.length) }, processWorker);
      await Promise.all(workers);
      
      setHasChecked(true);
    }

    setIsChecking(false);
    setRefreshStatsTrigger(prev => prev + 1);
    toast.success(`Analysis complete! (${elapsedSeconds}s)`);

    if (allResults.length >= 3 && allResults.every(r => r.status === 'valid' || r.status === 'mega')) {
      triggerSuccessConfetti();
    }
  };

  const handleSingleCheck = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!singleInput.trim()) return;
    setIsChecking(true);
    setHasChecked(false);
    setResults([]);
    setCheckingProgress({ current: 0, total: 1 });

    let finalStatus = '';
    if (isMegaLink(singleInput.trim())) {
      const result: LinkResult = { link: singleInput.trim(), status: 'mega', reason: 'Mega.nz Link' };
      setResults([result]);
      finalStatus = 'mega';
    } else {
      const data = await checkSingleLink(singleInput);
      setResults([data]);
      finalStatus = data.status;
    }
    setCheckingProgress({ current: 1, total: 1 });
    setHasChecked(true);
    setIsChecking(false);
    setRefreshStatsTrigger(prev => prev + 1);
    toast.success(`Analysis complete! (${elapsedSeconds}s)`);
  };
  // Handle global shortcuts triggered by AppLayout
  useEffect(() => {
    const handleRunValidation = () => {
      runValidation();
    };

    const handleFocusPrimaryInput = () => {
      if (mode === 'bulk') {
        bulkInputRef.current?.focus();
      } else {
        singleInputRef.current?.focus();
      }
    };

    const handleScrollBoundary = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const container = homeResultsScrollRef.current;
      const targetTop = customEvent.detail === 'top' ? 0 : Number.MAX_SAFE_INTEGER;

      if (container && container.scrollHeight - container.clientHeight > 24) {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    };

    const handleOpenExport = () => {
      if (hasChecked && results.length > 0 && document.activeElement !== bulkInputRef.current && document.activeElement !== singleInputRef.current) {
        exportButtonRef.current?.click();
      }
    };

    const handleEscape = () => {
      setCopyMenuOpen(false);
    };

    window.addEventListener('app-run-validation', handleRunValidation);
    window.addEventListener('app-focus-primary-input', handleFocusPrimaryInput);
    window.addEventListener('app-scroll-boundary', handleScrollBoundary);
    window.addEventListener('app-open-export', handleOpenExport);
    window.addEventListener('app-escape', handleEscape);

    return () => {
      window.removeEventListener('app-run-validation', handleRunValidation);
      window.removeEventListener('app-focus-primary-input', handleFocusPrimaryInput);
      window.removeEventListener('app-scroll-boundary', handleScrollBoundary);
      window.removeEventListener('app-open-export', handleOpenExport);
      window.removeEventListener('app-escape', handleEscape);
    };
  }, [mode, hasChecked, results.length, runValidation]);

  const clearAll = () => {
    setBulkInput('');
    setSingleInput('');
    setResults([]);
    setHasChecked(false);
    setCheckingProgress({ current: 0, total: 0 });
    void clearResults();
  };

  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid' | 'mega'>('all');

  const filteredResults = useMemo(() => {
    if (filter === 'all') return results;
    return results.filter(r => r.status === filter);
  }, [results, filter]);

  const handleCopy = async (type: 'numbered' | 'gap' | 'plain' | 'original' | 'withTitle') => {
    try {
      let text = '';
      const title = filter === 'all' ? 'All Links' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Links`;
      const separator = '-'.repeat(17);

      switch (type) {
        case 'numbered':
           text = `${title}\n${separator}\n` + filteredResults.map((r, i) => `${i + 1}. ${r.link}`).join('\n');
           break;
        case 'gap':
           text = filteredResults.map((r) => r.link).join('\n\n');
           break;
        case 'plain':
           text = filteredResults.map((r) => r.link).join('\n');
           break;
        case 'withTitle':
           text = filteredResults.map((r) => r.details?.title ? `${r.details.title}\n${r.link}` : r.link).join('\n\n');
           break;
        case 'original':
           if (mode === 'single') {
             text = (results[0]?.status === 'valid' || results[0]?.status === 'mega') ? singleInput : '';
             break;
           }

           const matches = [...bulkInput.matchAll(new RegExp(URL_REGEX.source, 'g'))];
           const statusMap = new Map(results.map(r => [r.link, r.status]));

           text = '';
           let lastEnd = 0;
           
           matches.forEach((match) => {
             const linkUrl = match[0].trim();
             const status = statusMap.get(linkUrl);
             const start = match.index!;
             const end = start + match[0].length;
             const precedingContent = bulkInput.slice(lastEnd, start);
             
             if (status === 'valid' || status === 'mega') {
                let chunkToKeep = precedingContent;
                if (/\S/.test(precedingContent)) {
                   const parts = precedingContent.split(/\n\s*\n/);
                   chunkToKeep = parts[parts.length - 1];
                   if (parts.length > 1 && text.length > 0 && !text.endsWith('\n')) {
                      text += '\n';
                   }
                }
                text += chunkToKeep + match[0];
             }
             lastEnd = end;
           });
           
           text = text.replace(/(\r\n|\r|\n){3,}/g, '$1$1');
           break;
      }
      
      if (!text.trim()) {
        toast.error('Nothing to copy');
        return;
      }

      await copyText(text);
      toast.success('Copied to clipboard');
      setCopyMenuOpen(false);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (mode === 'bulk') {
        setBulkInput(prev => prev + (prev ? '\n' : '') + text);
      } else {
        setSingleInput(text);
      }
      toast.success('Pasted from clipboard');
    } catch (err) {
      toast.error('Failed to read clipboard');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const fileList = e.dataTransfer.files;
    let textFile: File | null = null;
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.type === 'text/plain' || f.name.endsWith('.txt')) {
        textFile = f;
        break;
      }
    }
    if (textFile) {
      const reader = new FileReader();
      const fileName = textFile.name;
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        if (content) {
          setBulkInput(prev => prev + (prev ? '\n' : '') + content);
          toast.success(`Imported \${fileName}`);
        }
      };
      reader.readAsText(textFile);
    } else if (fileList.length > 0) {
      toast.error('Please drop a .txt file');
    }
  }, []);

  return (
    <div className="block animate-fade-in">
      {/* Stats Section */}
      <StatsWidget refreshTrigger={refreshStatsTrigger} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-6">
        
        {/* Left Panel: Input */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {/* Segmented Control */}
            <div className="inline-flex p-1 bg-gray-100 dark:bg-[#111] rounded-lg border border-gray-200 dark:border-[#333] w-full">
              <button
                onClick={() => setMode('bulk')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  mode === 'bulk'
                    ? 'bg-white dark:bg-[#333] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Layers size={14} />
                Bulk Validator
              </button>
              <button
                onClick={() => setMode('single')}
                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  mode === 'single'
                    ? 'bg-white dark:bg-[#333] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Zap size={14} />
                Quick Check
              </button>
            </div>

            {/* Input Area */}
            <div className="space-y-3">
              {mode === 'bulk' ? (
                <>
                  <div
                    className={`relative group ${isDragging ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-black rounded-lg' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <textarea
                      ref={bulkInputRef}
                      id="bulk-link-input"
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder={`Paste your list here or drag a .txt file...\n\nhttps://t.me/channel1\nhttps://t.me/channel2`}
                      className="w-full h-48 sm:h-64 p-3 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] focus:border-black dark:focus:border-white outline-none transition-colors resize-none text-xs font-mono placeholder:text-gray-400 dark:placeholder:text-gray-600 leading-relaxed text-black dark:text-white"
                      spellCheck={false}
                      aria-label="Bulk Telegram links input"
                    />
                    {/* Drag overlay */}
                    {isDragging && (
                      <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/5 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center pointer-events-none">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-medium">
                          <FileUp size={16} />
                          Drop .txt file here
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={handlePaste}
                        className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-[#222]"
                        title="Paste"
                      >
                        <Clipboard size={12} />
                      </button>
                      {bulkInput && (
                        <button 
                          onClick={() => setBulkInput('')}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-[#222]"
                          title="Clear"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Link count badge moved to bottom side */}
                  {detectedLinkCount > 0 && (
                    <div className="mt-2 flex items-center gap-2 px-1 animate-fade-in">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100/80 dark:bg-[#111]/80 border border-gray-200/50 dark:border-[#333]/50 shadow-sm">
                        <Link2 size={11} className="text-gray-500 dark:text-gray-400 shrink-0" />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 tabular-nums uppercase tracking-wider">
                          {detectedLinkCount} link{detectedLinkCount !== 1 ? 's' : ''} detected
                        </span>
                        {detectedDuplicateCount > 0 && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 tabular-nums uppercase tracking-wider">
                            · {detectedDuplicateCount} dupe{detectedDuplicateCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleSingleCheck} className="relative">
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Link2 className="text-gray-400" size={16} />
                     </div>
                     <input
                       ref={singleInputRef}
                       id="single-link-input"
                       type="text"
                       value={singleInput}
                       onChange={(e) => setSingleInput(e.target.value)}
                       placeholder="https://t.me/username"
                       className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] focus:border-black dark:focus:border-white outline-none transition-all text-sm font-medium text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600"
                       aria-label="Single Telegram link input"
                      />
                     <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                       <button
                         type="button"
                         onClick={handlePaste}
                         className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-md transition-colors"
                       >
                         <Clipboard size={14} />
                       </button>
                     </div>
                  </div>
                </form>
              )}

              <button
                onClick={mode === 'bulk' ? handleBulkCheck : (e) => handleSingleCheck(e)}
                disabled={isChecking || (mode === 'bulk' ? !bulkInput.trim() : !singleInput.trim())}
                className="w-full py-2.5 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex justify-center items-center gap-2 text-xs shadow-sm"
              >
                {isChecking ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing...{elapsedSeconds > 0 && <span className="ml-1 tabular-nums">{elapsedSeconds}s</span>}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'bulk' ? 'Run Validation' : 'Check Status'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Disclaimer / Info */}
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333]">
            <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">Pro Tip</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Use the bulk validator to check lists of channels. We&apos;ll automatically filter out duplicate links for you. You can also drag &amp; drop a <code className="text-[10px] bg-gray-200 dark:bg-[#222] px-1 py-0.5 rounded">.txt</code> file, press <kbd className="text-[10px] bg-gray-200 dark:bg-[#222] px-1 py-0.5 rounded">Ctrl/Cmd+Enter</kbd> to validate, tap <kbd className="text-[10px] bg-gray-200 dark:bg-[#222] px-1 py-0.5 rounded">/</kbd> to jump to the main input, or press <kbd className="text-[10px] bg-gray-200 dark:bg-[#222] px-1 py-0.5 rounded">?</kbd> for the full shortcut list.
            </p>
          </div>
        </div>

        {/* Right Panel: Results */}
        <div className="lg:col-span-7 h-full min-h-[400px] flex flex-col">
           {!hasChecked && !isChecking && results.length === 0 && (
             <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50">
               <div className="w-12 h-12 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-3 shadow-sm">
                 <Layers size={20} className="text-gray-300 dark:text-gray-600" />
               </div>
               <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">Ready to start</h3>
               <p className="text-[10px] text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                 Enter your Telegram links on the left to confirm their validity instantly.
               </p>
             </div>
           )}

           {isChecking && !hasChecked && (
             <div className="flex-1 flex flex-col items-center justify-center p-6 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-black">
               <Loader2 className="w-6 h-6 text-black dark:text-white animate-spin mb-3" />
               <h3 className="text-xs font-medium text-gray-900 dark:text-white">Verifying Links</h3>
                {checkingProgress.total > 0 ? (
                  <p className="text-[10px] text-gray-500 mt-1">Starting {checkingProgress.total} links...{elapsedSeconds > 0 && <span className="ml-1 tabular-nums">({elapsedSeconds}s)</span>}</p>
                ) : (
                  <p className="text-[10px] text-gray-500 mt-1">Please wait...{elapsedSeconds > 0 && <span className="ml-1 tabular-nums">({elapsedSeconds}s)</span>}</p>
                )}
             </div>
           )}

           {hasChecked && (
             <div className="flex flex-col h-full">
               {isChecking && checkingProgress.total > 0 && (
                 <div className="mb-4 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333] p-3 rounded-lg" aria-live="polite">
                   <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-medium">
                      <span className="flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" aria-hidden="true" /> Verifying links...{elapsedSeconds > 0 && <span className="tabular-nums"> ({elapsedSeconds}s)</span>}</span>
                     <span>{Math.round((checkingProgress.current / checkingProgress.total) * 100)}% ({checkingProgress.current}/{checkingProgress.total})</span>
                   </div>
                   <div className="w-full h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round((checkingProgress.current / checkingProgress.total) * 100)} aria-valuemin={0} aria-valuemax={100}>
                     <div 
                       className="h-full bg-black dark:bg-white rounded-full transition-all duration-300 ease-out"
                       style={{ width: `${(checkingProgress.current / checkingProgress.total) * 100}%` }}
                     />
                   </div>
                 </div>
               )}

               <div className="flex items-center justify-between mb-4">
                 <div className="flex items-baseline gap-2">
                   <h2 className="text-base font-semibold text-black dark:text-white">Results</h2>
                   <span className="text-xs text-gray-500 font-mono">
                     ({results.length} {isChecking && checkingProgress.total > 0 ? `/ ${checkingProgress.total}` : ''})
                   </span>
                 </div>
                 
                 <div className="flex gap-2">
                  <div className="relative" ref={copyMenuRef}>
                    <button 
                      ref={exportButtonRef}
                      onClick={() => setCopyMenuOpen(!copyMenuOpen)}
                      className="text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-3 py-1.5 rounded-md flex items-center gap-1.5"
                      title="Export results (E)"
                    >
                      <Link2 size={12} />
                      Export
                      <ChevronDown size={10} className={`transform transition-transform ${copyMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {copyMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-black rounded-lg shadow-xl border border-gray-200 dark:border-[#333] py-1 z-50 overflow-hidden ring-1 ring-black/5">
                        <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-[#111] border-b border-gray-100 dark:border-[#333]">
                          Format
                        </div>
                        
                        {[
                          { id: 'gap', label: 'Links with Gap' },
                          { id: 'plain', label: 'Plain List' },
                          { id: 'withTitle', label: 'With Title' },
                          { id: 'original', label: 'Original Content' },
                          { id: 'numbered', label: 'Numbered List' }
                        ].map((item) => (
                           <button 
                            key={item.id}
                            onClick={() => void handleCopy(item.id as any)}
                            className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222] hover:text-black dark:hover:text-white transition-colors"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                   <button 
                    onClick={clearAll} 
                    className="text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 px-3 py-1.5 rounded-md transition-colors"
                  >
                     Clear
                   </button>
                 </div>
               </div>

               {/* Filters */}
               <div className="flex gap-2 mb-4 flex-wrap">
                  {[
                    { id: 'all', label: 'All', count: results.length, color: 'gray' },
                    { id: 'valid', label: 'Valid', count: validCount, color: 'black' },
                    { id: 'invalid', label: 'Invalid', count: invalidCount, color: 'red' },
                    { id: 'mega', label: 'Mega', count: megaCount, color: 'blue' },
                  ].map((f) => {
                    if (f.count === 0 && f.id !== 'all') return null;
                    
                    const isActive = filter === f.id;
                    
                    return (
                      <button 
                         key={f.id}
                         onClick={() => setFilter(f.id as any)}
                         className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                           isActive 
                             ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' 
                             : 'bg-white dark:bg-black text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#555]'
                         }`}
                       >
                         {f.label}
                         <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            isActive
                              ? 'bg-white/20 text-white dark:text-black'
                              : 'bg-gray-100 dark:bg-[#222] text-gray-600 dark:text-gray-400'
                         }`}>
                           {f.count}
                         </span>
                       </button>
                    )
                  })}
               </div>

                <div ref={homeResultsScrollRef} className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 pb-10">
                 {filteredResults.map((result, idx) => (
                   <ResultCard key={idx} result={result} />
                 ))}
                 {filteredResults.length === 0 && (
                   <div className="text-center py-12 text-gray-400 text-xs">
                     {emptyMessages[filter] || 'No links matching this filter.'}
                   </div>
                 )}
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

export default function ValidatorPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center items-center"><Loader2 className="animate-spin text-gray-400" /></div>}>
      <ValidatorContent />
    </Suspense>
  );
}
