import { Suspense } from "react";

import CalendarExpansionClient from "@/components/pages/calendar-expansion-client";
import TaskAssignmentPanel from "@/components/task-assignment-panel";
import CalendarAssignmentBadges from "@/components/calendar-assignment-badges";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarExpansionClient />
      <TaskAssignmentPanel />
      <CalendarAssignmentBadges />
    </Suspense>
  );
}
