import StaticHtmlPage from '@/app/StaticHtmlPage';
import html from '@/app/content/inspection.body.html';

export const metadata = {
  title: "Inspection & Production Monitoring — Module 07",
  description: "",
};

export default function Page() {
  return <StaticHtmlPage html={html} slug="inspection" />;
}
