import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WANDERWRAP_URL || 'http://127.0.0.1:3000'),
  title: { default: 'WanderWrap — remember the person, find the gift', template: '%s · WanderWrap' },
  description: 'A consent-first gifting companion that turns confirmed clues into thoughtful, explainable ideas across web and Alexa+.',
  openGraph: {
    title: 'WanderWrap — remember the person, find the gift',
    description: 'Thoughtful, explainable gift ideas across web and Alexa+.',
    type: 'website',
    siteName: 'WanderWrap'
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
