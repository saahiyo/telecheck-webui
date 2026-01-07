import React, { useEffect, useState } from 'react';
import { fetchStats } from '../services/api';
import { StatsData } from '../types';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';

const StatsWidget: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchStats();
        setStats(data);
      } catch (e) {
        console.error("Failed to load stats", e);
      }
    };
    loadStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);



  const StatCard = ({ icon: Icon, label, value, colorClass, bgClass }: { icon: any, label: string, value: number | undefined, colorClass: string, bgClass: string }) => (
    <div className={`relative overflow-hidden group p-3 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md hover:-translate-y-0.5`}>
      <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity ${colorClass}`}>
        <Icon size={32} />
      </div>
      
      <div className="relative z-10 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0">{label}</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">
            {value?.toLocaleString() || '0'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-6">
      <StatCard 
        icon={Activity} 
        label="Total Processed" 
        value={stats?.total_checked || stats?.total} 
        colorClass="text-blue-600 dark:text-blue-400" 
        bgClass="bg-blue-50 dark:bg-blue-900/20"
      />
      <StatCard 
        icon={CheckCircle2} 
        label="Valid Links" 
        value={stats?.valid_links || stats?.valid} 
        colorClass="text-emerald-600 dark:text-emerald-400" 
        bgClass="bg-emerald-50 dark:bg-emerald-900/20"
      />
      <StatCard 
        icon={XCircle} 
        label="Invalid Links" 
        value={stats?.invalid_links || stats?.invalid} 
        colorClass="text-rose-600 dark:text-rose-400" 
        bgClass="bg-rose-50 dark:bg-rose-900/20"
      />
    </div>
  );
};

export default StatsWidget;