import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/home.body.html';
import '@/app/home.css';

// The previous home page ("India has 7 crore MSMEs" — India dot-map redesign).
// Kept intact but HIDDEN: it is no longer the site's landing page (that is now the
// Aaziko Trade Execution System home at "/") and is not linked in any nav. Reachable
// only at /home-classic/ so nothing is removed — only hidden — per request.
export const metadata = {
  title: "India's Biggest Untapped Export Opportunity — Aaziko",
  description:
    "99.8% of Indian MSMEs do not export. India has built the policies, FTAs and schemes — Aaziko is the execution infrastructure that activates 7.83 crore MSMEs toward the $2 trillion export target.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="home" />;
}
