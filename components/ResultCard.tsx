import React from 'react';
import { LinkResult } from '../types';
import { Check, X, AlertTriangle, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ResultCardProps {
  result: LinkResult;
}

const ResultCard: React.FC<ResultCardProps> = ({ result }) => {
  const status = result.status?.toLowerCase();
  
  let statusStyles = {
    border: 'border-l-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    icon: AlertTriangle
  };
  
  if (status === 'valid') {
    statusStyles = {
      border: 'border-l-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
      icon: Check
    };
  } else if (status === 'invalid') {
    statusStyles = {
      border: 'border-l-rose-500',
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50/50 dark:bg-rose-900/10',
      badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
      icon: X
    };
  }

  const Icon = statusStyles.icon;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.link);
    toast.success('Link copied to clipboard');
  };

  return (
    <div className={`group relative bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 ${statusStyles.border} border-l-[3px] p-3 transition-all hover:shadow-md animate-slide-up`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {/* Status badge removed as per request */}
            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-none opacity-80">
              {result.reason}
            </span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <a 
              href={result.link.startsWith('http') ? result.link : `https://${result.link}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate leading-tight"
            >
              {result.link}
            </a>
            <ExternalLink size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <button 
          onClick={copyToClipboard}
          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors opacity-0 group-hover:opacity-100"
          title="Copy Link"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
};

export default ResultCard;