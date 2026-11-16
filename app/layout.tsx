import type { Metadata, Viewport } from 'next';
import { Chakra_Petch, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0F17',
};

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Velocity' },
  formatDetection: { telephone: false },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  title: 'Project Velocity — Cross-Platform Low-Spec Arena FPS',
  description:
    'Cross-platform multiplayer arena FPS with authoritative WebSocket game state, slide-hop movement, and adaptive WebGL rendering.',
  openGraph: {
    title: 'Project Velocity — Cross-Platform Low-Spec Arena FPS',
    description:
      'Cross-platform multiplayer arena FPS with authoritative WebSocket game state, slide-hop movement, and adaptive WebGL rendering.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Project Velocity — Cross-Platform Low-Spec Arena FPS',
    description:
      'Cross-platform multiplayer arena FPS with authoritative WebSocket game state, slide-hop movement, and adaptive WebGL rendering.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${chakraPetch.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body data-state="title" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
