import OverviewClient from "@/components/pages/overview-client";
import TaskForcePanel from "@/components/task-force-panel";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return <><OverviewClient /><TaskForcePanel /></>;
}
