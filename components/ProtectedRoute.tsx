'use client';

import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import { DotmSquare5 } from '@/components/ui/dotm-square-5';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Open the auth modal automatically when landing on a protected page unauthenticated
  useEffect(() => {
    if (!loading && !user) {
      window.dispatchEvent(new Event('app-open-auth-modal'));
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DotmSquare5 size={36} />
      </div>
    );
  }

  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="flex flex-col items-center justify-center min-h-[420px] text-center gap-6 px-4"
      >
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#333] flex items-center justify-center">
          <ShieldCheck size={28} className="text-gray-400 dark:text-gray-500" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-black dark:text-white">
            Sign in to continue
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
            This page requires an account. Sign in or create one — it only takes a second.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new Event('app-open-auth-modal'))}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Sign in
            <ChevronRight size={15} />
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#111] hover:text-black dark:hover:text-white transition-colors"
          >
            Go to Validator
          </Link>
        </div>
      </motion.div>
    );
  }

  return <>{children}</>;
}
