import LogisticsLive from '@/app/components/logistic-cost/LogisticsLive';
import html from '@/app/content/logistics.body.html';
import '@/app/logistics.css';

export const metadata = {
  title: "Aaziko Logistics — Factory floor to buyer's door, in one number",
  description:
    "What does delivery cost? Aaziko answers it — factory floor to buyer's door, across sea, air, rail and road — in seconds. Try the Load Calculator and the live Landed-Cost Calculator on this page.",
};

export default function Page() {
  return <LogisticsLive html={html} />;
}
