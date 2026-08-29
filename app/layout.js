import './globals.css';
import './tailwind.css';
import AnalyticsTracker from '@/app/components/AnalyticsTracker';

export const metadata = {
  title: {
    default: 'Aaziko — From Make in India to Buy from India',
    template: '%s',
  },
  description:
    'India has built the policies, FTAs and schemes — Aaziko is the execution infrastructure that activates 7.83 crore MSMEs toward the $2 trillion export target.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Fonts are also @import-ed inside styles.css; these links guarantee they load. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Mukta:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <AnalyticsTracker />
      </body>
    </html>
  );
}
