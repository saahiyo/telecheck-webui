'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Layers, Loader2, Link2, Search, Trash2, ArrowRight, Zap, Clipboard, ChevronDown, FileUp } from 'lucide-react';
import { DotmSquare5 } from '@/components/ui/dotm-square-5';
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
import { trackBulkValidation, trackSingleValidation, trackValidationComplete, trackModeSwitch } from '@/utils/tracking';


/** Contextual empty-state messages per filter tab */
const emptyMessages: Record<string, string> = {
  all: 'No results yet.',
  valid: 'No valid links found.',
  invalid: 'All links are valid! 🎉',
  mega: 'No Mega.nz links detected.',
};

const cardEnterVariants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(10px)' },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.28,
      ease: 'easeOut' as const,
      delay: Math.min((index % 12) * 0.035, 0.24),
    },
  }),
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(8px)',
    transition: { duration: 0.16, ease: 'easeIn' as const },
  },
};

const homeSectionVariants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(10px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.32, ease: 'easeOut' as const },
  },
};

const homeGroupVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.04,
    },
  },
};

const homeSwapVariants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(10px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.24, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(8px)',
    transition: { duration: 0.16, ease: 'easeIn' as const },
  },
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

    // Track bulk validation start
    trackBulkValidation(links.length, duplicateCount > 0);

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

    // Track validation completion
    trackValidationComplete(allResults);

    toast.success(`Analysis complete! (${elapsedSeconds}s)`);

    if (allResults.length >= 3 && allResults.every(r => r.status === 'valid' || r.status === 'mega')) {
      triggerSuccessConfetti();
    }
  };

  const handleSingleCheck = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!singleInput.trim()) return;

    // Track single validation start
    trackSingleValidation(singleInput.trim());

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

    // Track validation completion
    trackValidationComplete([{ status: finalStatus }]);

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
    <motion.div
      className="block"
      initial="hidden"
      animate="show"
      variants={homeGroupVariants}
    >
      {/* Stats Section */}
      <motion.div variants={homeSectionVariants}>
        <StatsWidget refreshTrigger={refreshStatsTrigger} />
      </motion.div>

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-6"
        variants={homeGroupVariants}
      >
        
        {/* Left Panel: Input */}
        <motion.div className="lg:col-span-5 flex flex-col gap-4" variants={homeSectionVariants}>
          <motion.div className="flex flex-col gap-3" variants={homeGroupVariants}>
            {/* Segmented Control */}
            <motion.div
              className="inline-flex p-1 bg-gray-100 dark:bg-[#111] rounded-lg border border-gray-200 dark:border-[#333] w-full"
              variants={homeSectionVariants}
            >
              <button
                onClick={() => {
                  setMode('bulk');
                  trackModeSwitch('bulk');
                }}
                className={`relative flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 overflow-hidden ${
                  mode === 'bulk'
                    ? 'text-black dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {mode === 'bulk' && (
                  <motion.span
                    layoutId="home-mode-active"
                    className="absolute inset-0 rounded-md bg-white dark:bg-[#333] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Layers size={14} />
                  Bulk Validator
                </span>
              </button>
              <button
                onClick={() => {
                  setMode('single');
                  trackModeSwitch('single');
                }}
                className={`relative flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 overflow-hidden ${
                  mode === 'single'
                    ? 'text-black dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {mode === 'single' && (
                  <motion.span
                    layoutId="home-mode-active"
                    className="absolute inset-0 rounded-md bg-white dark:bg-[#333] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Zap size={14} />
                  Quick Check
                </span>
              </button>
            </motion.div>

            {/* Input Area */}
            <motion.div className="space-y-3" variants={homeSectionVariants}>
              <AnimatePresence mode="wait" initial={false}>
              {mode === 'bulk' ? (
                <motion.div
                  key="bulk-input"
                  variants={homeSwapVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="space-y-3"
                >
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
                    <motion.div
                      className="mt-2 flex items-center gap-2 px-1"
                      initial={{ opacity: 0, y: 8, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: -6, filter: 'blur(8px)' }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
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
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.form
                  key="single-input"
                  onSubmit={handleSingleCheck}
                  className="relative"
                  variants={homeSwapVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                >
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
                </motion.form>
              )}
              </AnimatePresence>

              <motion.button
                onClick={mode === 'bulk' ? handleBulkCheck : (e) => handleSingleCheck(e)}
                disabled={isChecking || (mode === 'bulk' ? !bulkInput.trim() : !singleInput.trim())}
                className="w-full py-2.5 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex justify-center items-center gap-2 text-xs shadow-sm"
                whileTap={{ scale: 0.985 }}
              >
                {isChecking ? (
                  <>
                    <div className="text-white">
                      <DotmSquare5 size={18} dotSize={2} />
                    </div>
                    <span>Processing...{elapsedSeconds > 0 && <span className="ml-1 tabular-nums">{elapsedSeconds}s</span>}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'bulk' ? 'Run Validation' : 'Check Status'}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </motion.button>
            </motion.div>
          </motion.div>
          
          {/* Disclaimer / Info */}
          <motion.div className="p-4 rounded-lg bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333]" variants={homeSectionVariants}>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">Pro Tip</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Use the bulk validator to check lists of channels. We&apos;ll automatically filter out duplicate links for you. You can also drag &amp; drop a <code className="text-[10px] bg-gray-200 dark:bg-[#222] px-1 py-0.5 rounded">.txt</code> file, press <kbd className="text-[10px] bg-gray-200 dark:bg-[#222] px-1 py-0.5 rounded">Ctrl/Cmd+Enter</kbd> to validate, tap <kbd className="text-[10px] bg-gray-200 dark:bg-[#222] px-1 py-0.5 rounded">/</kbd> to jump to the main input, or press <kbd className="text-[10px] bg-gray-200 dark:bg-[#222] px-1 py-0.5 rounded">?</kbd> for the full shortcut list.
            </p>
          </motion.div>
        </motion.div>

        {/* Right Panel: Results */}
        <motion.div className="lg:col-span-7 h-full min-h-[400px] flex flex-col" variants={homeSectionVariants}>
          <AnimatePresence mode="wait" initial={false}>
           {!hasChecked && !isChecking && results.length === 0 && (
             <motion.div
               key="home-empty"
               className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50"
               variants={homeSwapVariants}
               initial="hidden"
               animate="show"
               exit="exit"
             >
               <div className="w-12 h-12 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-3 shadow-sm">
                 <Layers size={20} className="text-gray-300 dark:text-gray-600" />
               </div>
               <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-1">Ready to start</h3>
               <p className="text-[10px] text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                 Enter your Telegram links on the left to confirm their validity instantly.
               </p>
             </motion.div>
           )}

           {isChecking && !hasChecked && (
             <motion.div
               key="home-checking"
               className="flex-1 flex flex-col items-center justify-center p-6 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-black"
               variants={homeSwapVariants}
               initial="hidden"
               animate="show"
               exit="exit"
             >
               <div className="mb-5 text-black dark:text-white">
                 <DotmSquare5 size={40} />
               </div>
               <h3 className="text-xs font-medium text-gray-900 dark:text-white">Verifying Links</h3>
                {checkingProgress.total > 0 ? (
                  <p className="text-[10px] text-gray-500 mt-1">Starting {checkingProgress.total} links...{elapsedSeconds > 0 && <span className="ml-1 tabular-nums">({elapsedSeconds}s)</span>}</p>
                ) : (
                  <p className="text-[10px] text-gray-500 mt-1">Please wait...{elapsedSeconds > 0 && <span className="ml-1 tabular-nums">({elapsedSeconds}s)</span>}</p>
                )}
             </motion.div>
           )}

           {hasChecked && (
             <motion.div
               key="home-results"
               className="flex flex-col h-full"
               variants={homeSwapVariants}
               initial="hidden"
               animate="show"
               exit="exit"
             >
               {isChecking && checkingProgress.total > 0 && (
                 <motion.div
                   className="mb-4 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333] p-3 rounded-lg"
                   aria-live="polite"
                   initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
                   animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                   transition={{ duration: 0.22, ease: 'easeOut' }}
                 >
                   <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-medium">
                      <span className="flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" aria-hidden="true" /> Verifying links...{elapsedSeconds > 0 && <span className="tabular-nums"> ({elapsedSeconds}s)</span>}</span>
                     <span>{Math.round((checkingProgress.current / checkingProgress.total) * 100)}% ({checkingProgress.current}/{checkingProgress.total})</span>
                   </div>
                   <div className="w-full h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round((checkingProgress.current / checkingProgress.total) * 100)} aria-valuemin={0} aria-valuemax={100}>
                     <motion.div
                       className="h-full bg-black dark:bg-white rounded-full transition-all duration-300 ease-out"
                       initial={{ width: 0 }}
                       animate={{ width: `${(checkingProgress.current / checkingProgress.total) * 100}%` }}
                       transition={{ duration: 0.3, ease: 'easeOut' }}
                     />
                   </div>
                 </motion.div>
               )}

               <motion.div
                 className="relative z-[80] flex items-center justify-between mb-4"
                 initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
                 animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                 transition={{ duration: 0.24, ease: 'easeOut' }}
               >
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
                    
                    <AnimatePresence>
                    {copyMenuOpen && (
                      <motion.div
                        className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-black rounded-lg shadow-xl border border-gray-200 dark:border-[#333] py-1 z-[90] overflow-hidden ring-1 ring-black/5"
                        initial={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(8px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 6, scale: 0.98, filter: 'blur(8px)' }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                      >
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
                      </motion.div>
                    )}
                    </AnimatePresence>
                  </div>
                   <button 
                    onClick={clearAll} 
                    className="text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 px-3 py-1.5 rounded-md transition-colors"
                  >
                     Clear
                   </button>
                 </div>
               </motion.div>

               {/* Filters */}
               <motion.div
                 className="relative z-10 flex gap-2 mb-4 flex-wrap"
                 initial="hidden"
                 animate="show"
                 variants={homeGroupVariants}
               >
                  {[
                    { id: 'all', label: 'All', count: results.length, color: 'gray' },
                    { id: 'valid', label: 'Valid', count: validCount, color: 'black' },
                    { id: 'invalid', label: 'Invalid', count: invalidCount, color: 'red' },
                    { id: 'mega', label: 'Mega', count: megaCount, color: 'blue' },
                  ].map((f) => {
                    if (f.count === 0 && f.id !== 'all') return null;
                    
                    const isActive = filter === f.id;
                    
                    return (
                      <motion.button
                         key={f.id}
                         onClick={() => setFilter(f.id as any)}
                         variants={homeSectionVariants}
                         layout
                         className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors overflow-hidden ${
                           isActive 
                             ? 'text-white dark:text-black border-black dark:border-white' 
                             : 'bg-white dark:bg-black text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#555]'
                         }`}
                       >
                         {isActive && (
                           <motion.span
                             layoutId="home-results-filter-active"
                             className="absolute inset-0 rounded-full bg-black dark:bg-white"
                             transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
                           />
                         )}
                         <span className="relative z-10">{f.label}</span>
                         <span className={`relative z-10 px-1.5 py-0.5 rounded-full text-[10px] ${
                            isActive
                              ? 'bg-white/20 text-white dark:text-black'
                              : 'bg-gray-100 dark:bg-[#222] text-gray-600 dark:text-gray-400'
                         }`}>
                           {f.count}
                         </span>
                       </motion.button>
                    )
                  })}
               </motion.div>

                <motion.div
                  ref={homeResultsScrollRef}
                  className="relative z-0 flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 pb-10"
                >
                 <AnimatePresence initial={false}>
                   {filteredResults.map((result, idx) => (
                     <motion.div
                       key={`${result.link}-${idx}`}
                       layout
                       variants={cardEnterVariants}
                       custom={idx}
                       initial="hidden"
                       animate="show"
                       exit="exit"
                     >
                       <ResultCard result={result} />
                     </motion.div>
                   ))}
                 </AnimatePresence>
                 {filteredResults.length === 0 && (
                   <div className="text-center py-12 text-gray-400 text-xs">
                     {emptyMessages[filter] || 'No links matching this filter.'}
                   </div>
                 )}
               </motion.div>
             </motion.div>
           )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function ValidatorPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center items-center"><Loader2 className="animate-spin text-gray-400" /></div>}>
      <ValidatorContent />
    </Suspense>
  );
}
