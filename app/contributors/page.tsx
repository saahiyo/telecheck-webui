'use client';

import { useEffect } from 'react';
import ContributorsPage from '@/components/ContributorsPage';

export default function Contributors() {
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const targetTop = customEvent.detail === 'top' ? 0 : Number.MAX_SAFE_INTEGER;
      window.scrollTo({
        top: targetTop,
        behavior: 'smooth'
      });
    };

    window.addEventListener('app-scroll-boundary', handleScroll);
    return () => window.removeEventListener('app-scroll-boundary', handleScroll);
  }, []);

  return (
    <div className="animate-fade-in">
      <ContributorsPage />
    </div>
  );
}
