import React, { useState } from 'react';
import { Layers, Loader2, Link2, Search, Trash2, ArrowRight, ShieldCheck, Zap, Clipboard } from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';
import StatsWidget from './components/StatsWidget';
import ResultCard from './components/ResultCard';
import { checkBulkLinks, checkSingleLink } from './services/api';
import { LinkResult } from './types';
import { Toaster, toast } from 'sonner';

function App() {
  const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
  const [bulkInput, setBulkInput] = useState('');
  const [singleInput, setSingleInput] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<LinkResult[]>([]);
  const [hasChecked, setHasChecked] = useState(false);

  const handleBulkCheck = async () => {
    if (!bulkInput.trim()) return;
    setIsChecking(true);
    setHasChecked(false);
    setResults([]);

    const links = bulkInput.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
    const data = await checkBulkLinks(links);
    
    setResults(data);
    setHasChecked(true);
    setIsChecking(false);
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

  const handleCopyList = () => {
    const title = filter === 'all' ? 'All Links' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Links`;
    const separator = '-'.repeat(17); // 17 dashes as per user example
    const linksText = filteredResults.map((r, i) => `${i + 1}. ${r.link}`).join('\n');
    
    const text = `${title}\n${separator}\n${linksText}`;
    
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${filteredResults.length} links to clipboard`);
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
    <div className="min-h-screen w-full relative overflow-x-hidden">
      <Toaster position="bottom-center" richColors />
      {/* ... (rest of the component) */}
      {/* Refined Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[800px] h-[800px] bg-blue-400/10 dark:bg-blue-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-purple-400/10 dark:bg-purple-600/10 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[600px] h-[600px] bg-emerald-400/10 dark:bg-emerald-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2.5">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500 blur opacity-40 group-hover:opacity-60 transition-opacity rounded-xl"></div>
              <div className="relative p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-inner border border-blue-400/30">
                <ShieldCheck className="text-white" size={20} />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                TeleCheck<span className="text-blue-600 dark:text-blue-400">Pro</span>
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Global Stats */}
        <StatsWidget />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-6">
          
          {/* Left Panel: Input */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="glass-panel rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-800 p-1 ring-1 ring-slate-100 dark:ring-slate-800">
              
              {/* Custom Segmented Control */}
              <div className="grid grid-cols-2 gap-1 bg-slate-100/80 dark:bg-slate-900/50 p-1 rounded-xl mb-1">
                <button
                  onClick={() => setMode('bulk')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    mode === 'bulk'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Layers size={14} />
                  Bulk Validator
                </button>
                <button
                  onClick={() => setMode('single')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    mode === 'single'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Zap size={14} />
                  Quick Check
                </button>
              </div>

              {/* Form Area */}
              <div className="p-3 pt-1">
                {mode === 'bulk' ? (
                  <div className="space-y-3">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-blue-500/5 rounded-xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                      <textarea
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        placeholder={`Paste your list here...\n\nhttps://t.me/channel1\nhttps://t.me/channel2`}
                        className="w-full h-56 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500/50 dark:focus:border-blue-500/50 outline-none transition-all resize-none text-slate-700 dark:text-slate-200 text-xs font-mono placeholder:text-slate-400 leading-relaxed shadow-inner"
                        spellCheck={false}
                      />
                      <div className="absolute top-3 right-3 flex gap-1.5">
                        <button
                          onClick={handlePaste}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Paste from Clipboard"
                        >
                          <Clipboard size={14} />
                        </button>
                        {bulkInput && (
                          <button 
                            onClick={() => setBulkInput('')}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
                            title="Clear Input"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleBulkCheck}
                      disabled={isChecking || !bulkInput.trim()}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all flex justify-center items-center gap-2 text-sm"
                    >
                      {isChecking ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span>Run Validation</span>
                          <ArrowRight size={16} className="opacity-80" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSingleCheck} className="space-y-4 py-4">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1 uppercase tracking-wider">Target URL</label>
                       <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Link2 className="text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                          </div>
                          <input
                            type="text"
                            value={singleInput}
                            onChange={(e) => setSingleInput(e.target.value)}
                            placeholder="https://t.me/username"
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500/50 dark:focus:border-blue-500/50 outline-none transition-all text-slate-700 dark:text-slate-200 text-sm shadow-inner font-medium"
                          />
                          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                            <button
                              type="button"
                              onClick={handlePaste}
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Paste from Clipboard"
                            >
                              <Clipboard size={14} />
                            </button>
                          </div>
                       </div>
                     </div>
                     <button
                      type="submit"
                      disabled={isChecking || !singleInput.trim()}
                      className="w-full py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-white rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 text-sm"
                    >
                      {isChecking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      Check Status
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Helper Text - Removed for minimalism or kept very small */}
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-7 h-full">
             {!hasChecked && !isChecking && results.length === 0 && (
               <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-6 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 rounded-2xl">
                 <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
                   <Layers size={24} className="text-slate-300 dark:text-slate-600" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Awaiting Input</h3>
                 <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                   Paste your Telegram links on the left to begin.
                 </p>
               </div>
             )}

             {isChecking && !hasChecked && (
               <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-6 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 rounded-2xl">
                 <div className="relative mb-6">
                    <div className="w-12 h-12 border-4 border-blue-100 dark:border-blue-900/30 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                 </div>
                 <h3 className="text-base font-semibold text-slate-900 dark:text-white">Verifying Links</h3>
                 <p className="text-xs text-slate-500 mt-1">Processing...</p>
               </div>
             )}

             {hasChecked && (
               <div className="space-y-4">
                 <div className="flex items-center justify-between px-1">
                   <div className="flex items-baseline gap-2">
                     <h2 className="text-lg font-bold text-slate-900 dark:text-white">Results</h2>
                     <span className="text-xs font-medium text-slate-400">
                       {results.length} link{results.length !== 1 ? 's' : ''}
                     </span>
                   </div>
                   
                   <div className="flex gap-2">
                     <button onClick={handleCopyList} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors px-2 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1">
                       <Link2 size={12} />
                       COPY LIST
                     </button>
                     <button onClick={clearAll} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 uppercase">
                       Clear
                     </button>
                   </div>
                 </div>

                 {/* Summary Chips */}
                 <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button 
                       onClick={() => setFilter('all')}
                       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                         filter === 'all' 
                           ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 ring-1 ring-blue-500/20' 
                           : 'bg-blue-100/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                       }`}
                     >
                       <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                       <span className="text-xs font-bold text-blue-800 dark:text-blue-300">{results.length} All</span>
                     </button>
                   {validCount > 0 && (
                     <button 
                       onClick={() => setFilter(filter === 'valid' ? 'all' : 'valid')}
                       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                         filter === 'valid' 
                           ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-500/20' 
                           : 'bg-emerald-100/50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                       }`}
                     >
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                       <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{validCount} Valid</span>
                     </button>
                   )}
                   {invalidCount > 0 && (
                     <button 
                       onClick={() => setFilter(filter === 'invalid' ? 'all' : 'invalid')}
                       className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                         filter === 'invalid' 
                           ? 'bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700 ring-1 ring-rose-500/20' 
                           : 'bg-rose-100/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/30'
                       }`}
                     >
                       <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                       <span className="text-xs font-bold text-rose-800 dark:text-rose-300">{invalidCount} Invalid</span>
                     </button>
                   )}
                 </div>

                 <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar pb-6">
                   {filteredResults.map((result, idx) => (
                     <ResultCard key={idx} result={result} />
                   ))}
                   {filteredResults.length === 0 && (
                     <div className="text-center py-8 text-slate-400 text-xs">
                       No links found for this filter.
                     </div>
                   )}
                 </div>
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;