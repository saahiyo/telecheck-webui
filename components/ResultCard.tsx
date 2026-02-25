import React from 'react';
import { LinkResult } from '../types';
import { Check, X, AlertTriangle, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ResultCardProps {
  result: LinkResult;
}

const ResultCard: React.FC<ResultCardProps> = ({ result }) => {
  const status = result.status?.toLowerCase();
  
  // Status indicator color only
  let statusColor = 'bg-amber-500';
  if (status === 'valid') statusColor = 'bg-black dark:bg-white'; // Valid is "neutral/primary" in this aesthetic
  else if (status === 'invalid') statusColor = 'bg-red-500';
  else if (status === 'mega') statusColor = 'bg-blue-500';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.link);
    toast.success('Link copied');
  };

  return (
    <div className="group relative bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#333] p-2.5 transition-all hover:bg-gray-50 dark:hover:bg-[#111]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`}></div>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
              {result.reason || status}
            </span>
          </div>
          
          <a 
            href={result.link.startsWith('http') ? result.link : `https://${result.link}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-sm font-medium text-black dark:text-white truncate hover:underline decoration-gray-400 underline-offset-2"
          >
            {result.link}
          </a>
        </div>

        <button 
          onClick={copyToClipboard}
          className="p-2 text-gray-400 hover:text-black dark:hover:text-white rounded-md transition-colors opacity-0 group-hover:opacity-100"
          title="Copy Link"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  );
};

export default ResultCard;