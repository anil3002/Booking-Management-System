import { PageShell } from "@/components/page-shell";
import { CheckOutClient } from "@/app/check-out/check-out-client";

export default function CheckOutPage() {
  return (
    <PageShell
      title="Check-out"
      description="Search active bookings, record final payment, and make the room available."
    >
      <CheckOutClient bookings={[]} />
    </PageShell>
  );
}
