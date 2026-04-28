'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, ShieldCheck, Database, Users, Menu, X, Keyboard, Github, Heart } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import GithubBtn from './GithubBtn';
import { Toaster } from 'sonner';
import { trackNavigation } from '../utils/tracking';

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

const APP_VERSION = '0.0.0';
const API_URL =
  process.env.NEXT_PUBLIC_TELECHECK_API_URL?.replace(/\/$/, '') ||
  'https://telecheck.vercel.app';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const themeToggleRef = useRef<HTMLButtonElement>(null);

  const pathname = usePathname();
  const router = useRouter();

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
      const key = event.key.toLowerCase();

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
              <h1 className="text-lg font-bold tracking-tight text-black dark:text-white truncate">
                TeleCheck<span className="text-gray-400 dark:text-gray-600">Pro</span>
              </h1>
            </Link>

            <div className="flex items-center gap-3 shrink-0">
              {/* Navigation Links */}
              <div className="hidden sm:flex items-center gap-1 bg-gray-100/50 dark:bg-[#111]/50 p-1 rounded-lg border border-gray-200 dark:border-[#333]">
                <button
                  onClick={() => {
                    router.push('/');
                    trackNavigation('home');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${pathname === '/' ? 'bg-white dark:bg-[#222] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  <Layers size={14} /> Validator
                </button>
                <button
                  onClick={() => {
                    router.push('/saved');
                    trackNavigation('saved');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${pathname === '/saved' ? 'bg-white dark:bg-[#222] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  <Database size={14} /> Saved Links
                </button>
                <button
                  onClick={() => {
                    router.push('/contributors');
                    trackNavigation('contributors');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${pathname === '/contributors' ? 'bg-white dark:bg-[#222] text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
                >
                  <Users size={14} /> Contributors
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowShortcuts(true)}
                  className="hidden sm:inline-flex p-2 rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-all duration-200 hover:bg-gray-50 dark:hover:bg-[#111]"
                  aria-label="Keyboard shortcuts"
                  title="Keyboard shortcuts (?)"
                >
                  <Keyboard size={16} />
                </button>
                <ThemeToggle buttonRef={themeToggleRef} />
                <GithubBtn />
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

      <div
        className={`sm:hidden fixed inset-0 z-[60] transition-opacity duration-200 ${isMobileNavOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden={!isMobileNavOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm shadow-none appearance-none border-none"
          onClick={() => setIsMobileNavOpen(false)}
          aria-label="Close navigation menu"
        />
        <aside
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={`absolute right-0 top-0 h-full w-[280px] max-w-[85vw] border-l border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl transition-transform duration-200 ${isMobileNavOpen ? 'translate-x-0' : 'translate-x-full'}`}
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

          <div className="flex flex-col gap-3 p-4 bg-transparent shadow-none">
            <button
              type="button"
              onClick={() => {
                router.push('/');
                setIsMobileNavOpen(false);
                trackNavigation('home');
              }}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all shadow-none appearance-none ${pathname === '/' ? 'border-black/10 bg-gray-100 text-black dark:border-white/10 dark:bg-[#111] dark:text-white' : 'border-gray-200 text-gray-600 hover:text-black dark:border-[#333] dark:text-gray-400 dark:hover:text-white'}`}
            >
              <div className="mt-0.5 shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Validator</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Run bulk checks and quick checks</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                router.push('/saved');
                setIsMobileNavOpen(false);
                trackNavigation('saved');
              }}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all shadow-none appearance-none ${pathname === '/saved' ? 'border-black/10 bg-gray-100 text-black dark:border-white/10 dark:bg-[#111] dark:text-white' : 'border-gray-200 text-gray-600 hover:text-black dark:border-[#333] dark:text-gray-400 dark:hover:text-white'}`}
            >
              <div className="mt-0.5 shrink-0">
                <Database size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Saved Links</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Open your saved results and stored links</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                router.push('/contributors');
                setIsMobileNavOpen(false);
                trackNavigation('contributors');
              }}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all shadow-none appearance-none ${pathname === '/contributors' ? 'border-black/10 bg-gray-100 text-black dark:border-white/10 dark:bg-[#111] dark:text-white' : 'border-gray-200 text-gray-600 hover:text-black dark:border-[#333] dark:text-gray-400 dark:hover:text-white'}`}
            >
              <div className="mt-0.5 shrink-0">
                <Users size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Contributors</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">View the community leaderboard</div>
              </div>
            </button>
          </div>
        </aside>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-[#333] mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Left: Brand + version */}
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <ShieldCheck size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="font-medium text-gray-700 dark:text-gray-300">TeleCheck Pro</span>
              <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#222] text-[10px] font-semibold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#333] tabular-nums">
                v{APP_VERSION}
              </span>
            </div>

            {/* Center: API status + GitHub */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    apiStatus === 'online'
                      ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]'
                      : apiStatus === 'offline'
                        ? 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                        : 'bg-gray-400 animate-pulse'
                  }`}
                />
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  API {apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Checking...'}
                </span>
              </div>
              <span className="text-gray-200 dark:text-[#333]">|</span>
              <a
                href="https://github.com/saahiyo/telecheck-webui"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors font-medium"
              >
                <Github size={13} />
                <span>GitHub</span>
              </a>
            </div>

            {/* Right: Made with love + Legal */}
            <div className="flex flex-col items-center sm:items-end gap-2">
              <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                <span>Made with</span>
                <Heart size={10} className="text-red-400 fill-red-400" />
                <span>by</span>
                <a
                  href="https://github.com/saahiyo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
                >
                  saahiyo
                </a>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy</Link>
                <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {showShortcuts && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            onClick={(event) => event.stopPropagation()}
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
          </div>
        </div>
      )}
    </div>
  );
}
