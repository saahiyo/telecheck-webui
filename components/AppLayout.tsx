'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Layers, ShieldCheck, Database, Users, Menu, X, Keyboard, Heart, LogIn, UserCircle, Ban, Send, Copy, Check, RefreshCw, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { bind as bindCuelume, setEnabled as setSoundEnabled, play as playSound } from 'cuelume';
import ThemeToggle from './ThemeToggle';
import GithubBtn from './GithubBtn';
import AuthModal from './AuthModal';
import { Toaster, toast } from 'sonner';
import { trackNavigation } from '../utils/tracking';
import { useAuth } from '@/hooks/useAuth';
import { fetchMyProfile } from '@/services/api';

const shortcutGroups = [
  {
    title: 'Navigation',
    items: [
      { keys: ['Alt', '1'], description: 'Open the validator' },
      { keys: ['Alt', '2'], description: 'Open saved links' },
      { keys: ['Alt', '3'], description: 'Open contributors' },
      { keys: ['Alt', 'B'], description: 'Switch to bulk validator' },
      { keys: ['Alt', 'Q'], description: 'Switch to quick check' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { keys: ['/'], description: 'Focus the main input or search box' },
      { keys: ['Ctrl/Cmd', 'Enter'], description: 'Run validation' },
      { keys: ['Ctrl', 'ArrowUp'], description: 'Scroll to the top' },
      { keys: ['Ctrl', 'ArrowDown'], description: 'Scroll to the bottom' },
      { keys: ['E'], description: 'Open export when results are visible' },
      { keys: ['Alt', 'C'], description: 'Clear inputs and results' },
      { keys: ['Alt', 'V'], description: 'Revalidate database links (on saved page)' },
      { keys: ['T'], description: 'Toggle theme' },
      { keys: ['?'], description: 'Show or hide this shortcut list' },
      { keys: ['Esc'], description: 'Close open menus and panels' },
    ],
  },
];

function isTypingTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
}

const APP_VERSION = '0.0.1';
const API_URL =
  process.env.NEXT_PUBLIC_TELECHECK_API_URL?.replace(/\/$/, '') ||
  'https://telecheck.vercel.app';

