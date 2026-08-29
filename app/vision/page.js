import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/vision.body.html';

export const metadata = {
  title: "What If Every Indian Manufacturer Could Sell Globally? — Aaziko",
  description: "",
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="vision" />;
}
