import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Users, Trophy, Medal, Award, Activity, Search, RefreshCw, X, ChevronLeft, ChevronRight, Hash, Calendar, Sparkles, Clock, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import debounce from 'lodash.debounce';
import { clearCache, fetchContributors, fetchMyProfile, getCached, getMyProfileCacheKey, fetchSavedLinks } from '../services/api';
import { useRouter } from 'next/navigation';
import { DotmSquare5 } from '@/components/ui/dotm-square-5';
import { Contributor, MyProfileResponse, ContributorsResponse, StoredLink, LeaderboardTimeframe } from '../types';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface ContributorsPageProps {}

const PAGE_SIZE = 20;
const springTransition = { type: 'spring' as const, stiffness: 520, damping: 42, mass: 0.7 };

function formatShortDate(dateValue?: string) {
  if (!dateValue) return 'Unknown';
  try {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  } catch {
    return 'Unknown';
  }
}

const ContributorsPage: React.FC<ContributorsPageProps> = () => {
  const { user, getIdToken } = useAuth();
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('all');
  const initialContribCache = getCached<ContributorsResponse>(`contributors:${PAGE_SIZE}:0:all`);
  const initialProfileCache = getCached<MyProfileResponse>(getMyProfileCacheKey());
  const router = useRouter();

  const [contributors, setContributors] = useState<Contributor[]>(initialContribCache?.contributors || []);
  const [profile, setProfile] = useState<MyProfileResponse | null>(initialProfileCache || null);
  const [isLoading, setIsLoading] = useState(!initialContribCache);
  const [total, setTotal] = useState(initialContribCache?.total || 0);
  const [page, setPage] = useState(1);
  const hasDataRef = useRef(false);

  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [contributorLinks, setContributorLinks] = useState<StoredLink[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleOpenContributorModal = useCallback(async (contributor: Contributor) => {
    setSelectedContributor(contributor);
    setIsModalLoading(true);
    setContributorLinks([]);
    try {
      const result = await fetchSavedLinks({ user: contributor.username, limit: 100, platform: 'telegram' });
      if (result && result.links) {
        setContributorLinks(result.links);
      }
    } catch (error) {
      console.error('Failed to load contributor links:', error);
      toast.error('Failed to load contributor activity details.');
    } finally {
      setIsModalLoading(false);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedContributor(null);
    setContributorLinks([]);
    setIsModalLoading(false);
  }, []);

  const activityData = useMemo(() => {
    if (!contributorLinks || contributorLinks.length === 0) return [];
    
    const groups: Record<string, number> = {};
    contributorLinks.forEach((link) => {
      if (link.checked_at) {
        try {
          const dateStr = link.checked_at.split('T')[0];
          groups[dateStr] = (groups[dateStr] || 0) + 1;
        } catch {}
      }
    });

    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return sortedDates.slice(0, 10).map((date) => ({
      date,
      count: groups[date],
    }));
  }, [contributorLinks]);

  const maxDayCount = useMemo(() => {
    if (activityData.length === 0) return 1;
    return Math.max(...activityData.map((d) => d.count), 1);
  }, [activityData]);

  const recentLinksPreview = useMemo(() => {
    return contributorLinks.slice(0, 5);
  }, [contributorLinks]);

  const [sortField, setSortField] = useState<'rank' | 'username' | 'first_seen' | 'links_added'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'rank' | 'username' | 'first_seen' | 'links_added') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      if (field === 'links_added') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const sortedContributors = useMemo(() => {
    const list = [...contributors];
    return list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'first_seen') {
        const timeA = a.first_seen ? new Date(a.first_seen).getTime() : 0;
        const timeB = b.first_seen ? new Date(b.first_seen).getTime() : 0;
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }

      return sortDirection === 'asc'
        ? (valA || 0) - (valB || 0)
        : (valB || 0) - (valA || 0);
    });
  }, [contributors, sortField, sortDirection]);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredContributors = useMemo(() => {
    if (!searchQuery.trim()) return sortedContributors;
    return sortedContributors.filter(c => 
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedContributors, searchQuery]);

  const totalCommunityLinks = useMemo(() => {
    return contributors.reduce((sum, c) => sum + (c.links_added || 0), 0);
  }, [contributors]);

  const currentUserInList = useMemo(() => {
    if (!profile?.username) return null;
    return contributors.find(c => c.username.toLowerCase() === profile.username?.toLowerCase()) || null;
  }, [contributors, profile?.username]);

  const displayedUserRank = useMemo(() => {
    if (timeframe === 'all') return profile?.rank ?? currentUserInList?.rank ?? null;
    return currentUserInList ? currentUserInList.rank : null;
  }, [timeframe, profile?.rank, currentUserInList]);

  const displayedUserLinks = useMemo(() => {
    if (timeframe === 'all') return profile?.links_added ?? currentUserInList?.links_added ?? 0;
    return currentUserInList ? currentUserInList.links_added : 0;
  }, [timeframe, profile?.links_added, currentUserInList]);

  const rankProgressInfo = useMemo(() => {
    // Not loaded yet — caller will show a loading state
    if (!profile) return null;

    // Logged in but no contributor record yet (brand-new account)
    if (!profile.username || (!profile.rank && !currentUserInList)) {
      return {
        status: 'unranked',
        text: 'Add valid links to earn a rank on the leaderboard!'
      };
    }

    const currentRank = displayedUserRank;
    const currentLinks = displayedUserLinks;

    if (!currentRank) {
      return {
        status: 'unranked',
        text: timeframe === 'daily' 
          ? 'Add valid links today to enter the daily leaderboard!'
          : timeframe === 'weekly'
          ? 'Add valid links this week to enter the weekly leaderboard!'
          : 'Add valid links to earn a rank on the leaderboard!'
      };
    }

    if (currentRank === 1) {
      return {
        status: 'lead',
        text: timeframe === 'daily'
          ? 'You are leading today’s board! Keep it up. 🏆'
          : timeframe === 'weekly'
          ? 'You are leading this week’s board! Keep it up. 🏆'
          : 'You are leading the board! Keep up the great work. 🏆'
      };
    }

    const nextRank = currentRank - 1;
    const nextContributor = contributors.find(c => c.rank === nextRank);

    if (!nextContributor) {
      return {
        status: 'climbing',
        text: `You are ranked #${currentRank}. Keep adding valid links to climb!`
      };
    }

    const diff = (nextContributor.links_added || 0) - (currentLinks || 0) + 1;
    return {
      status: 'climbing',
      text: `Add ${diff.toLocaleString()} more link${diff === 1 ? '' : 's'} to overtake ${nextContributor.username} (#${nextContributor.rank})!`,
      targetUser: nextContributor.username,
      linksNeeded: diff
    };
  }, [profile, contributors, displayedUserRank, displayedUserLinks, timeframe, currentUserInList]);

  const loadData = useCallback(async (currentPage: number, currentTimeframe: LeaderboardTimeframe = timeframe) => {
    if (!hasDataRef.current) setIsLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const authToken = await getIdToken();

      const [contribData, profileData] = await Promise.all([
        fetchContributors({ limit: PAGE_SIZE, offset, timeframe: currentTimeframe }),
        fetchMyProfile({ authToken, firebaseUid: user?.uid })
      ]);

      setContributors(contribData.contributors || []);
      setTotal(contribData.total || 0);
      setProfile(profileData);
      
      hasDataRef.current = (contribData.contributors?.length ?? 0) > 0;
    } catch (error) {
      toast.error('Failed to load contributors.');
    } finally {
      setIsLoading(false);
    }
  }, [getIdToken, user?.uid, timeframe]);

  useEffect(() => {
    loadData(page, timeframe);
  }, [page, timeframe, loadData]);

  const handleTimeframeChange = (newTimeframe: LeaderboardTimeframe) => {
    if (newTimeframe === timeframe) return;
    setTimeframe(newTimeframe);
    setPage(1);
    hasDataRef.current = false;
    setIsLoading(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedContributor(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (selectedContributor) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedContributor]);

  const handleRefresh = async () => {
    clearCache('contributors:');
    clearCache('profile:');
    setIsLoading(true);
    await loadData(page, timeframe);
  };

  const highestLinksCount = useMemo(() => {
    if (!contributors || contributors.length === 0) return 1;
    return Math.max(...contributors.map(c => c.links_added || 0), 1);
  }, [contributors]);

  const hasPagination = total > PAGE_SIZE;

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-sm ring-1 ring-yellow-500/20">
          <Trophy size={12} className="sm:w-3.5 sm:h-3.5" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-sm ring-1 ring-gray-400/20">
          <Medal size={12} className="sm:w-[14px] sm:h-[14px]" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500 flex items-center justify-center font-bold text-[10px] sm:text-xs shadow-sm ring-1 ring-orange-500/20">
          <Award size={12} className="sm:w-[14px] sm:h-[14px]" />
        </div>
      );
    }
    return (
      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-50 dark:bg-[#111] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-[#333] flex items-center justify-center font-bold text-[10px] sm:text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-full flex items-center justify-center shadow-sm">
            <Users className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-black dark:text-white leading-tight">Contributors</h1>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{total} total members helping out</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 pr-8 w-full sm:w-48 bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:border-gray-300 dark:hover:border-[#444] text-xs text-black dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button 
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh leaderboard"
            className="h-10 px-4 bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all rounded-lg flex items-center justify-center gap-2 shadow-sm text-xs font-medium shrink-0"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Timeframe Filter Tabs */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="inline-flex p-1 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-xl shadow-xs">
          <button
            type="button"
            onClick={() => handleTimeframeChange('all')}
            data-cuelume-select
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              timeframe === 'all'
                ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Trophy size={13} className={timeframe === 'all' ? 'text-yellow-500' : 'opacity-60'} />
            <span>All Time</span>
          </button>

          <button
            type="button"
            onClick={() => handleTimeframeChange('weekly')}
            data-cuelume-select
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              timeframe === 'weekly'
                ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Calendar size={13} className={timeframe === 'weekly' ? 'text-blue-500' : 'opacity-60'} />
            <span>This Week</span>
            <span className="text-[10px] opacity-60 font-normal hidden sm:inline">(7d)</span>
          </button>

          <button
            type="button"
            onClick={() => handleTimeframeChange('daily')}
            data-cuelume-select
            className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              timeframe === 'daily'
                ? 'bg-white dark:bg-black text-black dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-gray-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Clock size={13} className={timeframe === 'daily' ? 'text-amber-500' : 'opacity-60'} />
            <span>Today</span>
            <span className="text-[10px] opacity-60 font-normal hidden sm:inline">(24h)</span>
          </button>
        </div>

        <div className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1.5">
          <Sparkles size={12} className="text-yellow-500" />
          <span>
            {timeframe === 'daily' 
              ? 'Rankings for the last 24 hours' 
              : timeframe === 'weekly' 
              ? 'Rankings for the past 7 days' 
              : 'All-time cumulative rankings'}
          </span>
        </div>
      </div>

      {/* Community Visual Stats Widgets */}
      {!isLoading && contributors.length > 0 && (
        <div className="hidden sm:grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade-in">
          {/* Card 1: Community Impact */}
          <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-[#333] rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center shrink-0 border border-green-100 dark:border-green-900/30">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {timeframe === 'daily' ? 'Today’s Impact' : timeframe === 'weekly' ? 'This Week’s Impact' : 'Community Impact'}
              </p>
              <p className="text-lg font-bold text-black dark:text-white mt-0.5 tabular-nums">
                {totalCommunityLinks.toLocaleString()} <span className="text-xs text-gray-500 font-normal">links added</span>
              </p>
            </div>
          </div>

          {/* Card 2: Total Contributors */}
          <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-[#333] rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/30">
              <Users size={18} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {timeframe === 'daily' ? 'Active Today' : timeframe === 'weekly' ? 'Active This Week' : 'Active Helpers'}
              </p>
              <p className="text-lg font-bold text-black dark:text-white mt-0.5 tabular-nums">
                {total.toLocaleString()} <span className="text-xs text-gray-500 font-normal">members</span>
              </p>
            </div>
          </div>

          {/* Card 3: Rank Progress Tracker */}
          <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-[#333] rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center shrink-0 border border-purple-100 dark:border-purple-900/30">
              <Trophy size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Rank Progress</p>
              <p className="text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-gray-300 mt-1 leading-snug" title={rankProgressInfo ? rankProgressInfo.text : undefined}>
                {rankProgressInfo
                  ? rankProgressInfo.text
                  : user
                    ? isLoading
                      ? 'Loading rank data…'
                      : 'Add valid links to earn a rank!'
                    : 'Log in to check rank progress.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current User Profile Card */}
      {!isLoading && profile?.username && (
        <div className="mb-8 p-[1px] rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-blue-500/10 shadow-sm animate-fade-in">
          <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl rounded-[15px] p-4 sm:p-5 border border-white/20 dark:border-white/5 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-start sm:items-center relative z-10">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-50 dark:from-[#111] to-blue-100 dark:to-[#222] border border-blue-200 dark:border-[#333] rounded-full flex items-center justify-center shadow-sm text-lg sm:text-xl font-bold text-blue-600 dark:text-white shrink-0">
                  {profile.username.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-black dark:text-white truncate">
                      <button
                        onClick={() => handleOpenContributorModal({
                          rank: profile.rank || 0,
                          username: profile.username || '',
                          links_added: profile.links_added,
                          first_seen: profile.first_seen || '',
                          last_seen: profile.last_seen || ''
                        })}
                        className="hover:underline text-left bg-transparent border-none p-0 cursor-pointer font-bold text-black dark:text-white"
                      >
                        {profile.username}
                      </button>
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[9px] sm:text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1 shrink-0">
                      <Sparkles size={10} className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                      You
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5 leading-tight">Keep adding valid links to climb the ranks!</p>
                </div>
              </div>
              
              <div className="flex items-center divide-x divide-gray-200 dark:divide-[#333] border border-gray-200 dark:border-[#333] rounded-lg bg-white/50 dark:bg-[#111]/50 self-stretch sm:self-auto w-full sm:w-auto mt-1 sm:mt-0">
                <div className="px-3 sm:px-4 py-1.5 sm:py-2 flex flex-col items-center flex-1 sm:flex-auto">
                  <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5 sm:mb-1">Your Rank</span>
                  <div className="flex items-center gap-1.5">
                    <Hash size={14} className="text-blue-500 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="text-xs sm:text-sm font-bold text-black dark:text-white">
                      {displayedUserRank ? `#${displayedUserRank}` : '-'}
                    </span>
                  </div>
                </div>
                <div 
                  onClick={() => handleOpenContributorModal({
                    rank: displayedUserRank || 0,
                    username: profile.username || '',
                    links_added: displayedUserLinks,
                    first_seen: profile.first_seen || '',
                    last_seen: profile.last_seen || ''
                  })}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 flex flex-col items-center flex-1 sm:flex-auto cursor-pointer hover:bg-gray-100 dark:hover:bg-[#222] transition-colors"
                >
                  <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5 sm:mb-1">
                    {timeframe === 'daily' ? 'Links Today' : timeframe === 'weekly' ? 'Links This Week' : 'Links Added'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Activity size={14} className="text-green-500 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="text-xs sm:text-sm font-bold text-black dark:text-white">{displayedUserLinks.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty / Loading state handling */}
      {isLoading && contributors.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-black min-h-[300px]">
          <div className="mb-6 text-black dark:text-white">
            <DotmSquare5 size={40} />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Loading Leaderboard</h3>
        </div>
      ) : contributors.length === 0 && !isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50">
          <div className="w-14 h-14 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Trophy size={24} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
            {timeframe === 'daily' 
              ? 'No Activity Today Yet' 
              : timeframe === 'weekly' 
              ? 'No Activity This Week Yet' 
              : 'Leaderboard Empty'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
            {timeframe === 'daily'
              ? 'No links have been submitted in the last 24 hours. Submit a link today to lead the daily board!'
              : timeframe === 'weekly'
              ? 'No links have been submitted in the past 7 days. Submit a link this week to claim the weekly #1 spot!'
              : 'No valid links have been submitted yet. Be the first one to add a link and claim the #1 spot!'}
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden shadow-sm">
          
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[320px] sm:min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#333] bg-gray-50/50 dark:bg-[#111]/50 top-0 sticky z-10 backdrop-blur-sm">
                  <th 
                    onClick={() => handleSort('rank')}
                    className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 w-12 sm:w-16 text-center cursor-pointer hover:bg-gray-100/50 dark:hover:bg-[#222]/30 select-none transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Rank</span>
                      {sortField === 'rank' && (
                        sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('username')}
                    className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-[#222]/30 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Contributor</span>
                      {sortField === 'username' && (
                        sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('first_seen')}
                    className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 w-[25%] hidden sm:table-cell cursor-pointer hover:bg-gray-100/50 dark:hover:bg-[#222]/30 select-none transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Joined</span>
                      {sortField === 'first_seen' && (
                        sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('links_added')}
                    className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 w-20 sm:w-32 text-right cursor-pointer hover:bg-gray-100/50 dark:hover:bg-[#222]/30 select-none transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Links Added</span>
                      {sortField === 'links_added' && (
                        sortDirection === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                      )}
                    </div>
                  </th>
                  <th className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 w-[15%] sm:w-[20%] hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#222]">
                {filteredContributors.map((contributor) => {
                  const isMe = profile?.username === contributor.username;
                  // Dynamic width percentage based on top contributor
                  const widthPercent = highestLinksCount > 0 
                    ? Math.max((contributor.links_added / highestLinksCount) * 100, 2) 
                    : 0;

                  return (
                    <tr 
                      key={`${contributor.rank}-${contributor.username}`} 
                      className={`group transition-colors ${
                        isMe 
                          ? 'bg-blue-50/20 dark:bg-blue-900/10 hover:bg-blue-50/40 dark:hover:bg-blue-900/20' 
                          : 'hover:bg-gray-50 dark:hover:bg-[#111]'
                      }`}
                    >
                      <td className="py-2.5 sm:py-3 px-2 sm:px-4 flex justify-center items-center">
                        {renderRankBadge(contributor.rank)}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 max-w-[120px] sm:max-w-none">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 border ${
                            isMe 
                              ? 'bg-blue-500 text-white border-blue-600' 
                              : 'bg-gray-100 dark:bg-[#222] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#333]'
                          }`}>
                            {contributor.username.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-semibold text-black dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
                              <button
                                onClick={() => handleOpenContributorModal(contributor)}
                                className="truncate hover:underline text-left bg-transparent border-none p-0 cursor-pointer font-semibold text-black dark:text-white"
                              >
                                {contributor.username}
                              </button>
                              {isMe && <span className="text-[8px] sm:text-[9px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1 sm:px-1.5 py-0.5 rounded font-bold shrink-0">YOU</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Calendar size={12} className="opacity-70" />
                          <span>{formatShortDate(contributor.first_seen)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">
                        <button 
                          onClick={() => handleOpenContributorModal(contributor)}
                          className="text-xs sm:text-sm font-bold text-black dark:text-white tabular-nums hover:underline cursor-pointer bg-transparent border-none p-0"
                        >
                          {contributor.links_added.toLocaleString()}
                        </button>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 pr-4 sm:pr-6 w-16 sm:w-32 hidden sm:table-cell">
                        <div className="h-1 sm:h-1.5 bg-gray-100 dark:bg-[#222] rounded-full overflow-hidden w-full flex items-center group-hover:bg-gray-200 dark:group-hover:bg-[#333] transition-colors">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out bg-black dark:bg-white`}
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {hasPagination && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] shrink-0">
              <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
                {searchQuery ? `Found ${filteredContributors.length} matching members` : `Showing ${(page - 1) * PAGE_SIZE + 1} - ${Math.min(page * PAGE_SIZE, total)} of ${total}`}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading || !!searchQuery}
                  data-cuelume-tap
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 shadow-sm"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                  disabled={page >= Math.ceil(total / PAGE_SIZE) || isLoading || !!searchQuery}
                  data-cuelume-tap
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 shadow-sm"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isMounted && createPortal(
        <AnimatePresence>
          {selectedContributor && (
            <motion.div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
              onClick={handleCloseModal}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <motion.div 
                className="w-full max-w-2xl bg-white dark:bg-black border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={springTransition}
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-gray-200 dark:border-[#222] bg-gray-50/50 dark:bg-[#111]/50 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {selectedContributor.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-black dark:text-white flex items-center gap-2">
                        {selectedContributor.username}
                        {profile?.username === selectedContributor.username && (
                          <span className="text-[8px] sm:text-[9px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">YOU</span>
                        )}
                      </h3>
                      <p className="text-[10px] text-gray-500">Contributor Activity Profile</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleCloseModal}
                    className="w-8 h-8 rounded-full border border-gray-200 dark:border-[#333] flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-[#111] hover:text-black dark:hover:text-white transition-all cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                  {/* Profile Overview Card */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-gray-50 dark:bg-[#111]/50 border border-gray-200 dark:border-[#222] rounded-xl flex flex-col justify-between">
                      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Rank</span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Trophy size={14} className="text-yellow-500" />
                        <span className="text-sm font-bold text-black dark:text-white">#{selectedContributor.rank}</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-gray-50 dark:bg-[#111]/50 border border-gray-200 dark:border-[#222] rounded-xl flex flex-col justify-between">
                      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Total Added</span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Activity size={14} className="text-green-500" />
                        <span className="text-sm font-bold text-black dark:text-white">{selectedContributor.links_added.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-gray-50 dark:bg-[#111]/50 border border-gray-200 dark:border-[#222] rounded-xl flex flex-col justify-between">
                      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Joined Date</span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Calendar size={14} className="text-blue-500" />
                        <span className="text-xs font-semibold text-black dark:text-white truncate">{formatShortDate(selectedContributor.first_seen)}</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-gray-50 dark:bg-[#111]/50 border border-gray-200 dark:border-[#222] rounded-xl flex flex-col justify-between">
                      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Last Active</span>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Clock size={14} className="text-purple-500" />
                        <span className="text-xs font-semibold text-black dark:text-white truncate">{formatShortDate(selectedContributor.last_seen)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Loader/Skeleton or Content */}
                  {isModalLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                      <DotmSquare5 size={36} />
                      <span className="text-xs text-gray-500 font-medium">Fetching activity history...</span>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Activity Bar Chart / Sparklines for last 10 dates */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5 font-sans">
                          <Activity size={12} />
                          Activity History (Last 10 Active Days)
                        </h4>
                        
                        {activityData.length === 0 ? (
                          <div className="text-center p-6 bg-gray-50 dark:bg-[#111]/30 border border-dashed border-gray-200 dark:border-[#222] rounded-xl">
                            <span className="text-xs text-gray-500">No recent activity details found.</span>
                          </div>
                        ) : (
                          <div className="space-y-2 bg-gray-50/50 dark:bg-[#111]/20 border border-gray-200 dark:border-[#222] rounded-xl p-4">
                            {activityData.map(({ date, count }) => {
                              const percent = (count / maxDayCount) * 100;
                              return (
                                <div key={date} className="flex items-center gap-4">
                                  <span className="text-[10px] sm:text-xs font-semibold text-gray-500 w-24 tabular-nums">
                                    {formatShortDate(date)}
                                  </span>
                                  <div className="flex-1 h-3 bg-gray-100 dark:bg-[#222] rounded-full overflow-hidden flex items-center">
                                    <div 
                                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] sm:text-xs font-bold text-black dark:text-white w-12 text-right tabular-nums">
                                    {count} {count === 1 ? 'link' : 'links'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Recent Validated Links */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5 font-sans">
                          <Clock size={12} />
                          Recent Link Checks
                        </h4>

                        {recentLinksPreview.length === 0 ? (
                          <div className="text-center p-6 bg-gray-50 dark:bg-[#111]/30 border border-dashed border-gray-200 dark:border-[#222] rounded-xl">
                            <span className="text-xs text-gray-500">No recently checked links visible.</span>
                          </div>
                        ) : (
                          <div className="border border-gray-200 dark:border-[#222] rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-[#222]">
                            {recentLinksPreview.map((link) => {
                              const statusColor = 
                                link.status === 'valid' ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30' :
                                link.status === 'invalid' ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30' :
                                'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-[#333]';

                              return (
                                <div key={link.id} className="p-3 bg-white dark:bg-black hover:bg-gray-50/50 dark:hover:bg-[#111]/30 transition-colors flex items-center justify-between gap-4">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-black dark:text-white truncate">
                                      {link.title || link.url}
                                    </p>
                                    <p className="text-[10px] text-gray-500 truncate mt-0.5 font-medium">
                                      {link.url}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${statusColor} capitalize`}>
                                      {link.status || 'unknown'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-4 border-t border-gray-200 dark:border-[#222] bg-gray-50/50 dark:bg-[#111]/50 backdrop-blur-sm flex items-center justify-end gap-3 sticky bottom-0 z-10">
                  <button 
                    onClick={handleCloseModal}
                    className="h-9 px-4 rounded-lg border border-gray-200 dark:border-[#333] hover:bg-gray-100 dark:hover:bg-[#111] text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  <button 
                    onClick={() => {
                      router.push(`/saved?user=${selectedContributor.username}`);
                      handleCloseModal();
                    }}
                    className="h-9 px-4 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-gray-950 dark:hover:bg-gray-100 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>View All Links</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default ContributorsPage;
