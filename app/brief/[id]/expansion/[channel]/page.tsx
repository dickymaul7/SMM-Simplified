import ContentExpansionEditor from "@/components/pages/content-expansion-editor";
import ContentExpansionSchedulePanel from "@/components/pages/content-expansion-schedule-panel";

export const dynamic = "force-dynamic";

export default function ContentExpansionPage() {
  return (
    <>
      <ContentExpansionEditor />
      <ContentExpansionSchedulePanel />
    </>
  );
}
