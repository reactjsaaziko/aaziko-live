import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/finance.body.html';

export const metadata = {
  title: "Export Finance — Module 08",
  description: "",
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="finance" />;
}
