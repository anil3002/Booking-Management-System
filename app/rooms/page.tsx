import { PageShell } from "@/components/page-shell";
import { RoomsClient } from "@/app/rooms/rooms-client";

export default function RoomsPage() {
  return (
    <PageShell
      title="Room Status"
      description="Current availability and active guest details for all 10 rooms."
    >
      <RoomsClient />
    </PageShell>
  );
}
