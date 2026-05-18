import { PageShell } from "@/components/page-shell";
import { ModifyClient } from "@/app/modify/modify-client";

export default function ModifyPage() {
  return (
    <PageShell
      title="Modify Booking"
      description="Search upcoming or active bookings and update guest, room, date, or payment details."
    >
      <ModifyClient bookings={[]} />
    </PageShell>
  );
}
