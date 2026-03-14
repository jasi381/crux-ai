import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InterviewCoach AI',
  description: 'Real-time AI voice mock interview coach powered by Gemini',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-white antialiased selection:bg-primary/30" suppressHydrationWarning>{children}</body>
    </html>
  );
}
