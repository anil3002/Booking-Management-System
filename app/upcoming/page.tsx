import { PageShell } from "@/components/page-shell";
import { UpcomingBookingsClient } from "@/app/upcoming/upcoming-bookings-client";

export default function UpcomingBookingsPage() {
  return (
    <PageShell
      title="Upcoming Bookings"
      description="View future bookings and remove reservations that are no longer needed."
    >
      <UpcomingBookingsClient bookings={[]} />
    </PageShell>
  );
}
