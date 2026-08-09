'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Mail, ShieldCheck, LogOut, Copy, Check, Eye, EyeOff,
  Hash, Activity, Calendar, Clock, Link2, CheckCircle2, XCircle,
  ExternalLink, RefreshCw, Trophy, Zap, Key, Loader2, ChevronRight,
  AlertCircle, Database,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  fetchMyProfile,
  fetchContributors,
  clearCache,
} from '@/services/api';
import { getContributorIdentity } from '@/utils/contributorIdentity';
import { getResults } from '@/utils/db';
import { MyProfileResponse, LinkResult } from '@/types';
import Link from 'next/link';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(val?: string | null): string {
  if (!val) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(val));
  } catch {
    return '—';
  }
}

function formatRelative(val?: string | null): string {
  if (!val) return '—';
  try {
    const diff = Date.now() - new Date(val).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(val);
  } catch {
    return '—';
  }
}

function truncate(str?: string, len = 12): string {
  if (!str) return '—';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

const springT = { type: 'spring' as const, stiffness: 420, damping: 32 };

// ── sub-components ────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-100 dark:bg-[#1a1a1a] ${className ?? ''}`} />
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  loading,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#444] transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {label}
        </span>
        <Icon size={14} className={accent ?? 'text-gray-400 dark:text-gray-600'} />
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <span className="text-2xl font-bold text-black dark:text-white tabular-nums leading-none">
          {value}
        </span>
      )}
      {sub && !loading && (
        <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{sub}</span>
      )}
    </div>
  );
}

