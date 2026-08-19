import { Suspense } from "react";

import CalendarExpansionClient from "@/components/pages/calendar-expansion-client";
import TaskAssignmentPanel from "@/components/task-assignment-panel";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarExpansionClient />
      <TaskAssignmentPanel />
    </Suspense>
  );
}
