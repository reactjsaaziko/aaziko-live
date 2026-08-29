import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/home-final.body.html';
import '@/app/home-final.css';

export const metadata = {
  title: "Aaziko Trade Execution System — UPI made payments easy. This makes global trade easy.",
  description:
    "7.83 crore Indian MSMEs. 99.8% never sold abroad. ATES opens 20%+ of Indian makers to the world — the maker only makes, the buyer only buys, ATES does everything in between.",
  alternates: { canonical: 'https://aaziko.com/live/' },
  openGraph: {
    title: 'Aaziko Trade Execution System',
    description: 'UPI made payments easy. This makes global trade easy.',
    type: 'website',
  },
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="home-final" />;
}
