import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, Users, Trophy, Medal, Award, Activity, Search, RefreshCw, X, ChevronLeft, ChevronRight, Hash, Calendar, Sparkles } from 'lucide-react';
import debounce from 'lodash.debounce';
import { fetchContributors, fetchMyProfile, getCached } from '../services/api';
import { useRouter } from 'next/navigation';
import { Contributor, MyProfileResponse, ContributorsResponse } from '../types';
import { toast } from 'sonner';

interface ContributorsPageProps {}

const PAGE_SIZE = 20;

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
  const initialContribCache = getCached<ContributorsResponse>(`contributors:${PAGE_SIZE}:0`);
  const initialProfileCache = getCached<MyProfileResponse>('profile');
  const router = useRouter();

  const [contributors, setContributors] = useState<Contributor[]>(initialContribCache?.contributors || []);
  const [profile, setProfile] = useState<MyProfileResponse | null>(initialProfileCache || null);
  const [isLoading, setIsLoading] = useState(!initialContribCache);
  const [total, setTotal] = useState(initialContribCache?.total || 0);
  const [page, setPage] = useState(1);
  const hasDataRef = useRef(false);

  const loadData = useCallback(async (currentPage: number) => {
    if (!hasDataRef.current) setIsLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;

      const [contribData, profileData] = await Promise.all([
        fetchContributors({ limit: PAGE_SIZE, offset }),
        fetchMyProfile()
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
  }, []);

  useEffect(() => {
    loadData(page);
  }, [page, loadData]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadData(page);
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
          <Trophy size={12} className="sm:w-[14px] sm:h-[14px]" />
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
      <div className="flex gap-3 sm:flex-row sm:items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#333] rounded-full flex items-center justify-center shadow-sm">
            <Users className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-black dark:text-white leading-tight">Contributors</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{total} total members helping out</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh leaderboard"
            className="h-10 px-4 bg-white dark:bg-black border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#111] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-white transition-all rounded-lg flex items-center justify-center gap-2 shadow-sm text-xs font-medium"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

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
                    <h3 className="text-sm sm:text-base font-bold text-black dark:text-white truncate">{profile.username}</h3>
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
                    <span className="text-xs sm:text-sm font-bold text-black dark:text-white">{profile.rank || '-'}</span>
                  </div>
                </div>
                <div 
                  onClick={() => router.push(`/saved?user=${profile.username}`)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 flex flex-col items-center flex-1 sm:flex-auto cursor-pointer hover:bg-gray-100 dark:hover:bg-[#222] transition-colors"
                >
                  <span className="text-[9px] sm:text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5 sm:mb-1">Links Added</span>
                  <div className="flex items-center gap-1.5">
                    <Activity size={14} className="text-green-500 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="text-xs sm:text-sm font-bold text-black dark:text-white">{profile.links_added?.toLocaleString() || 0}</span>
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
          <Loader2 className="w-8 h-8 text-black dark:text-white animate-spin mb-4" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Loading Leaderboard</h3>
        </div>
      ) : contributors.length === 0 && !isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 dark:border-[#333] rounded-xl bg-gray-50/50 dark:bg-[#111]/50">
          <div className="w-14 h-14 bg-white dark:bg-black border border-gray-100 dark:border-[#333] rounded-full flex items-center justify-center mb-4 shadow-sm">
            <Trophy size={24} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">Leaderboard Empty</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
            No valid links have been submitted yet. Be the first one to add a link and claim the #1 spot!
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-black border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden shadow-sm">
          
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[320px] sm:min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#333] bg-gray-50/50 dark:bg-[#111]/50 top-0 sticky z-10 backdrop-blur-sm">
                  <th className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 w-12 sm:w-16 text-center">Rank</th>
                  <th className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4">Contributor</th>
                  <th className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 w-[25%] hidden sm:table-cell">Joined</th>
                  <th className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 w-20 sm:w-32 text-right">Links Added</th>
                  <th className="font-semibold text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider py-2 sm:py-3 px-3 sm:px-4 w-[15%] sm:w-[20%] hidden sm:table-cell"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#222]">
                {contributors.map((contributor) => {
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
                              <span className="truncate">{contributor.username}</span>
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
                          onClick={() => router.push(`/saved?user=${contributor.username}`)}
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
                Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 shadow-sm"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                  disabled={page >= Math.ceil(total / PAGE_SIZE) || isLoading}
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
    </div>
  );
};

export default ContributorsPage;
