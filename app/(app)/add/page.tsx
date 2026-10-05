import type { Metadata } from "next";
import { AdvertPanel } from "./advert-panel";
import { AlertPanel } from "./alert-panel";

export const metadata: Metadata = { title: "Add jobs · Job Search Tracker" };
// Reading an advert with Claude can take up to a minute.
export const maxDuration = 120;

export default function AddJobsPage() {
  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-2">
      <AdvertPanel />
      <AlertPanel />
    </div>
  );
}