function CopyField({
  label,
  value,
  secret,
  mono,
}: {
  label: string;
  value: string;
  secret?: boolean;
  mono?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const displayValue = secret && !revealed
    ? '•'.repeat(Math.min(value.length, 20))
    : value;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </span>
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333]">
        <span className={`flex-1 min-w-0 text-xs text-black dark:text-white truncate ${mono ? 'font-mono' : 'font-medium'}`}>
          {displayValue}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {secret && (
            <button
              onClick={() => setRevealed(r => !r)}
              className="p-1 rounded-md text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              aria-label={revealed ? 'Hide' : 'Reveal'}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1 rounded-md text-gray-400 hover:text-black dark:hover:text-white transition-colors"
            aria-label="Copy"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white dark:bg-black border border-gray-200 dark:border-[#333]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Not-signed-in state ───────────────────────────────────────────────────────

function SignInPrompt() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springT}
      className="flex flex-col items-center justify-center min-h-[420px] text-center gap-6 px-4"
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#333] flex items-center justify-center">
        <User size={28} className="text-gray-400 dark:text-gray-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-black dark:text-white">Sign in to view your profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
          Your account details, contributor stats, and validation history all live here.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Go to Validator
        <ChevronRight size={15} />
      </Link>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, getIdToken, signOut, loading: authLoading } = useAuth();
  const router = useRouter();

  // contributor API data
  const [profile, setProfile] = useState<MyProfileResponse | null>(null);
  const [totalContributors, setTotalContributors] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // local IndexedDB session results
  const [lastResults, setLastResults] = useState<LinkResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);

  // identity from localStorage
  const [identity] = useState(() => {
    if (typeof window === 'undefined') return null;
    return getContributorIdentity();
  });

  // sign-out in progress
  const [signingOut, setSigningOut] = useState(false);

  // load contributor profile + total count
  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const authToken = await getIdToken();
      const [prof, contribs] = await Promise.all([
        fetchMyProfile({ authToken, firebaseUid: user.uid }),
        fetchContributors({ limit: 1, offset: 0 }),
      ]);
      setProfile(prof);
      setTotalContributors(contribs.total ?? null);
    } catch {
      // silently fail — show dashes
    } finally {
      setProfileLoading(false);
    }
  }, [getIdToken, user]);

  // load last IndexedDB results
  useEffect(() => {
    getResults()
      .then(r => setLastResults(r ?? []))
      .catch(() => setLastResults([]))
      .finally(() => setResultsLoading(false));
  }, []);

  useEffect(() => {
    if (user) loadProfile();
    else setProfileLoading(false);
  }, [user, loadProfile]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast.success('Signed out');
      router.push('/');
    } catch {
      toast.error('Sign-out failed');
      setSigningOut(false);
    }
  };

  const handleRefresh = () => {
    clearCache('profile:');
    clearCache('contributors:');
    loadProfile();
  };

  // ── loading skeleton while Firebase resolves ──
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) return <SignInPrompt />;

  // ── derived values ────────────────────────────────────────────────────────
  const provider = user.providerData?.[0]?.providerId ?? 'password';
  const isGoogle = provider === 'google.com';

  const validCount = lastResults.filter(r => r.status === 'valid').length;
  const invalidCount = lastResults.filter(r => r.status === 'invalid').length;
  const megaCount = lastResults.filter(r => r.status === 'mega').length;
  const totalChecked = lastResults.length;
  const successRate = totalChecked > 0 ? Math.round((validCount / totalChecked) * 100) : null;

  const rank = profile?.rank ?? null;
  const linksAdded = profile?.links_added ?? 0;

  // For new users the API may not yet have a contributor record — fall back to
  // Firebase metadata so the tiles never show "—" for a freshly signed-in user.
  const memberSince = profile?.first_seen ?? user.metadata?.creationTime ?? null;
  const lastActive = profile?.last_seen ?? user.metadata?.lastSignInTime ?? null;

  const rankPercentile =
    rank && totalContributors && totalContributors > 0
      ? Math.round(((totalContributors - rank) / totalContributors) * 100)
      : null;

  // next rank gap — need contributors list for this; approximated from profile
  const nextRankLinksNeeded: number | null = null; // would need neighbours; left for future

  return (
    <motion.div
      className="flex flex-col gap-6"
      initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* ── page heading ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-black dark:text-white">Profile</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Your account, stats, and identity
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={profileLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#111] hover:text-black dark:hover:text-white disabled:opacity-50 transition-colors"
          title="Refresh stats"
        >
          <RefreshCw size={13} className={profileLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── hero / account card ── */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black p-5 sm:p-6">
        {/* subtle background texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #000 0%, transparent 60%)' }} />

        <div className="relative flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* avatar */}
          <div className="shrink-0">
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'Avatar'}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-[#333]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-black dark:bg-white flex items-center justify-center border-2 border-gray-200 dark:border-[#333]">
                <span className="text-2xl font-bold text-white dark:text-black uppercase">
                  {(user.displayName || user.email || 'U').charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* name + meta */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-black dark:text-white truncate">
                {user.displayName || 'Anonymous'}
              </h2>
              {isGoogle && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </span>
              )}
              {user.emailVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                  <ShieldCheck size={9} /> Verified
                </span>
              )}
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 dark:hover:border-red-900/40 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors shrink-0"
              >
                {signingOut
                  ? <Loader2 size={13} className="animate-spin" />
                  : <LogOut size={13} />
                }
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Mail size={13} />
              {user.email}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                Joined {formatDate(user.metadata?.creationTime)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                Last sign-in {formatRelative(user.metadata?.lastSignInTime)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── contributor stat tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          icon={Trophy}
          label="Rank"
          value={rank ? `#${rank}` : '—'}
          sub={rankPercentile !== null ? `Top ${100 - rankPercentile}%` : undefined}
          loading={profileLoading}
          accent="text-yellow-500"
        />
        <StatTile
          icon={Activity}
          label="Links Added"
          value={linksAdded.toLocaleString()}
          sub="total validated"
          loading={profileLoading}
          accent="text-green-500"
        />
        <StatTile
          icon={Calendar}
          label="Member Since"
          value={formatDate(memberSince)}
          loading={profileLoading}
          accent="text-blue-500"
        />
        <StatTile
          icon={Clock}
          label="Last Active"
          value={formatRelative(lastActive)}
          loading={profileLoading}
          accent="text-purple-500"
        />
      </div>

      {/* ── rank progress bar ── */}
      <AnimatePresence>
        {!profileLoading && rank !== null && totalContributors !== null && totalContributors > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={springT}
            className="flex flex-col gap-3 p-5 rounded-2xl bg-white dark:bg-black border border-gray-200 dark:border-[#333]"
          >
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1.5">
                <Trophy size={12} /> Rank Progress
              </span>
              <span className="tabular-nums text-black dark:text-white text-xs font-bold">
                #{rank} / {totalContributors.toLocaleString()}
              </span>
            </div>

            {/* bar */}
            <div className="h-2 w-full bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-black dark:bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, ((totalContributors - rank + 1) / totalContributors) * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>Rank #{totalContributors} (last)</span>
              <span>Rank #1 (top)</span>
            </div>

            {rank === 1 ? (
              <p className="text-xs text-black dark:text-white font-semibold text-center">
                🏆 You are #1 on the leaderboard!
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Keep adding valid links to climb the board.{' '}
                <Link href="/contributors" className="text-black dark:text-white font-semibold hover:underline underline-offset-2">
                  View leaderboard →
                </Link>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── two-column section row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* contributor identity */}
        <SectionCard title="Contributor Identity" icon={Key}>
          <div className="flex flex-col gap-3">
            {profile?.username ? (
              <CopyField label="Username" value={profile.username} />
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Username</span>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333]">
                  <AlertCircle size={13} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">Not set — check Contributors page</span>
                </div>
              </div>
            )}
            {identity?.deviceId && (
              <CopyField
                label="Device ID"
                value={identity.deviceId}
                mono
              />
            )}
            {profile?.recovery_key && (
              <CopyField
                label="Recovery Key"
                value={profile.recovery_key}
                secret
                mono
              />
            )}
          </div>
        </SectionCard>

        {/* last session results */}
        <SectionCard
          title="Last Session"
          icon={Database}
          action={
            <Link
              href="/"
              className="text-[10px] font-semibold text-gray-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
            >
              Run validator <ExternalLink size={10} />
            </Link>
          }
        >
          {resultsLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : totalChecked === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
              <Link2 size={22} className="text-gray-300 dark:text-gray-700" />
              <span className="text-xs text-gray-400 dark:text-gray-500">No cached results yet.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Total checked</span>
                <span className="font-bold text-black dark:text-white tabular-nums">{totalChecked.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <CheckCircle2 size={12} className="text-green-500" /> Valid
                </span>
                <span className="font-bold text-black dark:text-white tabular-nums">{validCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <XCircle size={12} className="text-red-500" /> Invalid
                </span>
                <span className="font-bold text-black dark:text-white tabular-nums">{invalidCount.toLocaleString()}</span>
              </div>
              {megaCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Zap size={12} className="text-orange-500" /> Mega.nz
                  </span>
                  <span className="font-bold text-black dark:text-white tabular-nums">{megaCount.toLocaleString()}</span>
                </div>
              )}
              {successRate !== null && (
                <>
                  <div className="h-px bg-gray-100 dark:bg-[#222] my-0.5" />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 dark:text-gray-500">Success rate</span>
                      <span className="font-bold text-black dark:text-white tabular-nums">{successRate}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-black dark:bg-white"
                        initial={{ width: 0 }}
                        animate={{ width: `${successRate}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </SectionCard>
      </div>

    </motion.div>
  );
}
