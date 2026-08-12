import BrandAlignmentPanel from "@/components/pages/brand-alignment-panel";
import BriefClient from "@/components/pages/brief-client";

export const dynamic = "force-dynamic";

export default function BriefPage() {
  return (
    <>
      <BriefClient />
      <BrandAlignmentPanel />
    </>
  );
}
