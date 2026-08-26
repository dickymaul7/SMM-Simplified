import RoleAwareOverview from "@/components/pages/role-aware-overview";
import TaskForcePanel from "@/components/task-force-panel";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return (
    <>
      <RoleAwareOverview />
      <TaskForcePanel />
    </>
  );
}
