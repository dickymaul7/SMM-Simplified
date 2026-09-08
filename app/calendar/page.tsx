import { Suspense } from "react";

import BufferInstagramPanel from "@/components/buffer-instagram-panel";
import CalendarAssignmentBadges from "@/components/calendar-assignment-badges";
import CalendarLegacyDesignLinkHider from "@/components/calendar-legacy-design-link-hider";
import CalendarExpansionClient from "@/components/pages/calendar-expansion-client";
import TaskAssignmentPanel from "@/components/task-assignment-panel";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarExpansionClient />
      <TaskAssignmentPanel />
      <CalendarAssignmentBadges />
      <BufferInstagramPanel />
      <CalendarLegacyDesignLinkHider />
    </Suspense>
  );
}
