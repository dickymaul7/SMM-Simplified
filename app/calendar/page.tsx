import CalendarExpansionClient from "@/components/pages/calendar-expansion-client";
import TaskAssignmentPanel from "@/components/task-assignment-panel";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return <><CalendarExpansionClient /><div className="app-workspace mx-auto max-w-[1500px] px-4 pb-8 lg:px-6"><TaskAssignmentPanel /></div></>;
}
