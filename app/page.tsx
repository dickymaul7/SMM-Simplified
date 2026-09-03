import StudioClient from "@/components/pages/studio-client";
import StoryAngleCountControl from "@/components/story-angle-count-control";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <>
      <StudioClient />
      <StoryAngleCountControl />
    </>
  );
}
