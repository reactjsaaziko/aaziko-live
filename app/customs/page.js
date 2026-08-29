import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/customs.body.html';
import '@/app/customs.css';

export const metadata = {
  title: 'Aaziko Custom 3.0 — Every customs rule, in plain English, before you ship',
  description:
    'Every requirement, every document, every rule — for your product, your route — sourced directly from official customs authorities, and written in plain English a maker in any village can act on.',
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="customs" />;
}
