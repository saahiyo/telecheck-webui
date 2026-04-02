'use client';

import { useEffect, useState } from 'react';
import App from '@/App';

export default function AppClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <App />;
}
