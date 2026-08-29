import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/product-analysis.body.html';

export const metadata = {
  title: "Aaziko Product Analysis — Module 02",
  description: "",
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="product-analysis" />;
}
