import React from 'react';
import { FileText, Zap, Scale, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | TeleCheck Pro',
  description: 'The terms and conditions for using the TeleCheck Pro platform.',
};

export default function TermsOfService() {
  const sections = [
    {
      title: 'Acceptance of Terms',
      icon: <FileText className="text-blue-500" size={24} />,
      content: 'By accessing and using TeleCheck Pro, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.'
    },
    {
      title: 'Usage License',
      icon: <Zap className="text-amber-500" size={24} />,
      content: 'TeleCheck Pro provides a tool for validating Telegram links. You are granted a limited, non-exclusive, non-transferable license to use the service for personal or professional link validation purposes. Abuse of the API or platform (e.g., through automated scraping or DDoS) is strictly prohibited.'
    },
    {
      title: 'Disclaimer',
      icon: <AlertTriangle className="text-red-500" size={24} />,
      content: 'The service is provided "as is" without any warranties of any kind. While we strive for 100% accuracy, we cannot guarantee that link status or metadata will always be correct, as it depends on external Telegram servers.'
    },
    {
      title: 'Liability',
      icon: <Scale className="text-emerald-500" size={24} />,
      content: 'In no event shall TeleCheck Pro or its contributors be liable for any damages arising out of the use or inability to use the service, even if notified of the possibility of such damage.'
    }
  ];

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 animate-fade-in">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-black dark:text-white mb-4 tracking-tight">Terms of Service</h1>
        <p className="text-gray-500 dark:text-gray-400">Last updated: April 26, 2026</p>
      </div>

      <div className="space-y-12">
        {sections.map((section, idx) => (
          <section key={idx} className="flex gap-6">
            <div className="w-12 h-12 shrink-0 rounded-2xl bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#222] flex items-center justify-center">
              {section.icon}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-black dark:text-white mb-3">{section.title}</h2>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {section.content}
              </p>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          TeleCheck Pro is an open-source project. Check our license on GitHub for more details.
        </p>
      </div>
    </div>
  );
}
