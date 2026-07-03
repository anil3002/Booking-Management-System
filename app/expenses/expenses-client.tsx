"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Card, CardContent, CardHeader } from "@/components/card";
import { Field, TextInput } from "@/components/form-controls";
import { getAllBookingsClient } from "@/lib/browser-bookings";
import {
  formatDateTime,
  formatRooms,
  getBookingRooms,
  getCurrentDateTimeLocalValue,
  getDateTimeMs,
  getIndiaDayEnd,
  getIndiaDayStart,
  roundMoney,
} from "@/lib/booking-utils";
import {
  calculateBillableStayPeriods,
  ROOM_RATES,
  ROOMS,
  type RoomNo,
} from "@/lib/rooms";
import type { Booking } from "@/lib/types";

const EXPENSES_PASSWORD = "KanVenk@15106";

type Message = {
  type: "info" | "success" | "warning" | "error";
  text: string;
};

type ExpenseRow = {
  id: string;
  title: string;
  amount: string;
};

type ProfitResult = {
  income: number;
  expenses: number;
  net: number;
  from: string;
  to: string;
};

export function ExpensesClient() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [range, setRange] = useState(() => getDefaultDateRange());
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calculatorRange, setCalculatorRange] = useState(() =>
    getDefaultDateRange(),
  );
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(() => [
    createExpenseRow(),
  ]);
  const [profitResult, setProfitResult] = useState<ProfitResult | null>(null);

  const analytics = useMemo(
    () => calculateEarnings(bookings, range.from, range.to),
    [bookings, range.from, range.to],
  );

  function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password === EXPENSES_PASSWORD) {
      setIsUnlocked(true);
      setPassword("");
      setMessage(null);
      loadBookings();
      return;
    }

    setMessage({ type: "error", text: "Incorrect password." });
  }

  async function loadBookings() {
    setIsLoading(true);
    setMessage(null);

    try {
      setBookings(await getAllBookingsClient());
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  }

  function openProfitCalculator() {
    setCalculatorRange(range);
    setExpenseRows([createExpenseRow()]);
    setProfitResult(null);
    setIsCalculatorOpen(true);
  }

  function closeProfitCalculator() {
    setIsCalculatorOpen(false);
    setProfitResult(null);
  }

  function updateExpenseRow(
    id: string,
    field: "title" | "amount",
    value: string,
  ) {
    setExpenseRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function addExpenseRow() {
    setExpenseRows((current) => [...current, createExpenseRow()]);
  }

  function removeExpenseRow(id: string) {
    setExpenseRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
  }

  function submitProfitCalculator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const income = calculateEarnings(
      bookings,
      calculatorRange.from,
      calculatorRange.to,
    ).totalIncome;
    const expenses = sum(expenseRows.map((row) => toMoney(row.amount)));

    setProfitResult({
      income,
      expenses,
      net: roundMoney(income - expenses),
      from: calculatorRange.from,
      to: calculatorRange.to,
    });
  }

  if (!isUnlocked) {
    return (
      <section className="mx-auto w-full max-w-md">
        {message ? <Alert type={message.type} message={message.text} /> : null}
        <Card className="mt-4 bg-white/92">
          <CardHeader>
            <h2 className="text-lg font-bold text-slate-950">Enter password</h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={unlock}>
              <Field label="Password">
                <TextInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              <Button type="submit" fullWidth>
                Open dashboard
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      {message ? <Alert type={message.type} message={message.text} /> : null}

      <Card className="bg-white/92">
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
            <Field label="From">
              <TextInput
                type="date"
                value={range.from}
                onChange={(event) =>
                  setRange((current) => ({ ...current, from: event.target.value }))
                }
              />
            </Field>
            <Field label="To">
              <TextInput
                type="date"
                value={range.to}
                onChange={(event) =>
                  setRange((current) => ({ ...current, to: event.target.value }))
                }
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRange(getDefaultDateRange())}
            >
              This month
            </Button>
            <Button type="button" onClick={openProfitCalculator}>
              Profit Calculator
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Alert type="info" message="Loading earnings data..." />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard
          label="Total Income"
          value={formatCurrency(analytics.totalIncome)}
          detail={[
            ["Advances taken", analytics.advancesTaken],
            ["Discounts given", analytics.discountsGiven],
            ["Final payments taken", analytics.finalPaymentsTaken],
          ]}
          highlight
        />
        <MetricCard
          label="Completed Bookings"
          value={analytics.completedBookings.length}
          note="Checked out in the selected date range"
        />
        <MetricCard
          label="Net Collected"
          value={formatCurrency(analytics.netCollected)}
          note="Advances plus final payments"
        />
      </div>

      <Card className="bg-white/92">
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Completed bookings
              </h2>
              <p className="text-sm text-slate-600">
                Filtered by actual checkout date.
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {analytics.completedBookings.length} records
            </p>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {analytics.completedBookings.length ? (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Guest</th>
                  <th className="py-3 pr-4">Rooms</th>
                  <th className="py-3 pr-4">Checkout</th>
                  <th className="py-3 pr-4 text-right">Total</th>
                  <th className="py-3 pr-4 text-right">Advance</th>
                  <th className="py-3 pr-4 text-right">Discount</th>
                  <th className="py-3 pr-4 text-right">Final</th>
                  <th className="py-3 text-right">Income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {analytics.completedBookings.map((item) => (
                  <tr key={item.booking.id}>
                    <td className="py-3 pr-4 font-semibold text-slate-950">
                      {item.booking.guest_name}
                    </td>
                    <td className="py-3 pr-4">{formatRooms(item.booking)}</td>
                    <td className="py-3 pr-4">
                      {formatDateTime(item.booking.actual_checkout_datetime)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatCurrency(item.advance)}
                    </td>
                    <td className="py-3 pr-4 text-right text-red-700">
                      {formatCurrency(item.discount)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {formatCurrency(item.finalPayment)}
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-700">
                      {formatCurrency(item.income)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-600">
              No checked-out bookings found for this date range.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/92">
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Room-wise income
              </h2>
              <p className="text-sm text-slate-600">
                Based on each room&apos;s overlap with the selected date range.
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {analytics.roomBreakdown.filter((item) => item.days > 0).length} rooms
            </p>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {analytics.roomBreakdown.some((item) => item.days > 0) ? (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pr-4">Room</th>
                  <th className="py-3 pr-4 text-right">Bookings</th>
                  <th className="py-3 pr-4 text-right">Days</th>
                  <th className="py-3 pr-4 text-right">Rate</th>
                  <th className="py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {analytics.roomBreakdown
                  .filter((item) => item.days > 0)
                  .map((item) => (
                    <tr key={item.room}>
                      <td className="py-3 pr-4 font-semibold text-slate-950">
                        Room {item.room} x {item.days}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {item.bookingCount}
                      </td>
                      <td className="py-3 pr-4 text-right">{item.days}</td>
                      <td className="py-3 pr-4 text-right">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="py-3 text-right font-bold text-emerald-700">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-600">
              No room usage found for this date range.
            </p>
          )}
          <p className="mt-4 text-xs font-semibold text-slate-500">
            Note: this room-wise amount does not subtract discounts.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500">
        Older checked-out bookings created before final payment tracking may show
        inferred final payment and zero discount because historical discounts were
        not stored separately.
      </p>

      {isCalculatorOpen ? (
        <ProfitCalculatorModal
          range={calculatorRange}
          expenseRows={expenseRows}
          result={profitResult}
          onClose={closeProfitCalculator}
          onRangeChange={setCalculatorRange}
          onExpenseChange={updateExpenseRow}
          onAddExpense={addExpenseRow}
          onRemoveExpense={removeExpenseRow}
          onSubmit={submitProfitCalculator}
        />
      ) : null}
    </section>
  );
}

function ProfitCalculatorModal({
  range,
  expenseRows,
  result,
  onClose,
  onRangeChange,
  onExpenseChange,
  onAddExpense,
  onRemoveExpense,
  onSubmit,
}: {
  range: { from: string; to: string };
  expenseRows: ExpenseRow[];
  result: ProfitResult | null;
  onClose: () => void;
  onRangeChange: (range: { from: string; to: string }) => void;
  onExpenseChange: (
    id: string,
    field: "title" | "amount",
    value: string,
  ) => void;
  onAddExpense: () => void;
  onRemoveExpense: (id: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">
              Profit Calculator
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Temporary calculation only. Nothing is saved.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {result ? (
          <ProfitResultView result={result} onClose={onClose} />
        ) : (
          <form className="space-y-5 p-5" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From">
                <TextInput
                  type="date"
                  value={range.from}
                  onChange={(event) =>
                    onRangeChange({ ...range, from: event.target.value })
                  }
                  required
                />
              </Field>
              <Field label="To">
                <TextInput
                  type="date"
                  value={range.to}
                  onChange={(event) =>
                    onRangeChange({ ...range, to: event.target.value })
                  }
                  required
                />
              </Field>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-base font-bold text-slate-950">Expenses</h3>
                <Button type="button" variant="secondary" onClick={onAddExpense}>
                  Add expense
                </Button>
              </div>

              {expenseRows.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
                >
                  <Field label={`Title ${index + 1}`}>
                    <TextInput
                      value={row.title}
                      onChange={(event) =>
                        onExpenseChange(row.id, "title", event.target.value)
                      }
                      placeholder="Electricity, salary, maintenance"
                    />
                  </Field>
                  <Field label="Amount spent">
                    <TextInput
                      type="number"
                      min="0"
                      step="1"
                      value={row.amount}
                      onChange={(event) =>
                        onExpenseChange(row.id, "amount", event.target.value)
                      }
                      placeholder="0"
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={expenseRows.length === 1}
                    onClick={() => onRemoveExpense(row.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Submit</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ProfitResultView({
  result,
  onClose,
}: {
  result: ProfitResult;
  onClose: () => void;
}) {
  const isProfit = result.net >= 0;

  return (
    <div className="space-y-5 p-5">
      <div
        className={
          isProfit
            ? "rounded-lg border border-emerald-200 bg-emerald-50 p-5"
            : "rounded-lg border border-red-200 bg-red-50 p-5"
        }
      >
        <p className="text-sm font-semibold text-slate-700">
          {result.from} to {result.to}
        </p>
        <h3
          className={
            isProfit
              ? "mt-2 text-3xl font-extrabold text-emerald-800"
              : "mt-2 text-3xl font-extrabold text-red-800"
          }
        >
          {isProfit ? "Profit made" : "Loss made"}
        </h3>
        <p
          className={
            isProfit
              ? "mt-2 text-5xl font-extrabold text-emerald-800"
              : "mt-2 text-5xl font-extrabold text-red-800"
          }
        >
          {formatCurrency(Math.abs(result.net))}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <ResultStat label="Total income" value={result.income} />
        <ResultStat label="Total expenses" value={result.expenses} />
        <ResultStat label="Net" value={result.net} />
      </dl>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-2 text-2xl font-extrabold text-slate-950">
        {formatCurrency(value)}
      </dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  note,
  highlight,
}: {
  label: string;
  value: string | number;
  detail?: Array<[string, number]>;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-lg border border-emerald-200 bg-emerald-50/95 p-5 shadow-xl shadow-emerald-900/10"
          : "rounded-lg border border-orange-200 bg-orange-50/95 p-5 shadow-xl shadow-orange-900/10"
      }
    >
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p
        className={
          highlight
            ? "mt-2 text-4xl font-extrabold text-emerald-800"
            : "mt-2 text-4xl font-extrabold text-rose-700"
        }
      >
        {value}
      </p>
      {detail ? (
        <dl className="mt-4 space-y-2 text-sm">
          {detail.map(([detailLabel, detailValue]) => (
            <div key={detailLabel} className="flex justify-between gap-4">
              <dt className="text-slate-600">{detailLabel}</dt>
              <dd className="font-bold text-slate-900">
                {formatCurrency(detailValue)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <p className="mt-4 text-sm text-slate-600">{note}</p> : null}
    </div>
  );
}

function calculateEarnings(bookings: Booking[], from: string, to: string) {
  if (!from || !to) {
    return getEmptyEarnings();
  }

  const fromMs = getDateTimeMs(getIndiaDayStart(from));
  const toMs = getDateTimeMs(getIndiaDayEnd(to));

  if (toMs < fromMs) {
    return getEmptyEarnings();
  }

  const completedBookings = bookings
    .filter((booking) => {
      if (booking.status !== "checked_out" || !booking.actual_checkout_datetime) {
        return false;
      }

      const checkoutMs = getDateTimeMs(booking.actual_checkout_datetime);
      return checkoutMs >= fromMs && checkoutMs <= toMs;
    })
    .sort(
      (a, b) =>
        getDateTimeMs(b.actual_checkout_datetime ?? b.check_out_datetime) -
        getDateTimeMs(a.actual_checkout_datetime ?? a.check_out_datetime),
    )
    .map((booking) => {
      const total = toMoney(booking.total_payment);
      const advance = toMoney(booking.advance_taken);
      const discount = toMoney(booking.discount_applied ?? 0);
      const finalPayment = getFinalPayment(booking, advance, discount);
      const income = roundMoney(total - discount);

      return { booking, total, advance, discount, finalPayment, income };
    });

  const advancesTaken = sum(completedBookings.map((item) => item.advance));
  const discountsGiven = sum(completedBookings.map((item) => item.discount));
  const finalPaymentsTaken = sum(
    completedBookings.map((item) => item.finalPayment),
  );
  const totalIncome = sum(completedBookings.map((item) => item.income));
  const roomBreakdown = calculateRoomBreakdown(bookings, fromMs, toMs);

  return {
    completedBookings,
    advancesTaken,
    discountsGiven,
    finalPaymentsTaken,
    netCollected: roundMoney(advancesTaken + finalPaymentsTaken),
    totalIncome,
    roomBreakdown,
  };
}

function getEmptyEarnings() {
  return {
    completedBookings: [],
    advancesTaken: 0,
    discountsGiven: 0,
    finalPaymentsTaken: 0,
    netCollected: 0,
    totalIncome: 0,
    roomBreakdown: ROOMS.map((room) => ({
      room,
      rate: ROOM_RATES[room],
      days: 0,
      bookingCount: 0,
      amount: 0,
    })),
  };
}

function calculateRoomBreakdown(
  bookings: Booking[],
  rangeStartMs: number,
  rangeEndMs: number,
) {
  const roomTotals = new Map(
    ROOMS.map((room) => [
      room,
      {
        room,
        rate: ROOM_RATES[room],
        days: 0,
        bookingCount: 0,
        amount: 0,
      },
    ]),
  );

  for (const booking of bookings) {
    if (booking.status === "cancelled") continue;

    const overlapStartMs = Math.max(
      getDateTimeMs(booking.check_in_datetime),
      rangeStartMs,
    );
    const overlapEndMs = Math.min(
      getDateTimeMs(
        booking.actual_checkout_datetime ?? booking.check_out_datetime,
      ),
      rangeEndMs,
    );

    if (overlapEndMs <= overlapStartMs) continue;

    const overlapStart = new Date(overlapStartMs).toISOString();
    const overlapEnd = new Date(overlapEndMs).toISOString();
    const days = calculateBillableStayPeriods(overlapStart, overlapEnd);
    if (!days) continue;

    for (const room of getBookingRooms(booking)) {
      const roomNo = room as RoomNo;
      const current = roomTotals.get(roomNo);
      if (!current) continue;

      current.days += days;
      current.bookingCount += 1;
      current.amount = roundMoney(current.amount + ROOM_RATES[roomNo] * days);
    }
  }

  return [...roomTotals.values()].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.room.localeCompare(b.room);
  });
}

function getFinalPayment(
  booking: Booking,
  advance: number,
  discount: number,
) {
  const storedFinalPayment = toMoney(booking.final_payment_received ?? 0);
  if (storedFinalPayment > 0 || discount > 0) {
    return storedFinalPayment;
  }

  return roundMoney(
    Math.max(
      0,
      toMoney(booking.total_payment) - advance - toMoney(booking.remaining_balance),
    ),
  );
}

function getDefaultDateRange() {
  const today = getCurrentDateTimeLocalValue().slice(0, 10);
  return {
    from: `${today.slice(0, 8)}01`,
    to: today,
  };
}

function createExpenseRow(): ExpenseRow {
  return {
    id: crypto.randomUUID(),
    title: "",
    amount: "",
  };
}

function sum(values: number[]) {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

function toMoney(value: number | string | null | undefined) {
  return roundMoney(Number(value ?? 0));
}

function formatCurrency(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load earnings data.";
}
