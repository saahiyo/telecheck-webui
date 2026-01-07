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



  const StatCard = ({ icon: Icon, label, value }: { icon: any, label: string, value: number | undefined }) => (
    <div className="flex flex-col p-3 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] transition-all hover:border-gray-300 dark:hover:border-gray-700">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        <Icon size={14} className="text-gray-400 dark:text-gray-600" />
      </div>
      <div className="text-xl font-bold text-black dark:text-white tabular-nums leading-none">
        {value?.toLocaleString() || '0'}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
      <StatCard 
        icon={Activity} 
        label="Total Processed" 
        value={stats?.total_checked || stats?.total} 
      />
      <StatCard 
        icon={CheckCircle2} 
        label="Valid Links" 
        value={stats?.valid_links || stats?.valid} 
      />
      <StatCard 
        icon={XCircle} 
        label="Invalid Links" 
        value={stats?.invalid_links || stats?.invalid} 
      />
    </div>
  );
};

export default StatsWidget;