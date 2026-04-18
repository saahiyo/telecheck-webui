import React, { useState, useMemo, useEffect } from 'react';
import { X, Copy, CalendarDays, Hash, Layers, CheckCircle2, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { copyText } from '../utils/clipboard';
import { StoredLink } from '../types';

interface LinkCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  links: StoredLink[];
  totalInDb: number;
}

type CopyScope = 'all' | 'today' | 'custom';
type CopyFormat = 'plain' | 'numbered' | 'gap' | 'withTitle';

const FORMAT_OPTIONS: Array<{ value: CopyFormat; label: string; desc: string }> = [
  { value: 'plain', label: 'Plain List', desc: 'One link per line' },
  { value: 'numbered', label: 'Numbered', desc: '1. link, 2. link ...' },
  { value: 'gap', label: 'With Gap', desc: 'Double-spaced links' },
  { value: 'withTitle', label: 'With Title', desc: 'Title + link pairs' },
];

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

const LinkCopyModal: React.FC<LinkCopyModalProps> = ({ isOpen, onClose, links, totalInDb }) => {
  const [scope, setScope] = useState<CopyScope>('all');
  const [format, setFormat] = useState<CopyFormat>('plain');
  const [customCount, setCustomCount] = useState<string>('10');
  const [copyFrom, setCopyFrom] = useState<'first' | 'last'>('first');
  const [copied, setCopied] = useState(false);

  // Reset copied state when modal opens/closes
  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const todayLinks = useMemo(() => {
    const today = new Date();
    return links.filter(link => {
      if (!link.checked_at) return false;
      const linkDate = new Date(link.checked_at);
      return !isNaN(linkDate.getTime()) && isSameDay(linkDate, today);
    });
  }, [links]);

  const selectedLinks = useMemo(() => {
    if (scope === 'today') return todayLinks;
    if (scope === 'custom') {
      const count = Math.max(1, Math.min(parseInt(customCount) || 1, links.length));
      if (copyFrom === 'first') return links.slice(0, count);
      return links.slice(-count);
    }
    return links; // 'all'
  }, [scope, links, todayLinks, customCount, copyFrom]);

  const formatLinks = (linksToFormat: StoredLink[], fmt: CopyFormat): string => {
    switch (fmt) {
      case 'numbered':
        return linksToFormat.map((l, i) => `${i + 1}. ${l.url}`).join('\n');
      case 'gap':
        return linksToFormat.map(l => l.url).join('\n\n');
      case 'withTitle':
        return linksToFormat.map(l => {
          const title = l.title || l.description;
          return title ? `${title}\n${l.url}` : l.url;
        }).join('\n\n');
      case 'plain':
      default:
        return linksToFormat.map(l => l.url).join('\n');
    }
  };

  const handleCopy = async () => {
    if (selectedLinks.length === 0) {
      toast.error('No links to copy');
      return;
    }

    const text = formatLinks(selectedLinks, format);

    try {
      await copyText(text);
      setCopied(true);
      toast.success(`Copied ${selectedLinks.length} link${selectedLinks.length > 1 ? 's' : ''} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  const scopeOptions: Array<{
    value: CopyScope;
    label: string;
    icon: React.ReactNode;
    count: number;
    desc: string;
  }> = [
    {
      value: 'all',
      label: 'All on Page',
      icon: <Layers size={16} />,
      count: links.length,
      desc: `${links.length} links loaded`,
    },
    {
      value: 'today',
      label: "Today's Links",
      icon: <CalendarDays size={16} />,
      count: todayLinks.length,
      desc: todayLinks.length > 0 ? `${todayLinks.length} added today` : 'None added today',
    },
    {
      value: 'custom',
      label: 'Custom Count',
      icon: <Hash size={16} />,
      count: scope === 'custom' ? Math.min(parseInt(customCount) || 0, links.length) : 0,
      desc: 'Choose how many',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100 dark:border-[#222]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-full flex items-center justify-center">
              <ClipboardList size={18} className="text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-black dark:text-white">Copy Links</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {links.length} loaded · {totalInDb} total in database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-black dark:hover:text-white rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-[#111]"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Scope Selection */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 mb-3">
              Select Links
            </p>
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map((opt) => {
                const isActive = scope === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScope(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-black dark:bg-black dark:text-gray-400 dark:border-[#333] dark:hover:border-[#444] dark:hover:text-white'
                    }`}
                  >
                    {React.cloneElement(opt.icon as React.ReactElement, { size: 14 })}
                    <span>{opt.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ml-1 leading-none ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black'
                          : 'bg-gray-100 text-gray-500 dark:bg-[#222] dark:text-gray-400'
                    }`}>
                      {opt.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Count Controls (shown only when "custom" scope selected) */}
          {scope === 'custom' && (
            <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] p-2.5 animate-fade-in flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 border-b sm:border-b-0 border-gray-200 dark:border-[#333] pb-2 sm:pb-0 sm:border-r sm:pr-3">
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Copy:</span>
                <div className="inline-flex p-0.5 bg-gray-100 dark:bg-[#222] rounded-lg border border-gray-200 dark:border-[#333]">
                  <button
                    type="button"
                    onClick={() => setCopyFrom('first')}
                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                      copyFrom === 'first'
                        ? 'bg-white dark:bg-[#333] text-black dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    First
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopyFrom('last')}
                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                      copyFrom === 'last'
                        ? 'bg-white dark:bg-[#333] text-black dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    Last
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-1 w-full">
                <input
                  type="number"
                  min={1}
                  max={links.length}
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  className="w-16 px-2 py-1.5 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] focus:border-black dark:focus:border-white outline-none transition-all text-xs font-medium text-black dark:text-white text-center"
                  placeholder="10"
                />
                <span className="text-[10px] text-gray-400 shrink-0">/ {links.length}</span>

                <div className="flex-1"></div>

                <div className="flex gap-1">
                  {[5, 10, 25, 50].filter(n => n <= links.length).map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCustomCount(String(num))}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all text-center min-w-[28px] ${
                        customCount === String(num)
                          ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-black dark:bg-[#222] dark:border-[#333] dark:text-gray-400 dark:hover:bg-[#333] dark:hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Format Selection */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 mb-3">
              Output Format
            </p>
            <div className="flex flex-wrap gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const isActive = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-black dark:bg-black dark:text-gray-400 dark:border-[#333] dark:hover:border-[#444] dark:hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          {selectedLinks.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] p-3">
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Preview · {selectedLinks.length} link{selectedLinks.length > 1 ? 's' : ''}
              </p>
              <div className="text-xs text-black dark:text-white font-mono break-all max-h-24 overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap">
                {formatLinks(selectedLinks.slice(0, 5), format)}
                {selectedLinks.length > 5 && (
                  <span className="text-gray-400 dark:text-gray-500 block mt-1">
                    ... and {selectedLinks.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-[#222] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#111] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={selectedLinks.length === 0}
            className={`flex-1 max-w-[220px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-white'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 size={16} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy {selectedLinks.length} Link{selectedLinks.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkCopyModal;
