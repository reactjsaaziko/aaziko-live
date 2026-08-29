import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/trade-agreements.body.html';

export const metadata = {
  title: "Aaziko Trade Agreements & Tariff — Module 06",
  description: "",
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="trade-agreements" />;
}
