import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const themeColors = {
  light: '#f8fafc',
  dark: '#020617',
} as const;

interface ThemeToggleProps {
  buttonRef?: React.Ref<HTMLButtonElement>;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ buttonRef }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const syncThemeColor = (nextTheme: 'light' | 'dark') => {
    let themeColorMeta = document.querySelector('meta[name="theme-color"]:not([media])');

    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.setAttribute('content', themeColors[nextTheme]);
  };

  useEffect(() => {
    // Check system preference or local storage
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
      syncThemeColor('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
      syncThemeColor('light');
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      syncThemeColor('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      syncThemeColor('light');
    }
  };

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className="p-2 rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-all duration-200 hover:bg-gray-50 dark:hover:bg-[#111]"
      aria-label="Toggle Theme"
      title="Toggle theme (T)"
    >
      {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
};

export default ThemeToggle;
