import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center animate-fade-in">
      <div className="relative mb-8">
        <div className="absolute inset-0 blur-3xl bg-blue-500/10 dark:bg-blue-500/5 rounded-full scale-150"></div>
        <div className="relative w-24 h-24 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-3xl shadow-xl flex items-center justify-center">
          <Search size={40} className="text-gray-300 dark:text-gray-600" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white dark:border-black">
             <span className="text-[10px] font-bold text-white">!</span>
          </div>
        </div>
      </div>
      
      <h1 className="text-4xl font-bold text-black dark:text-white mb-3 tracking-tight">404</h1>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Page Not Found</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
        The page you are looking for doesn&apos;t exist or has been moved to another URL.
      </p>
      
      <Link 
        href="/"
        className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-white rounded-xl font-medium transition-all active:scale-[0.98] shadow-lg shadow-black/5 dark:shadow-white/5"
      >
        <Home size={18} />
        Back to Validator
      </Link>
    </div>
  );
}
