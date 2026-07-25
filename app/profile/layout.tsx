import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile | TeleCheck Pro',
  description: 'View your account details, contributor stats, and validation history on TeleCheck Pro.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
