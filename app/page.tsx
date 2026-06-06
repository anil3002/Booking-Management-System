import { ActionButton } from "@/components/action-button";
import {
  CheckInIcon,
  CheckOutIcon,
  ExpensesIcon,
  UpcomingBookingsIcon,
} from "@/components/action-icons";
import { PageShell } from "@/components/page-shell";

export default function Home() {
  return (
    <PageShell
      title="Staff Dashboard"
      description="Simple room booking, checkout, and room availability for 10 rooms."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          href="/upcoming"
          title="Upcoming Bookings"
          description="Review future bookings and remove reservations if needed."
          icon={<UpcomingBookingsIcon className="h-7 w-7" />}
        />
        <ActionButton
          href="/expenses"
          title="Expenses"
          description="Review password-protected completed-booking earnings."
          icon={<ExpensesIcon className="h-7 w-7" />}
        />
      </section>
    </PageShell>
  );
}
