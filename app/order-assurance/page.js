import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/order-assurance.body.html';
import '@/app/order-assurance.css';

export const metadata = {
  title: 'Aaziko 100% Assurance — Order from any Indian maker, without a second thought',
  description:
    'A buyer can order from any Indian manufacturer — a first-time exporter, a village workshop, anyone — without a second thought. Every order is guaranteed: quality, quantity and packing, exactly as agreed.',
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="order-assurance" />;
}
