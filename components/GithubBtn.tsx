import React from 'react';
import { Github } from 'lucide-react';

const GithubBtn: React.FC = () => {

  return (
    <button
      onClick={() => window.open('https://github.com/saahiyo/telecheck-webui', '_blank')}
      className="p-2 rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-all duration-200 hover:bg-gray-50 dark:hover:bg-[#111]"
      aria-label="Github"
    >
      <Github size={16} />
    </button>
  );
};

export default GithubBtn;
