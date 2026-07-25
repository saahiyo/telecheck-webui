'use client';

import React, { useState } from 'react';
import { Github, X, ExternalLink, Send, Code2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const REPO_URL = 'https://github.com/saahiyo/telecheck-webui';
const TELEGRAM_URL = 'https://t.me/Saahiyo';
const TELEGRAM_USERNAME = '@Saahiyo';

const springT = { type: 'spring' as const, stiffness: 420, damping: 30 };

const GithubBtn: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-md bg-white dark:bg-black border border-gray-200 dark:border-[#333] text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-all duration-200 hover:bg-gray-50 dark:hover:bg-[#111]"
        aria-label="Contact & Source"
        title="Contact & Source"
      >
        <Github size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* dark overlay */}
            <motion.div
              key="contact-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60]"
              style={{ background: 'rgba(0,0,0,0.55)' }}
            />

            {/* blur layer */}
            <motion.div
              key="contact-blur"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[61] backdrop-blur-sm pointer-events-none"
            />

            {/* modal */}
            <motion.div
              key="contact-modal"
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={springT}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4"
              onClick={() => setOpen(false)}
            >
              <div
                className="w-full max-w-sm bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-[#333] shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#222] px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shrink-0">
                      <Code2 size={14} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-sm font-semibold text-black dark:text-white">
                      Contact & Source
                    </h2>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-[#333] bg-gray-100/50 dark:bg-[#111]/50 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* body */}
                <div className="p-5 flex flex-col gap-3">

                  {/* Telegram */}
                  <a
                    href={TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-[#111] hover:border-gray-300 dark:hover:border-[#444] transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#229ED9]/10 dark:bg-[#229ED9]/15 border border-[#229ED9]/20 flex items-center justify-center shrink-0">
                      <Send size={16} className="text-[#229ED9]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-black dark:text-white">Telegram</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{TELEGRAM_USERNAME} · Admin contact</p>
                    </div>
                    <ExternalLink size={13} className="text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
                  </a>

                  {/* GitHub */}
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-[#111] hover:border-gray-300 dark:hover:border-[#444] transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] flex items-center justify-center shrink-0">
                      <Github size={16} className="text-gray-700 dark:text-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-black dark:text-white">GitHub</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">telecheck-webui · Public repo</p>
                    </div>
                    <ExternalLink size={13} className="text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors shrink-0" />
                  </a>

                </div>

                {/* footer */}
                <div className="px-5 pb-5">
                  <p className="text-[11px] text-center text-gray-400 dark:text-gray-600">
                    Open source · Built with ❤️ by{' '}
                    <a
                      href={TELEGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors font-medium"
                    >
                      saahiyo
                    </a>
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default GithubBtn;
