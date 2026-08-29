import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/port-brain.body.html';
import '@/app/port-brain.css';

export const metadata = {
  title: "Aaziko Port Brain — The world's demand, read for India",
  description:
    "Port Brain reads 6 crore+ real import–export trade records to find the exact buyers who should be buying from India — what they buy, what they pay, whom to contact and why India wins.",
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="port-brain" />;
}
