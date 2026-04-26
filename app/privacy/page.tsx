import React from 'react';
import { Shield, EyeOff, Server, Lock } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | TeleCheck Pro',
  description: 'How we handle your data and ensure your privacy while using TeleCheck Pro.',
};

export default function PrivacyPolicy() {
  const sections = [
    {
      title: 'Data Collection',
      icon: <EyeOff className="text-blue-500" size={24} />,
      content: 'We do not collect or store the Telegram links you validate on our servers. All validation processes are performed in real-time. Any temporary storage used during the session (like your "Saved Links") is stored locally on your device using IndexedDB and is never transmitted to us.'
    },
    {
      title: 'Processing',
      icon: <Server className="text-emerald-500" size={24} />,
      content: 'Links are processed through our secure API which checks the status and metadata of the Telegram URL. We do not log the specific content of these requests. We may collect anonymous, aggregated usage statistics (e.g., total number of links checked) to improve our service performance.'
    },
    {
      title: 'Cookies & Analytics',
      icon: <Shield className="text-purple-500" size={24} />,
      content: 'We use Vercel Analytics to understand how users interact with our site. This data is anonymous and helps us improve the user interface and performance. We do not use tracking cookies for advertising purposes.'
    },
    {
      title: 'Security',
      icon: <Lock className="text-red-500" size={24} />,
      content: 'We implement industry-standard security measures to protect the integrity of our platform. Since we do not store personal data, there is no risk of your validation history being exposed through our systems.'
    }
  ];

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 animate-fade-in">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-black dark:text-white mb-4 tracking-tight">Privacy Policy</h1>
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

      <div className="mt-20 p-8 rounded-3xl bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#222] text-center">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-2">Questions?</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          If you have any questions about our privacy practices, feel free to reach out on GitHub.
        </p>
        <a 
          href="https://github.com/saahiyo/telecheck-webui" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}
