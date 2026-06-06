import { PageShell } from "@/components/page-shell";
import { ExpensesClient } from "@/app/expenses/expenses-client";

export default function ExpensesPage() {
  return (
    <PageShell
      title="Expenses"
      description="Password-protected earnings dashboard for completed bookings."
    >
      <ExpensesClient />
    </PageShell>
  );
}
