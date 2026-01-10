import React, { useState, useRef, useEffect } from 'react';
import { Layers, Loader2, Link2, Search, Trash2, ArrowRight, ShieldCheck, Zap, Clipboard, ChevronDown, Check, Github } from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';
import StatsWidget from './components/StatsWidget';
import ResultCard from './components/ResultCard';
import { checkBulkLinks, checkSingleLink } from './services/api';
import { LinkResult } from './types';
import { Toaster, toast } from 'sonner';  
import GithubBtn from './components/GithubBtn';

function App() {
  const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
  const [bulkInput, setBulkInput] = useState('');
  const [singleInput, setSingleInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  // Trigger for refreshing stats widget
  const [refreshStatsTrigger, setRefreshStatsTrigger] = useState(0);
  const [results, setResults] = useState<LinkResult[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        setCopyMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleBulkCheck = async () => {
    if (!bulkInput.trim()) return;
    setIsChecking(true);
    setHasChecked(false);
    setResults([]);

    const urlRegex = /(https?:\/\/[^\s,]+|t\.me\/[^\s,]+)/g;
    const links = (bulkInput.match(urlRegex) || []).map(l => l.trim());
    const data = await checkBulkLinks(links);
    
    setResults(data);
    setHasChecked(true);
    setIsChecking(false);
    setRefreshStatsTrigger(prev => prev + 1);
    toast.success('Analysis complete!');
  };

  const handleSingleCheck = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!singleInput.trim()) return;
    setIsChecking(true);
    setHasChecked(false);
    setResults([]);

    const data = await checkSingleLink(singleInput);
    
    setResults([data]);
    setHasChecked(true);
    setIsChecking(false);
    setRefreshStatsTrigger(prev => prev + 1);
    toast.success('Analysis complete!');
  };

  const clearAll = () => {
    setBulkInput('');
    setSingleInput('');
    setResults([]);
    setHasChecked(false);
  };

  const validCount = results.filter(r => r.status === 'valid').length;
  const invalidCount = results.filter(r => r.status === 'invalid').length;

  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  const filteredResults = results.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const handleCopy = (type: 'numbered' | 'gap' | 'plain' | 'original') => {
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
        case 'original':
           if (mode === 'single') {
             text = results[0]?.status === 'valid' ? singleInput : '';
             break;
           }

           // Robust segmentation logic to remove invalid links AND their preceding context (headers/timestamps)
           // while keeping text belonging to valid links.
           const urlRegex = /(https?:\/\/[^\s,]+|t\.me\/[^\s,]+)/g;
           const matches = [...bulkInput.matchAll(urlRegex)];
           
           // map link -> status for quick lookup (handles duplicates by taking first found status, usually consistent)
           const statusMap = new Map(results.map(r => [r.link, r.status]));

           text = '';
           let lastEnd = 0;
           
           matches.forEach((match) => {
             const linkUrl = match[0].trim();
             const status = statusMap.get(linkUrl);
             
             const start = match.index!;
             const end = start + match[0].length;
             
             // The text preceding this link
             const precedingContent = bulkInput.slice(lastEnd, start);
             
             if (status === 'valid') {
                let chunkToKeep = precedingContent;
                
                // If the preceding content has meaningful text (headers, etc.), 
                // we only want the LAST paragraph (the one belonging to this link).
                // We discard orphaned paragraphs (extra texts) separated by blank lines.
                if (/\S/.test(precedingContent)) {
                   const parts = precedingContent.split(/\n\s*\n/);
                   chunkToKeep = parts[parts.length - 1];
                   
                   // If we stripped content, ensure we have at least one newline separator from previous output
                   if (parts.length > 1 && text.length > 0 && !text.endsWith('\n')) {
                      text += '\n';
                   }
                }
                
                text += chunkToKeep + match[0];
             }
             
             lastEnd = end;
           });
           
           // Collapse excessive newlines if any remain
           text = text.replace(/(\r\n|\r|\n){3,}/g, '$1$1');
           break;
      }
      
      if (!text.trim()) {
        toast.error('Nothing to copy');
        return;
      }

      navigator.clipboard.writeText(text);
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

  return (
    <div className="min-h-screen w-full relative bg-white dark:bg-black font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-200">
      <Toaster position="bottom-center" toastOptions={{
        className: 'dark:bg-[#111] dark:text-white dark:border-[#333] bg-white text-black border-gray-200',
      }} />
      
      {/* Navbar / Header */}
      <div className="border-b border-gray-200 dark:border-[#333] sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center">
               <ShieldCheck size={18} strokeWidth={2.5} />
             </div>
             <h1 className="text-lg font-bold tracking-tight text-black dark:text-white">
               TeleCheck<span className="text-gray-400 dark:text-gray-600">Pro</span>
             </h1>
           </div>
           <div className="flex items-center gap-2">  
              <ThemeToggle />
              <GithubBtn />
           </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
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
                  <div className="relative group">
                    <textarea
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      placeholder={`Paste your list here...\n\nhttps://t.me/channel1\nhttps://t.me/channel2`}
                      className="w-full h-64 p-3 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] focus:border-black dark:focus:border-white outline-none transition-colors resize-none text-xs font-mono placeholder:text-gray-400 dark:placeholder:text-gray-600 leading-relaxed text-black dark:text-white"
                      spellCheck={false}
                    />
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
                ) : (
                  <form onSubmit={handleSingleCheck} className="relative">
                    <div className="relative">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <Link2 className="text-gray-400" size={16} />
                       </div>
                       <input
                         type="text"
                         value={singleInput}
                         onChange={(e) => setSingleInput(e.target.value)}
                         placeholder="https://t.me/username"
                         className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] focus:border-black dark:focus:border-white outline-none transition-all text-sm font-medium"
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
                      <span>Processing...</span>
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
                Use the bulk validator to check lists of channels. We'll automatically filter out duplicate links for you.
              </p>
            </div>
          </div>

          {/* Right Panel: Results */}
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
                 <p className="text-[10px] text-gray-500 mt-1">Please wait...</p>
               </div>
             )}

             {hasChecked && (
               <div className="flex flex-col h-full">
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-baseline gap-2">
                     <h2 className="text-base font-semibold text-black dark:text-white">Results</h2>
                     <span className="text-xs text-gray-500 font-mono">
                       ({results.length})
                     </span>
                   </div>
                   
                   <div className="flex gap-2">
                    <div className="relative" ref={copyMenuRef}>
                      <button 
                        onClick={() => setCopyMenuOpen(!copyMenuOpen)}
                        className="text-xs font-medium bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] text-black dark:text-white transition-colors px-3 py-1.5 rounded-md flex items-center gap-1.5"
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
                            { id: 'original', label: 'Original Content' },
                            { id: 'numbered', label: 'Numbered List' }
                          ].map((item) => (
                             <button 
                              key={item.id}
                              onClick={() => handleCopy(item.id as any)}
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
                 <div className="flex gap-2 mb-4">
                    {[
                      { id: 'all', label: 'All', count: results.length, color: 'gray' },
                      { id: 'valid', label: 'Valid', count: validCount, color: 'black' },
                      { id: 'invalid', label: 'Invalid', count: invalidCount, color: 'red' },
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

                 <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 pb-10">
                   {filteredResults.map((result, idx) => (
                     <ResultCard key={idx} result={result} />
                   ))}
                   {filteredResults.length === 0 && (
                     <div className="text-center py-12 text-gray-400 text-xs">
                       No links matching this filter.
                     </div>
                   )}
                 </div>
               </div>
             )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;