import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contributors | TeleCheck Pro',
  description: 'Meet the community contributors and see the top link validators of TeleCheck Pro.',
};

export default function ContributorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
