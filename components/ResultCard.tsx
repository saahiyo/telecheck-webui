import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LinkResult } from '../types';
import { X, ExternalLink, Copy, Eye, Users, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { copyText } from '../utils/clipboard';

interface ResultCardProps {
  result: LinkResult;
}

/** Extract a display initial from a title or link */
function getInitial(title?: string, link?: string): string {
  if (title) {
    const cleaned = title.replace(/[^\p{L}\p{N}]/gu, '').trim();
    if (cleaned.length > 0) return cleaned.charAt(0).toUpperCase();
  }
  // Fallback: extract from link, e.g. t.me/username → U
  if (link) {
    const match = link.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (match) return match[1].charAt(0).toUpperCase();
  }
  return '?';
}

/** Stable pastel color from a string (for avatar fallback backgrounds) */
function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 65%)`;
}

const ResultCard: React.FC<ResultCardProps> = React.memo(({ result }) => {
  const status = result.status?.toLowerCase();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const details = result.details || {};
  const hasImage = details.image && !imgError;
  const isValid = status === 'valid';
  const hasRichMeta = isValid && (details.title || details.description || details.image);

  const previewFields = [
    { label: 'Description', value: details.description },
    { label: 'Type', value: details.type ? details.type.charAt(0).toUpperCase() + details.type.slice(1) : undefined },
    { label: 'Members', value: details.memberCountRaw },
    {
      label: 'Saved On',
      value: details.checkedAt ? new Date(details.checkedAt).toLocaleString() : undefined
    },
    { label: 'Status', value: details.savedStatus || result.status },
    { label: 'ID', value: details.savedId }
  ].filter((field) => field.value !== undefined && field.value !== null && `${field.value}`.trim() !== '');

  let statusColor = 'bg-amber-500';
  if (status === 'valid') statusColor = 'bg-emerald-500';
  else if (status === 'invalid') statusColor = 'bg-red-500';
  else if (status === 'mega') statusColor = 'bg-blue-500';

  let statusLabel = result.reason || status || 'unknown';
  // For valid links with type metadata, show the type instead of generic "valid"
  if (isValid && details.type) {
    statusLabel = details.type.charAt(0).toUpperCase() + details.type.slice(1);
  }

  const avatarInitial = getInitial(details.title, result.link);
  const avatarBg = getAvatarColor(result.link);

  useEffect(() => {
    if (!isPreviewOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen]);

  // Reset image error when result changes
  useEffect(() => {
    setImgError(false);
  }, [result.link]);

  const copyToClipboard = async () => {
    try {
      await copyText(result.link);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const avatarElement = (size: 'sm' | 'lg') => {
    const sizeClasses = size === 'sm' ? 'w-9 h-9' : 'w-14 h-14';
    const textSize = size === 'sm' ? 'text-sm' : 'text-xl';

    if (hasImage) {
      return (
        <div className={`${sizeClasses} shrink-0 overflow-hidden rounded-full border border-gray-200 dark:border-[#333]`}>
          <img
            src={details.image}
            alt={details.title || 'Channel'}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      );
    }

    // Fallback: colored initial avatar
    if (isValid || details.title) {
      return (
        <div
          className={`${sizeClasses} shrink-0 rounded-full flex items-center justify-center ${textSize} font-bold text-white`}
          style={{ backgroundColor: avatarBg }}
        >
          {avatarInitial}
        </div>
      );
    }

    // Non-valid without title: no avatar
    return null;
  };

  const previewModal = isPreviewOpen ? (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setIsPreviewOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100 dark:border-[#222]">
          <div className="flex items-center gap-3 min-w-0">
            {avatarElement('lg') || (
              <div className="w-14 h-14 shrink-0 rounded-full border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111]" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${statusColor} shrink-0`}></div>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {statusLabel}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-black dark:text-white break-words">
                {details.title || 'Link Preview'}
              </h3>
            </div>
          </div>
          <button
            onClick={() => setIsPreviewOpen(false)}
            className="p-2 text-gray-400 hover:text-black dark:hover:text-white rounded-md transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] p-4">
            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Telegram Link
            </p>
            <p className="text-sm text-black dark:text-white break-all">
              {result.link}
            </p>
          </div>

          {previewFields.length > 0 && (
            <div className="space-y-3">
              {previewFields.map((field) => (
                <div
                  key={field.label}
                  className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between border-b border-gray-100 dark:border-[#1a1a1a] pb-3 last:border-b-0 last:pb-0"
                >
                  <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sm:w-28 shrink-0">
                    {field.label}
                  </p>
                  <p className="text-sm text-black dark:text-white break-words sm:text-right">
                    {String(field.value)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => void copyToClipboard()}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-sm font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#111] transition-colors flex items-center justify-center gap-2"
            >
              <Copy size={14} />
              Copy Link
            </button>
            <a
              href={result.link.startsWith('http') ? result.link : `https://${result.link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2.5 rounded-lg bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink size={14} />
              Open Link
            </a>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={`group relative bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#333] p-2.5 transition-all hover:bg-gray-50 dark:hover:bg-[#111] ${
      isValid ? 'border-l-2 border-l-emerald-500' : status === 'invalid' ? 'border-l-2 border-l-red-500' : status === 'mega' ? 'border-l-2 border-l-blue-500' : ''
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 flex items-start gap-3">
          {/* Avatar: always show for valid links */}
          {avatarElement('sm') ? (
            <div className="hidden sm:block shrink-0">
              {avatarElement('sm')}
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            {/* Status row with badges */}
            <div className="flex items-center gap-2 mb-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`}></div>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                {statusLabel}
              </span>
              {/* Type badge for valid links */}
              {isValid && details.type && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#222] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#333] uppercase tracking-wider shrink-0 hidden sm:inline">
                  {details.type}
                </span>
              )}
            </div>

            {/* Title / Link */}
            <a
              href={result.link.startsWith('http') ? result.link : `https://${result.link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium text-black dark:text-white truncate hover:underline decoration-gray-400 underline-offset-2"
              title={details.title || result.link}
            >
              {details.title || result.link}
            </a>

            {/* Subtitle row: link + metadata */}
            {(details.title || details.memberCountRaw) && (
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                {details.title && (
                  <span className="truncate" title={result.link}>
                    {result.link}
                  </span>
                )}
                {details.memberCountRaw && (
                  <span className="flex items-center gap-1 shrink-0 text-[10px] font-medium">
                    <Users size={10} className="opacity-60" />
                    {details.memberCountRaw}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="p-2 text-gray-500 hover:text-black dark:hover:text-white rounded-md transition-colors"
            title="View Details"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => void copyToClipboard()}
            className="p-2 text-gray-500 hover:text-black dark:hover:text-white rounded-md transition-colors"
            title="Copy Link"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {isPreviewOpen && previewModal ? createPortal(previewModal, document.body) : null}
    </div>
  );
});

ResultCard.displayName = 'ResultCard';

export default ResultCard;