const springTransition = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.7 };
const navIndicatorTransition = { duration: 0.14, ease: 'easeOut' as const };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { user, isConfigured, getIdToken } = useAuth();
  const themeToggleRef = useRef<HTMLButtonElement>(null);

  const pathname = usePathname();
  const router = useRouter();

  const navigateTo = (href: string, target: 'home' | 'saved' | 'contributors') => {
    if (pathname !== href) {
      router.push(href);
    }
    trackNavigation(target);
  };

  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Initialize cuelume binding and sound preference
  useEffect(() => {
    try {
      bindCuelume();
    } catch {}

    const saved = localStorage.getItem('telecheck_sound');
    const enabled = saved !== 'false';
    setIsSoundEnabled(enabled);
    setSoundEnabled(enabled);
  }, []);

  const toggleSound = () => {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    setSoundEnabled(next);
    localStorage.setItem('telecheck_sound', String(next));
    if (next) {
      playSound('toggle');
    }
  };

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  // Ping API to check status
  useEffect(() => {
    let cancelled = false;
    const checkApi = async () => {
      try {
        const res = await fetch(`${API_URL}/stats?period=24h`, { signal: AbortSignal.timeout(8000) });
        if (!cancelled) setApiStatus(res.ok ? 'online' : 'offline');
      } catch {
        if (!cancelled) setApiStatus('offline');
      }
    };
    checkApi();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key?.toLowerCase();

      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
        setShowShortcuts(false);
        // Dispatch an event so page components can close their own modals if needed
        window.dispatchEvent(new Event('app-escape'));
        return;
      }

      // Global shortcuts that should work even when typing
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        window.dispatchEvent(new Event('app-run-validation'));
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (key === '1') {
          event.preventDefault();
          router.push('/');
          return;
        }

        if (key === '2') {
          event.preventDefault();
          router.push('/saved');
          return;
        }

        if (key === '3') {
          event.preventDefault();
          router.push('/contributors');
          return;
        }

        if (key === 'b') {
          event.preventDefault();
          router.push('/?mode=bulk');
          return;
        }

        if (key === 'q') {
          event.preventDefault();
          router.push('/?mode=single');
          return;
        }

        if (key === 'c') {
          event.preventDefault();
          window.dispatchEvent(new Event('app-clear-all'));
          return;
        }

        if (key === 'v') {
          event.preventDefault();
          window.dispatchEvent(new Event('app-validate-links'));
          return;
        }
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }


      if (key === 't') {
        event.preventDefault();
        themeToggleRef.current?.click();
        return;
      }
      
      // Dispatch other shortcuts to the active pages
      if (!event.altKey && !event.ctrlKey && !event.metaKey && event.key === '/') {
        event.preventDefault();
        window.dispatchEvent(new Event('app-focus-primary-input'));
        return;
      }
      if (event.ctrlKey && !event.altKey && !event.metaKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('app-scroll-boundary', { detail: event.key === 'ArrowUp' ? 'top' : 'bottom' }));
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        window.dispatchEvent(new Event('app-open-export'));
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Listen for any component requesting the auth modal to open
  useEffect(() => {
    const handleOpenAuthModal = () => setIsAuthModalOpen(true);
    window.addEventListener('app-open-auth-modal', handleOpenAuthModal);
    return () => window.removeEventListener('app-open-auth-modal', handleOpenAuthModal);
  }, []);

  // Listen for banned account event
  const [bannedInfo, setBannedInfo] = useState<{ isBanned: boolean; error?: string; reason?: string; contact?: string; caseId?: string } | null>(null);
  const [isCopiedAppeal, setIsCopiedAppeal] = useState(false);

  useEffect(() => {
    const handleBanned = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail || {};
      const reason = detail.reason || detail.error || 'Your account has been suspended by an administrator.';
      setBannedInfo({
        isBanned: true,
        error: reason,
        reason,
        contact: detail.contact || '@saahiyo',
        caseId: `#TC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      });
    };
    window.addEventListener('telecheck:banned', handleBanned);
    return () => window.removeEventListener('telecheck:banned', handleBanned);
  }, []);

  // Proactively check profile on load / login to identify banned state immediately
  useEffect(() => {
    let cancelled = false;
    const checkBanStatus = async () => {
      try {
        const token = user ? await getIdToken() : null;
        const profile = await fetchMyProfile({ authToken: token, firebaseUid: user?.uid });
        if (!cancelled && (profile.is_banned || profile.banned || profile.status === 'suspended')) {
          const reason = (profile as any).ban_reason || (profile as any).reason || (profile as any).error || 'Suspended by an administrator for policy violations.';
          setBannedInfo({
            isBanned: true,
            error: reason,
            reason,
            contact: profile.contact || '@saahiyo',
            caseId: `#TC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          });
        }
      } catch (err: any) {
        if (!cancelled && (err?.banned || err?.status === 'suspended')) {
          const reason = err?.reason || err?.message || 'Your account has been suspended by an administrator.';
          setBannedInfo({
            isBanned: true,
            error: reason,
            reason,
            contact: err.contact || '@saahiyo',
            caseId: `#TC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          });
        }
      }
    };
    checkBanStatus();
    return () => {
      cancelled = true;
    };
  }, [user, getIdToken]);

  const handleCopyAppeal = () => {
    if (!bannedInfo) return;
    const ref = bannedInfo.caseId || '#TC-SEC';
    const reason = bannedInfo.reason || bannedInfo.error || 'Account Suspended';
    const text = `[TeleCheck Pro Appeal]\nReference ID: ${ref}\nReason: ${reason}\nDate: ${new Date().toLocaleDateString()}`;
    navigator.clipboard.writeText(text).then(() => {
      setIsCopiedAppeal(true);
      toast.success('Appeal details copied to clipboard!');
      setTimeout(() => setIsCopiedAppeal(false), 2000);
    }).catch(() => {
      toast.error('Failed to copy to clipboard.');
    });
  };

  const renderSuspendedCard = (isModal = false) => {
    if (!bannedInfo) return null;
    return (
      <div className={`relative w-full ${isModal ? 'max-w-lg' : 'max-w-md mx-auto'} rounded-2xl border border-red-500/30 bg-gradient-to-b from-[#18181c] to-[#101014] p-6 sm:p-7 text-center shadow-2xl shadow-red-500/15 overflow-hidden ring-1 ring-red-500/20`}>
        {/* Subtle top glow */}
        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-28 w-48 rounded-full bg-red-500/20 blur-2xl" />

        {/* Status Badge */}
        <div className="relative mb-4 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span>Access Restricted</span>
        </div>

        {/* Icon */}
        <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-500 shadow-lg shadow-red-500/20">
          <Ban size={28} strokeWidth={2.5} />
        </div>

        <h2 className="relative text-xl font-bold tracking-tight text-white">
          Account Suspended
        </h2>

        <p className="relative mt-1.5 text-xs sm:text-sm leading-relaxed text-zinc-400 max-w-sm mx-auto">
          Your access to link verification and platform submissions has been suspended by an administrator.
        </p>

        {/* Structured Details Box */}
        <div className="relative mt-5 rounded-xl border border-white/10 bg-black/50 p-3.5 text-left text-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400 font-medium">Status</span>
            <span className="rounded-md border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
              Suspended
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-zinc-400 font-medium shrink-0">Reason</span>
            <span className="text-zinc-200 font-medium text-right break-words">
              {bannedInfo.reason || bannedInfo.error || 'Abnormal request volume / Automated spamming'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
            <span className="text-zinc-400 font-medium">Appeal Reference</span>
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
              {bannedInfo.caseId || '#TC-SEC'}
            </code>
          </div>
        </div>

        {/* Advisory Note */}
        <p className="relative mt-3.5 text-[11px] leading-relaxed text-zinc-400 flex items-start gap-1.5 text-left px-1">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-zinc-400" />
          <span>
            If you believe this restriction was placed in error, please reach out to the administrator on Telegram with your Appeal Reference.
          </span>
        </p>

        {/* Action Buttons */}
        <div className="relative mt-5 flex flex-col gap-2.5">
          <a
            href={`https://t.me/${(bannedInfo.contact || 'saahiyo').replace(/^@/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98]"
          >
            <Send size={15} />
            <span>Contact Admin ({bannedInfo.contact || '@saahiyo'})</span>
          </a>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyAppeal}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700/80 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white px-3 py-2 text-xs font-medium text-zinc-300 transition-colors"
            >
              {isCopiedAppeal ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{isCopiedAppeal ? 'Copied!' : 'Copy Appeal Info'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700/80 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white px-3 py-2 text-xs font-medium text-zinc-300 transition-colors"
            >
              <RefreshCw size={13} />
              <span>Check Status</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full relative bg-white dark:bg-black font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black transition-colors duration-200">
      <Toaster position="bottom-center" toastOptions={{
        className: 'dark:bg-[#111] dark:text-white dark:border-[#333] bg-white text-black border-gray-200',
      }} />
      
      {/* Navbar / Header */}
      <div className="border-b border-gray-200 dark:border-[#333] sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:h-16 sm:py-0 flex flex-col justify-center gap-3">
          <div className="flex items-center justify-between gap-3">
            <Link 
              href="/" 
              className="flex items-center gap-2 cursor-pointer min-w-0"
              aria-label="TeleCheck Pro Home"
            >
              <div className="w-8 h-8 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shrink-0">
                <ShieldCheck size={18} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <div className="text-lg font-bold tracking-tight text-black dark:text-white truncate">
                TeleCheck<span className="text-gray-400 dark:text-gray-600">Pro</span>
              </div>
            </Link>

            <div className="flex items-center gap-3 shrink-0">
              {/* Navigation Links */}
              <div className="hidden sm:flex items-center gap-1 bg-gray-100/50 dark:bg-[#111]/50 p-1 rounded-lg border border-gray-200 dark:border-[#333]">
                <button
                  onClick={() => navigateTo('/', 'home')}
                  data-cuelume-navigate
                  className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 overflow-hidden ${pathname === '/' ? 'text-black dark:text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  {pathname === '/' && (
                    <motion.span
                      layoutId="desktop-nav-active"
                      className="absolute inset-0 rounded-md bg-white dark:bg-[#222] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      transition={navIndicatorTransition}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Layers size={14} /> Validator
                  </span>
                </button>
                <button
                  onClick={() => navigateTo('/saved', 'saved')}
                  data-cuelume-navigate
                  className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 overflow-hidden ${pathname === '/saved' ? 'text-black dark:text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  {pathname === '/saved' && (
                    <motion.span
                      layoutId="desktop-nav-active"
                      className="absolute inset-0 rounded-md bg-white dark:bg-[#222] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      transition={navIndicatorTransition}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Database size={14} /> Saved Links
                  </span>
                </button>
                <button
                  onClick={() => navigateTo('/contributors', 'contributors')}
                  data-cuelume-navigate
                  className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 overflow-hidden ${pathname === '/contributors' ? 'text-black dark:text-white' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  {pathname === '/contributors' && (
                    <motion.span
                      layoutId="desktop-nav-active"
                      className="absolute inset-0 rounded-md bg-white dark:bg-[#222] shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      transition={navIndicatorTransition}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Users size={14} /> Contributors
                  </span>
                </button>

              </div>

              <div className="flex items-center gap-2">
                {isConfigured && (
                  <button
                    type="button"
                    onClick={() => user ? router.push('/profile') : setIsAuthModalOpen(true)}
                    className={`rounded-md border transition-all duration-200 overflow-hidden ${
                      user
                        ? 'border-gray-200 dark:border-[#333] hover:opacity-80'
                        : 'p-2 bg-white dark:bg-black border-gray-200 dark:border-[#333] text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#111]'
                    }`}
                    aria-label={user ? 'View profile' : 'Sign in'}
                    title={user ? (user.displayName || user.email || 'Profile') : 'Sign in'}
                  >
                    {user ? (
                      user.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'User'}
                          className="w-8 h-8 rounded-md object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-black dark:bg-white flex items-center justify-center">
                          <span className="text-[11px] font-bold text-white dark:text-black uppercase">
                            {(user.displayName || user.email || 'U').charAt(0)}
                          </span>
                        </div>
                      )
                    ) : (
                      <LogIn size={16} />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleSound}
                  className={`p-2 rounded-md border transition-all duration-200 ${
                    isSoundEnabled
                      ? 'bg-white dark:bg-black border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#111]'
                      : 'bg-gray-100 dark:bg-[#181818] border-gray-200 dark:border-[#333] text-gray-400 dark:text-gray-500'
                  }`}
                  aria-label={isSoundEnabled ? 'Mute interaction sounds' : 'Unmute interaction sounds'}
                  title={isSoundEnabled ? 'Sound is on (Click to mute)' : 'Sound is muted (Click to unmute)'}
                >
                  {isSoundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <ThemeToggle buttonRef={themeToggleRef} />
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(true)}
                  className="sm:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 dark:border-[#333] bg-gray-100/50 dark:bg-[#111]/50 text-gray-700 dark:text-gray-200 transition-colors hover:text-black dark:hover:text-white"
                  aria-label="Open navigation menu"
                  aria-expanded={isMobileNavOpen}
                  aria-controls="mobile-navigation-drawer"
                >
                  <Menu size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileNavOpen && (
          <motion.div
            className="sm:hidden fixed inset-0 z-[60]"
            aria-hidden={!isMobileNavOpen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
        <motion.button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm shadow-none appearance-none border-none"
          onClick={() => setIsMobileNavOpen(false)}
          aria-label="Close navigation menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
        <motion.aside
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="absolute right-0 top-0 h-full w-[280px] max-w-[85vw] border-l border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={springTransition}
        >
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#333] px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-black dark:text-white">Navigation</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Switch between app views</p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 dark:border-[#333] bg-gray-100/50 dark:bg-[#111]/50 text-gray-700 dark:text-gray-200 transition-colors hover:text-black dark:hover:text-white shadow-none"
              aria-label="Close navigation menu"
            >
              <X size={18} />
            </button>
          </div>

          <motion.div
            className="flex flex-col gap-3 p-4 bg-transparent shadow-none"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
            }}
          >
            <motion.button
              type="button"
              onClick={() => {
                navigateTo('/', 'home');
                setIsMobileNavOpen(false);
              }}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all shadow-none appearance-none ${pathname === '/' ? 'border-black/10 bg-gray-100 text-black dark:border-white/10 dark:bg-[#111] dark:text-white' : 'border-gray-200 text-gray-600 hover:text-black dark:border-[#333] dark:text-gray-400 dark:hover:text-white'}`}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="mt-0.5 shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Validator</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Run bulk checks and quick checks</div>
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => {
                navigateTo('/saved', 'saved');
                setIsMobileNavOpen(false);
              }}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all shadow-none appearance-none ${pathname === '/saved' ? 'border-black/10 bg-gray-100 text-black dark:border-white/10 dark:bg-[#111] dark:text-white' : 'border-gray-200 text-gray-600 hover:text-black dark:border-[#333] dark:text-gray-400 dark:hover:text-white'}`}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="mt-0.5 shrink-0">
                <Database size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Saved Links</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Open your saved results and stored links</div>
              </div>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => {
                navigateTo('/contributors', 'contributors');
                setIsMobileNavOpen(false);
              }}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all shadow-none appearance-none ${pathname === '/contributors' ? 'border-black/10 bg-gray-100 text-black dark:border-white/10 dark:bg-[#111] dark:text-white' : 'border-gray-200 text-gray-600 hover:text-black dark:border-[#333] dark:text-gray-400 dark:hover:text-white'}`}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <div className="mt-0.5 shrink-0">
                <Users size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Contributors</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">View the community leaderboard</div>
              </div>
            </motion.button>

            {user && (
              <motion.button
                type="button"
                onClick={() => {
                  navigateTo('/profile', 'home');
                  setIsMobileNavOpen(false);
                }}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all shadow-none appearance-none ${pathname === '/profile' ? 'border-black/10 bg-gray-100 text-black dark:border-white/10 dark:bg-[#111] dark:text-white' : 'border-gray-200 text-gray-600 hover:text-black dark:border-[#333] dark:text-gray-400 dark:hover:text-white'}`}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <div className="mt-0.5 shrink-0">
                  <UserCircle size={18} />
                </div>
                <div>
                  <div className="text-sm font-medium">Profile</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">View your account and stats</div>
                </div>
              </motion.button>
            )}
          </motion.div>
        </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {bannedInfo?.isBanned ? (
        <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          {renderSuspendedCard(false)}
        </main>
      ) : (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-[#333] mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          {/* Mobile: stacked, Desktop: single row */}
          <div className="hidden sm:flex items-center justify-between gap-3">
            {/* Brand + version */}
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <ShieldCheck size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="font-medium text-gray-700 dark:text-gray-300">TeleCheck Pro</span>
              <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#222] text-[10px] font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#333] tabular-nums">
                v{APP_VERSION}
              </span>
            </div>
            {/* API status + GitHub */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${apiStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]' : apiStatus === 'offline' ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]' : 'bg-gray-400 animate-pulse'}`} />
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  API {apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Checking...'}
                </span>
              </div>
              <span className="text-gray-200 dark:text-[#333]">|</span>
              <GithubBtn />
              <span className="text-gray-200 dark:text-[#333]">|</span>
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors font-medium"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard size={13} /><span>Shortcuts</span>
              </button>
            </div>
            {/* Made with + Legal */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                <span>Made with</span>
                <Heart size={10} className="text-red-400 fill-red-400" />
                <span>by</span>
                <a href="https://github.com/saahiyo" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors">saahiyo</a>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy</Link>
                <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms</Link>
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="flex sm:hidden flex-col gap-3 text-xs">
            {/* Row 1: Brand left, Made-with right */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <ShieldCheck size={14} className="text-gray-400 dark:text-gray-500" />
                <span className="font-medium text-gray-700 dark:text-gray-300">TeleCheck Pro</span>
                <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#222] text-[10px] font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#333] tabular-nums">
                  v{APP_VERSION}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                <span>Made with</span>
                <Heart size={10} className="text-red-400 fill-red-400" />
                <span>by</span>
                <a href="https://github.com/saahiyo" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-600 dark:text-gray-300">saahiyo</a>
              </div>
            </div>
            {/* Row 2: API + GitHub left, Privacy/Terms right */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${apiStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]' : apiStatus === 'offline' ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]' : 'bg-gray-400 animate-pulse'}`} />
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    API {apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Checking...'}
                  </span>
                </div>
                <span className="text-gray-200 dark:text-[#333]">|</span>
                <GithubBtn />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy</Link>
                <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showShortcuts && (
        <motion.div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowShortcuts(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <motion.div
            className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={springTransition}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-[#222] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  Keyboard Shortcuts
                </p>
                <h2 id="shortcuts-title" className="mt-1 text-lg font-semibold text-black dark:text-white">Move faster around TeleCheck Pro</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 dark:border-[#333] bg-gray-100/50 dark:bg-[#111]/50 text-gray-700 dark:text-gray-200 transition-colors hover:text-black dark:hover:text-white"
                aria-label="Close keyboard shortcuts"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              {shortcutGroups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] p-4"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    {group.title}
                  </h3>
                  <div className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <div key={item.description} className="flex items-start justify-between gap-4">
                        <p className="text-sm text-black dark:text-white">{item.description}</p>
                        <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                          {item.keys.map((keyLabel) => (
                            <kbd
                              key={`${item.description}-${keyLabel}`}
                              className="min-w-7 rounded-md border border-gray-200 dark:border-[#333] bg-white dark:bg-black px-2 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200 text-center"
                            >
                              {keyLabel}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Account Suspended / Banned Full-Screen Modal */}
      <AnimatePresence>
        {bannedInfo?.isBanned && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg"
            >
              {renderSuspendedCard(true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
