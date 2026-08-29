import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/marketplace.body.html';
import '@/app/marketplace.css';

export const metadata = {
  title: "Aaziko Marketplace — Global trade, the Gen Z way",
  description:
    "Buy from any Indian maker as easily, openly and safely as ordering online. One page: sourcing, customs, trade agreements, logistics, finance, inspection, insurance and assurance — Aaziko executes the whole trade.",
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="marketplace" />;
}
