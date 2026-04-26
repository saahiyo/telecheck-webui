import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Saved Links | TeleCheck Pro',
  description: 'Manage and review your previously validated Telegram links stored locally on your device.',
};

export default function SavedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
