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
    const text = filteredResults.map(r => r.link).join('\n');
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

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500 blur opacity-40 group-hover:opacity-60 transition-opacity rounded-xl"></div>
              <div className="relative p-2.5 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-inner border border-blue-400/30">
                <ShieldCheck className="text-white" size={24} />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                TeleCheck<span className="text-blue-600 dark:text-blue-400">Pro</span>
              </h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                Link Verification System
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* Global Stats */}
        <StatsWidget />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Panel: Input */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="glass-panel rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white/50 dark:border-slate-800 p-1.5 ring-1 ring-slate-100 dark:ring-slate-800">
              
              {/* Custom Segmented Control */}
              <div className="grid grid-cols-2 gap-1 bg-slate-100/80 dark:bg-slate-900/50 p-1 rounded-2xl mb-2">
                <button
                  onClick={() => setMode('bulk')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    mode === 'bulk'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Layers size={16} />
                  Bulk Validator
                </button>
                <button
                  onClick={() => setMode('single')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    mode === 'single'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Zap size={16} />
                  Quick Check
                </button>
              </div>

              {/* Form Area */}
              <div className="p-4 pt-2">
                {mode === 'bulk' ? (
                  <div className="space-y-4">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-blue-500/5 rounded-2xl pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                      <textarea
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                        placeholder={`Paste your list here...\n\nhttps://t.me/channel1\nhttps://t.me/channel2`}
                        className="w-full h-72 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500/50 dark:focus:border-blue-500/50 outline-none transition-all resize-none text-slate-700 dark:text-slate-200 text-sm font-mono placeholder:text-slate-400 leading-relaxed shadow-inner"
                        spellCheck={false}
                      />
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button
                          onClick={handlePaste}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Paste from Clipboard"
                        >
                          <Clipboard size={16} />
                        </button>
                        {bulkInput && (
                          <button 
                            onClick={() => setBulkInput('')}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                            title="Clear Input"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleBulkCheck}
                      disabled={isChecking || !bulkInput.trim()}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 transition-all flex justify-center items-center gap-2.5"
                    >
                      {isChecking ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span>Run Validation</span>
                          <ArrowRight size={18} className="opacity-80" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSingleCheck} className="space-y-5 py-8">
                     <div className="space-y-2">
                       <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1 uppercase">Target URL</label>
                       <div className="relative group">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Link2 className="text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                          </div>
                          <input
                            type="text"
                            value={singleInput}
                            onChange={(e) => setSingleInput(e.target.value)}
                            placeholder="https://t.me/username"
                            className="w-full pl-12 pr-12 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500/50 dark:focus:border-blue-500/50 outline-none transition-all text-slate-700 dark:text-slate-200 shadow-inner font-medium"
                          />
                          <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                            <button
                              type="button"
                              onClick={handlePaste}
                              className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Paste from Clipboard"
                            >
                              <Clipboard size={16} />
                            </button>
                          </div>
                       </div>
                     </div>
                     <button
                      type="submit"
                      disabled={isChecking || !singleInput.trim()}
                      className="w-full py-4 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-white rounded-2xl font-bold shadow-lg transition-all flex justify-center items-center gap-2.5"
                    >
                      {isChecking ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                      Check Status
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Helper Text */}
            <div className="px-2">
              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Powered by TeleCheck API. Supports raw text extraction.
              </p>
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-7 h-full">
             {!hasChecked && !isChecking && results.length === 0 && (
               <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 rounded-3xl">
                 <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                   <Layers size={36} className="text-slate-300 dark:text-slate-600" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Awaiting Input</h3>
                 <p className="text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                   Paste your Telegram links on the left to begin the validation process. We'll categorize them instantly.
                 </p>
               </div>
             )}

             {isChecking && !hasChecked && (
               <div className="h-full min-h-[500px] flex flex-col items-center justify-center p-8 border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 rounded-3xl">
                 <div className="relative mb-8">
                    <div className="w-16 h-16 border-4 border-blue-100 dark:border-blue-900/30 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                 </div>
                 <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Verifying Links</h3>
                 <p className="text-sm text-slate-500 mt-1">This usually takes just a moment...</p>
               </div>
             )}

             {hasChecked && (
               <div className="space-y-6">
                 <div className="flex items-center justify-between px-1">
                   <div className="flex items-baseline gap-3">
                     <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analysis Results</h2>
                     <span className="text-sm font-medium text-slate-400">
                       {results.length} link{results.length !== 1 ? 's' : ''} processed
                     </span>
                   </div>
                   
                   <div className="flex gap-2">
                     <button onClick={handleCopyList} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1.5">
                       <Link2 size={14} />
                       Copy List
                     </button>
                     <button onClick={clearAll} className="text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                       Clear Results
                     </button>
                   </div>
                 </div>

                 {/* Summary Chips */}
                 <div className="flex gap-3 overflow-x-auto pb-2">
                   {validCount > 0 && (
                     <button 
                       onClick={() => setFilter(filter === 'valid' ? 'all' : 'valid')}
                       className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                         filter === 'valid' 
                           ? 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20' 
                           : 'bg-emerald-100/50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                       }`}
                     >
                       <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                       <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{validCount} Valid</span>
                     </button>
                   )}
                   {invalidCount > 0 && (
                     <button 
                       onClick={() => setFilter(filter === 'invalid' ? 'all' : 'invalid')}
                       className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                         filter === 'invalid' 
                           ? 'bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20' 
                           : 'bg-rose-100/50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/30'
                       }`}
                     >
                       <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                       <span className="text-sm font-bold text-rose-800 dark:text-rose-300">{invalidCount} Invalid</span>
                     </button>
                   )}
                 </div>

                 <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar pb-10">
                   {filteredResults.map((result, idx) => (
                     <ResultCard key={idx} result={result} />
                   ))}
                   {filteredResults.length === 0 && (
                     <div className="text-center py-12 text-slate-400">
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