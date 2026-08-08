import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LinkResult } from '../types';
import { X, ExternalLink, Copy, Eye, Users, Tag as TagIcon, Loader2, Check, Zap, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { copyText } from '../utils/clipboard';
import { updateLinkTags } from '../services/api';
import { trackLinkCopy, trackLinkPreview, trackTagModalOpen, trackTagToggle } from '../utils/tracking';
import { DEFAULT_TAGS } from '../utils/helpers';
import ErrorBoundary from './ErrorBoundary';
import { useAuth } from '@/hooks/useAuth';

interface ResultCardProps {
  result: LinkResult;
  isTopContributor?: boolean;
  onDelete?: (id: number | undefined, url: string) => void;
  onUndoDelete?: (id: number | undefined, url: string) => void;
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

const ResultCard: React.FC<ResultCardProps> = React.memo(({ result, isTopContributor = false, onDelete, onUndoDelete }) => {
  const { getIdToken } = useAuth();
  const status = result.status?.toLowerCase();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const confirmDeleteBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelDeleteBtnRef = useRef<HTMLButtonElement | null>(null);

  const details = result.details || {};
  const hasImage = details.image && !imgError;
  const isValid = status === 'valid';
  const hasRichMeta = isValid && (details.title || details.description || details.image);
  
  const PREDEFINED_TAGS = DEFAULT_TAGS;
  const [localTags, setLocalTags] = useState<string[]>(result.tags || []);
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  
  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
    if (onDelete) {
      onDelete(details.savedId, result.link);
      toast.success('Link deleted from view', {
        action: onUndoDelete ? {
          label: 'Undo',
          onClick: () => {
            onUndoDelete(details.savedId, result.link);
            toast.success('Link restored');
          }
        } : undefined
      });
    }
  }, [details.savedId, onDelete, onUndoDelete, result.link]);

  const contributorLinksAdded = Number(details.contributorLinksAdded);

  // Keyboard navigation & accessibility for Delete Modal
  useEffect(() => {
    if (!isDeleteModalOpen) return;

    // Auto-focus Delete button when modal opens for quick Enter confirmation
    const timer = setTimeout(() => {
      confirmDeleteBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsDeleteModalOpen(false);
      } else if (event.key === 'Enter') {
        if (document.activeElement !== cancelDeleteBtnRef.current) {
          event.preventDefault();
          handleConfirmDelete();
        }
      } else if (event.key === 'Tab') {
        const focusable = [cancelDeleteBtnRef.current, confirmDeleteBtnRef.current].filter(Boolean);
        if (focusable.length < 2) return;
        const index = focusable.indexOf(document.activeElement as HTMLButtonElement);

        if (event.shiftKey) {
          if (index <= 0) {
            event.preventDefault();
            focusable[focusable.length - 1]?.focus();
          }
        } else {
          if (index === -1 || index >= focusable.length - 1) {
            event.preventDefault();
            focusable[0]?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeleteModalOpen, handleConfirmDelete]);

  // Sync tags if result changes from parent
  useEffect(() => {
    setLocalTags(result.tags || []);
  }, [result.tags]);

  const previewFields = [
    { label: 'Description', value: details.description },
    { label: 'Type', value: details.type ? details.type.charAt(0).toUpperCase() + details.type.slice(1) : undefined },
    { label: 'Members', value: details.memberCountRaw },
    {
      label: 'Saved On',
      value: details.checkedAt ? new Date(details.checkedAt).toLocaleString() : undefined
    },
    { label: 'Status', value: details.savedStatus || result.status },
    { label: 'Contributor', value: details.contributorUsername },
    {
      label: 'Contributed',
      value: Number.isFinite(contributorLinksAdded) ? `${contributorLinksAdded.toLocaleString()} links` : undefined
    },
    {
      label: 'First Seen',
      value: details.contributorFirstSeen ? new Date(details.contributorFirstSeen).toLocaleString() : undefined
    },
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
    if (!isPreviewOpen && !isTagModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false);
        setIsTagModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewOpen, isTagModalOpen]);

  // Reset image error when result changes
  useEffect(() => {
    setImgError(false);
  }, [result.link]);

  const copyToClipboard = async () => {
    try {
      await copyText(result.link);
      trackLinkCopy(result.link, 'result_card');
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleToggleTag = async (tag: string) => {
    if (isUpdatingTags) return;
    const authToken = await getIdToken();
    if (!authToken) {
      toast.error('Please sign in before updating tags.');
      return;
    }

    setIsUpdatingTags(true);
    const isSelected = localTags.includes(tag);
    const updatedTags = isSelected
      ? localTags.filter(t => t !== tag)
      : [...localTags, tag];
    const success = await updateLinkTags(result.link, updatedTags, authToken);
    setIsUpdatingTags(false);
    
    if (success) {
      setLocalTags(updatedTags);
      trackTagToggle(result.link, tag, isSelected ? 'removed' : 'added');
    } else {
      toast.error('Failed to update tags');
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
      className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setIsPreviewOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
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
              <h3 id="preview-title" className="text-lg font-semibold text-black dark:text-white wrap-break-word">
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
                  <p className="text-sm text-black dark:text-white wrap-break-word sm:text-right">
                    {String(field.value)}
                  </p>
                </div>
              ))}
            </div>
          )}
          {/* Tags inside preview */}
          {localTags.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {localTags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full border border-gray-200 dark:border-[#333] bg-gray-100 dark:bg-[#111] px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => void copyToClipboard()}
              className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-xs font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#111] transition-colors flex items-center justify-center gap-1.5"
            >
              <Copy size={13} />
              Copy Link
            </button>
            <a
              href={result.link.startsWith('http') ? result.link : `https://${result.link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-3 py-2.5 rounded-lg bg-black hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 text-xs font-medium text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={13} />
              Open Link
            </a>
            {onDelete && (
              <button
                onClick={() => {
                  setIsPreviewOpen(false);
                  handleDeleteClick();
                }}
                className="flex-1 px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const tagModal = isTagModalOpen ? (
    <div
      className="fixed inset-0 z-100 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setIsTagModalOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="tag-modal-title" className="text-lg font-semibold text-black dark:text-white flex items-center gap-2">
            <TagIcon size={18} aria-hidden="true" /> Assign Tags
          </h3>
          <button onClick={() => setIsTagModalOpen(false)} className="text-gray-400 hover:text-black dark:hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        {isUpdatingTags && (
          <div className="flex items-center justify-center py-2 mb-3">
            <Loader2 size={16} className="animate-spin text-gray-400" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {PREDEFINED_TAGS.map(tag => {
            const isActive = localTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => void handleToggleTag(tag)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 border ${
                  isActive
                    ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-black dark:text-gray-400 dark:border-[#333] dark:hover:border-[#444]'
                }`}
              >
                {tag}
                {isActive && <X size={10} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  const deleteModal = isDeleteModalOpen ? (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setIsDeleteModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-desc"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-500">
          <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/30 flex items-center justify-center shrink-0">
            <Trash2 size={20} />
          </div>
          <div>
            <h3 id="delete-modal-title" className="text-base font-semibold text-black dark:text-white">
              Delete Saved Link
            </h3>
            <p id="delete-modal-desc" className="text-xs text-gray-500 dark:text-gray-400">
              This action will remove the link from your view. Press <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded text-gray-700 dark:text-gray-300">Enter ↵</kbd> to confirm or <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-gray-100 dark:bg-[#222] border border-gray-200 dark:border-[#333] rounded text-gray-700 dark:text-gray-300">Esc</kbd> to cancel.
            </p>
          </div>
        </div>

        <div className="my-4 p-3 rounded-lg bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#222]">
          <p className="text-xs font-semibold text-black dark:text-white truncate">
            {details.title || result.link}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {result.link}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            ref={cancelDeleteBtnRef}
            type="button"
            onClick={() => setIsDeleteModalOpen(false)}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmDeleteBtnRef}
            type="button"
            onClick={handleConfirmDelete}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            Delete Link
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="group relative bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-[#333] p-2.5 transition-all hover:bg-gray-50 dark:hover:bg-[#111]">
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
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`} aria-hidden="true"></div>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate" aria-label={`Status: ${statusLabel}`}>
                {statusLabel}
              </span>
              {result.cached && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-semibold uppercase tracking-wider" title="Served from cache">
                  <Zap size={8} />
                  Cached
                </span>
              )}
            </div>

            {/* Title / Link */}
            <a
              href={result.link.startsWith('http') ? result.link : `https://${result.link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-medium text-black dark:text-white truncate hover:underline decoration-gray-400 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white rounded"
              title={details.title || result.link}
            >
              {details.title || result.link}
            </a>

            {/* Subtitle row: link + metadata */}
            {(details.title || details.memberCountCompact || details.memberCountRaw) && (
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                {details.title && (
                  <span className="truncate" title={result.link}>
                    {result.link}
                  </span>
                )}
                {(details.memberCountCompact || details.memberCountRaw) && (
                  <span className="flex items-center gap-1 shrink-0 text-[10px] font-medium">
                    <Users size={10} className="opacity-60" />
                    {details.memberCountCompact || details.memberCountRaw}
                  </span>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={() => {
              setIsPreviewOpen(true);
              trackLinkPreview(result.link);
            }}
            className="p-2 text-gray-500 hover:text-black dark:hover:text-white rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
            title="View Details"
            aria-label={`View details for ${details.title || result.link}`}
          >
            <Eye size={14} aria-hidden="true" />
          </button>
          <button
            onClick={() => {
              setIsTagModalOpen(true);
              trackTagModalOpen(result.link);
            }}
            className="p-2 text-gray-500 hover:text-black dark:hover:text-white rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
            title="Edit Tags"
            aria-label={`Edit tags for ${details.title || result.link}`}
          >
            <TagIcon size={14} aria-hidden="true" />
          </button>
          <button
            onClick={() => void copyToClipboard()}
            className="p-2 text-gray-500 hover:text-black dark:hover:text-white rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white"
            title="Copy Link"
            aria-label={`Copy link for ${details.title || result.link}`}
          >
            <Copy size={14} aria-hidden="true" />
          </button>
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              title="Delete Saved Link"
              aria-label={`Delete saved link for ${details.title || result.link}`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {isPreviewOpen && previewModal ? createPortal(previewModal, document.body) : null}
      {isTagModalOpen && tagModal ? createPortal(tagModal, document.body) : null}
      {isDeleteModalOpen && deleteModal ? createPortal(deleteModal, document.body) : null}
    </div>
  );
});

ResultCard.displayName = 'ResultCard';

const ResultCardWithBoundary: React.FC<ResultCardProps> = (props) => (
  <ErrorBoundary>
    <ResultCard {...props} />
  </ErrorBoundary>
);

ResultCardWithBoundary.displayName = 'ResultCardWithBoundary';

export default ResultCardWithBoundary;
