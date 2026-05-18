import { ActionButton } from "@/components/action-button";
import {
  CheckInIcon,
  CheckOutIcon,
  ModifyBookingIcon,
} from "@/components/action-icons";
import { DashboardDetails } from "@/app/dashboard-details";
import { PageShell } from "@/components/page-shell";

export default function Home() {
  return (
    <PageShell
      title="Staff Dashboard"
      description="Simple room booking, checkout, and room availability for 10 rooms."
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <ActionButton
          href="/check-in"
          title="Check-in / New Booking"
          description="Create a booking and assign an available room."
          icon={<CheckInIcon className="h-7 w-7" />}
        />
        <ActionButton
          href="/check-out"
          title="Check-out"
          description="Close an active stay and record final payment."
          icon={<CheckOutIcon className="h-7 w-7" />}
        />
        <ActionButton
          href="/modify"
          title="Modify Booking"
          description="Search and update guest, date, room, or payment details."
          icon={<ModifyBookingIcon className="h-7 w-7" />}
        />
      </section>

      <DashboardDetails />
    </PageShell>
  );
}
