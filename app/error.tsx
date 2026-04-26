'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center animate-fade-in">
      <div className="relative mb-8">
        <div className="absolute inset-0 blur-3xl bg-red-500/10 dark:bg-red-500/5 rounded-full scale-150"></div>
        <div className="relative w-24 h-24 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-3xl shadow-xl flex items-center justify-center">
          <AlertCircle size={40} className="text-red-500/50" />
        </div>
      </div>
      
      <h1 className="text-2xl font-bold text-black dark:text-white mb-3 tracking-tight">Something went wrong</h1>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
        We encountered an unexpected error. Our team has been notified and we&apos;re working to fix it.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => reset()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-white rounded-xl font-medium transition-all active:scale-[0.98] shadow-lg shadow-black/5 dark:shadow-white/5"
        >
          <RefreshCw size={18} />
          Try Again
        </button>
        
        <Link 
          href="/"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 text-black dark:text-white rounded-xl font-medium transition-all active:scale-[0.98]"
        >
          <Home size={18} />
          Go Home
        </Link>
      </div>
      
      {error.digest && (
        <p className="mt-8 text-[10px] font-mono text-gray-400 uppercase tracking-widest">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
