import BrandAlignmentPanel from "@/components/pages/brand-alignment-panel";
import BriefClient from "@/components/pages/brief-client";
import ContentExpansionPanel from "@/components/pages/content-expansion-panel";

export const dynamic = "force-dynamic";

export default function BriefPage() {
  return (
    <>
      <BriefClient />
      <ContentExpansionPanel />
      <BrandAlignmentPanel />
    </>
  );
}
