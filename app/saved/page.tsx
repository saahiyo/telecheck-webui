'use client';

import { useRef, useEffect } from 'react';
import SavedLinksPage, { SavedLinksPageHandle } from '@/components/SavedLinksPage';

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
      <SavedLinksPage
        ref={savedLinksPageRef}
        searchInputRef={savedSearchInputRef}
      />
    </div>
  );
}
