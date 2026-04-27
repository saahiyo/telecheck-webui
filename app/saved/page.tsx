'use client';

import { useRef, useEffect, Suspense } from 'react';
import SavedLinksPage, { SavedLinksPageHandle } from '@/components/SavedLinksPage';
import { DotmSquare5 } from '@/components/ui/dotm-square-5';

export default function Saved() {
  const savedSearchInputRef = useRef<HTMLInputElement>(null);
  const savedLinksPageRef = useRef<SavedLinksPageHandle>(null);

  useEffect(() => {
    const handleFocus = () => {
      savedSearchInputRef.current?.focus();
    };

    const handleScroll = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      savedLinksPageRef.current?.scrollToBoundary(customEvent.detail as 'top' | 'bottom');
    };

    window.addEventListener('app-focus-primary-input', handleFocus);
    window.addEventListener('app-scroll-boundary', handleScroll);

    return () => {
      window.removeEventListener('app-focus-primary-input', handleFocus);
      window.removeEventListener('app-scroll-boundary', handleScroll);
    };
  }, []);

  return (
    <div className="animate-fade-in">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
          <div className="mb-6 text-black dark:text-white">
            <DotmSquare5 size={40} />
          </div>
          <p className="mt-4 text-sm text-gray-500">Loading saved links...</p>
        </div>
      }>
        <SavedLinksPage
          ref={savedLinksPageRef}
          searchInputRef={savedSearchInputRef}
        />
      </Suspense>
    </div>
  );
}

