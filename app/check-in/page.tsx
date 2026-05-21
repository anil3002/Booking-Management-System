import { PageShell } from "@/components/page-shell";
import { CheckInForm } from "@/app/check-in/check-in-form";

export default function CheckInPage() {
  return (
    <PageShell
      title="Check-in / New Booking"
      description="Choose the check-in date/time, check availability, then save the guest details."
    >
      <CheckInForm />
    </PageShell>
  );
}
