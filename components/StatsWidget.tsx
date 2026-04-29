import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { fetchStats } from '../services/api';
import { StatsData } from '../types';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';

interface StatsWidgetProps {
  refreshTrigger?: number;
}

const StatCard = React.memo(({ icon: Icon, label, value, index }: { icon: any, label: string, value: number | undefined, index: number }) => (
  <motion.div
    className="flex flex-col p-3 rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-[#333] transition-all hover:border-gray-300 dark:hover:border-gray-700"
    initial={{ opacity: 0, y: 12, filter: 'blur(10px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    transition={{ duration: 0.28, ease: 'easeOut', delay: index * 0.06 }}
  >
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
      <Icon size={14} className="text-gray-400 dark:text-gray-600" />
    </div>
    <div className="text-xl font-bold text-black dark:text-white tabular-nums leading-none">
      {value?.toLocaleString() || '0'}
    </div>
  </motion.div>
));

StatCard.displayName = 'StatCard';

const StatsWidget: React.FC<StatsWidgetProps> = ({ refreshTrigger = 0 }) => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const totalProcessed =
    (stats?.total_checked && stats.total_checked > 0)
      ? stats.total_checked
      : (stats?.total && stats.total > 0)
        ? stats.total
        : (stats?.valid_links ?? stats?.valid ?? 0) + (stats?.invalid_links ?? stats?.invalid ?? 0);

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
  }, [refreshTrigger]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
      <StatCard 
        icon={Activity} 
        label="24H Processed" 
        value={totalProcessed} 
        index={0}
      />
      <StatCard 
        icon={CheckCircle2} 
        label="24H Valid Links" 
        value={stats?.valid_links || stats?.valid} 
        index={1}
      />
      <StatCard 
        icon={XCircle} 
        label="24H Invalid Links" 
        value={stats?.invalid_links || stats?.invalid} 
        index={2}
      />
    </div>
  );
};

export default StatsWidget;
