import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crux.ai',
  description: 'Real-time AI voice mock interview coach powered by Groq',
  icons: {
    icon: '/crux-icon.svg',
    apple: '/crux-icon.svg',
    shortcut: '/crux-icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-white antialiased selection:bg-primary/30" suppressHydrationWarning>
        {children}
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
      </body>
    </html>
  );
}
