import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/partnership.body.html';

export const metadata = {
  title: "Government Engagement — Aaziko",
  description: "",
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="partnership" />;
}
