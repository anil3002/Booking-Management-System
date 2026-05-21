"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { BookingCard } from "@/components/booking-card";
import {
  CurrencyInput,
  Field,
  PrimaryButton,
  TextInput,
} from "@/components/form-controls";
import {
  formatDateTime,
  formatRooms,
  getDateTimeLocalValue,
  roundMoney,
} from "@/lib/booking-utils";
import {
  checkoutBookingClient,
  getActiveBookingsClient,
} from "@/lib/browser-bookings";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { calculateStayTotal } from "@/lib/rooms";
import type { Booking } from "@/lib/types";

type CheckOutClientProps = {
  bookings: Booking[];
};

export function CheckOutClient({ bookings }: CheckOutClientProps) {
  const [liveBookings, setLiveBookings] = useState(bookings);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Booking | null>(bookings[0] ?? null);
  const [discountApplied, setDiscountApplied] = useState<number | "">(0);
  const [checkoutDateTime, setCheckoutDateTime] = useState(getCurrentDateTimeLocal);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    getActiveBookingsClient()
      .then((items) => {
        if (!isMounted) return;
        const currentBookings = getCurrentBookings(items);
        setLiveBookings(currentBookings);
        setSelected(currentBookings[0] ?? null);
        setDiscountApplied(0);
        setCheckoutDateTime(getCurrentDateTimeLocal());
      })
      .catch((error) => {
        if (!isMounted) return;
        setMessage({ type: "error", text: getErrorMessage(error) });
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const currentBookings = getCurrentBookings(liveBookings);
    const needle = query.trim().toLowerCase();
    if (!needle) return currentBookings;
    return currentBookings.filter((booking) =>
      [
        booking.guest_name,
        booking.customer_phone_number,
        formatRooms(booking),
        booking.id_number,
        booking.check_in_datetime,
        booking.check_out_datetime,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [liveBookings, query]);

  const finalPaymentReceived = useMemo(() => {
    if (!selected) return 0;

    return calculateFinalPayment(selected, checkoutDateTime, discountApplied);
  }, [selected, checkoutDateTime, discountApplied]);

  const calculatedTotalPayment = useMemo(() => {
    if (!selected || !checkoutDateTime) return 0;

    return calculateStayTotal(
      selected.room_nos?.length ? selected.room_nos : [selected.room_no],
      selected.check_in_datetime,
      checkoutDateTime,
    );
  }, [selected, checkoutDateTime]);

  function validateCheckout() {
    if (!selected) return;
    setMessage(null);
    const discount = discountApplied === "" ? 0 : discountApplied;
    if (discount < 0) {
      throw new Error("Discount applied cannot be negative.");
    }
    if (!Number.isInteger(discount)) {
      throw new Error("Discount applied must be a whole number.");
    }
    if (selected && discount > calculatedTotalPayment - selected.advance_taken) {
      throw new Error("Discount applied cannot be more than the remaining balance.");
    }
    if (!checkoutDateTime) {
      throw new Error("Check-out date/time is required.");
    }
    if (
      new Date(checkoutDateTime).getTime() <=
      new Date(selected.check_in_datetime).getTime()
    ) {
      throw new Error("Check-out date/time must be after check-in date/time.");
    }
  }

  function openConfirmation() {
    try {
      validateCheckout();
      setShowConfirmation(true);
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    }
  }

  function confirmCheckout() {
    if (!selected) return;
    setMessage(null);
    startTransition(async () => {
      try {
        validateCheckout();
        const discount = discountApplied === "" ? 0 : discountApplied;

        const booking = await checkoutBookingClient(
          selected.id,
          selected,
          finalPaymentReceived,
          checkoutDateTime,
          discount,
          calculatedTotalPayment,
        );
        const notification = await sendWhatsAppNotification(
          "checkout",
          booking,
          finalPaymentReceived,
        );
        const items = await getActiveBookingsClient();
        const currentBookings = getCurrentBookings(items);
        setLiveBookings(currentBookings);
        setMessage({
          type: notification.ok ? "success" : "warning",
          text: notification.ok
            ? "Customer checked out successfully."
            : "Customer checked out, but WhatsApp notification failed.",
        });
        setSelected(null);
        setDiscountApplied(0);
        setCheckoutDateTime(getCurrentDateTimeLocal());
        setShowConfirmation(false);
      } catch (error) {
        setShowConfirmation(false);
        setMessage({ type: "error", text: getErrorMessage(error) });
      }
    });
  }

  return (
    <>
    <section className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="grid content-start gap-4">
        {message ? <Alert type={message.type} message={message.text} /> : null}
        {isLoading ? <Alert type="info" message="Loading bookings..." /> : null}
        <Field label="Search active bookings">
          <TextInput
            placeholder="Guest, room, ID, or date"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <div className="grid gap-3">
          {filtered.length ? (
            filtered.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                selected={selected?.id === booking.id}
                onSelect={(booking) => {
                  setSelected(booking);
                  setDiscountApplied(0);
                  setCheckoutDateTime(getCurrentDateTimeLocal());
                }}
              />
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
              No active bookings found.
            </p>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-lg border border-amber-200/80 bg-amber-50/80 p-4 shadow-xl shadow-amber-900/10 backdrop-blur-md">
        {selected ? (
          <div className="grid gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                {selected.guest_name}
              </h2>
              <p className="text-sm text-slate-600">
                {selected.room_nos && selected.room_nos.length > 1 ? "Rooms" : "Room"}{" "}
                {formatRooms(selected)}
              </p>
            </div>
            <div className="grid gap-2 text-sm text-slate-700">
              <p>Check-in: {formatDateTime(selected.check_in_datetime)}</p>
              <p>Phone: {selected.customer_phone_number || "-"}</p>
            </div>
            <Field label="Check-out date/time">
              <TextInput
                type="datetime-local"
                required
                min={getDateTimeLocalValue(selected.check_in_datetime)}
                value={checkoutDateTime}
                onChange={(event) => setCheckoutDateTime(event.target.value)}
              />
            </Field>
            <Field label="Total payment">
              <ReadOnlyAmount value={calculatedTotalPayment} />
            </Field>
            <Field label="Advance taken">
              <ReadOnlyAmount value={selected.advance_taken} />
            </Field>
            <Field label="Discount applied">
              <CurrencyInput
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="0"
                value={discountApplied}
                onChange={(event) =>
                  setDiscountApplied(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
              />
            </Field>
            <Field label="Final payment received">
              <ReadOnlyAmount value={finalPaymentReceived} />
            </Field>
            <PrimaryButton type="button" disabled={isPending} onClick={openConfirmation}>
              {isPending ? "Checking out..." : "Check Out"}
            </PrimaryButton>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Select a booking to check out.</p>
        )}
      </aside>
    </section>

    {showConfirmation && selected ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-2xl shadow-slate-950/30">
          <h2 className="text-xl font-bold text-slate-950">Confirm check-out</h2>
          <div className="mt-4 grid gap-2 text-sm text-slate-700">
            <p>
              <span className="font-bold text-slate-950">Guest:</span>{" "}
              {selected.guest_name}
            </p>
            <p>
              <span className="font-bold text-slate-950">Rooms:</span>{" "}
              {formatRooms(selected)}
            </p>
            <p>
              <span className="font-bold text-slate-950">Check-in:</span>{" "}
              {formatDateTime(selected.check_in_datetime)}
            </p>
            <p>
              <span className="font-bold text-slate-950">Check-out:</span>{" "}
              {formatDateTime(checkoutDateTime)}
            </p>
            <p>
              <span className="font-bold text-slate-950">Total payment:</span>{" "}
              Rs {calculatedTotalPayment}
            </p>
            <p>
              <span className="font-bold text-slate-950">Advance taken:</span>{" "}
              Rs {selected.advance_taken}
            </p>
            <p>
              <span className="font-bold text-slate-950">Discount applied:</span>{" "}
              Rs {discountApplied || 0}
            </p>
            <p>
              <span className="font-bold text-slate-950">Final payment received:</span>{" "}
              Rs {finalPaymentReceived}
            </p>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowConfirmation(false)}
              disabled={isPending}
              className="h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmCheckout}
              disabled={isPending}
              className="h-11 rounded-md bg-amber-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isPending ? "Checking out..." : "Confirm check-out"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function getCurrentDateTimeLocal() {
  return getDateTimeLocalValue(new Date().toISOString());
}

function calculateFinalPayment(
  booking: Pick<Booking, "advance_taken" | "check_in_datetime" | "room_no" | "room_nos">,
  checkoutDateTime: string,
  discountApplied: number | "",
) {
  const discount = discountApplied === "" ? 0 : discountApplied;
  const totalPayment = checkoutDateTime
    ? calculateStayTotal(
        booking.room_nos?.length ? booking.room_nos : [booking.room_no],
        booking.check_in_datetime,
        checkoutDateTime,
      )
    : 0;

  return roundMoney(Math.max(0, totalPayment - booking.advance_taken - discount));
}

function getCurrentBookings(bookings: Booking[]) {
  const now = Date.now();
  return bookings.filter(
    (booking) => new Date(booking.check_in_datetime).getTime() <= now,
  );
}

function ReadOnlyAmount({ value }: { value: number }) {
  return (
    <span className="block py-2 text-base font-semibold text-slate-950">
      Rs {value}
    </span>
  );
}
