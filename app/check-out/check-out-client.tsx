"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { BookingCard } from "@/components/booking-card";
import { Field, PrimaryButton, TextInput } from "@/components/form-controls";
import { formatDateTime } from "@/lib/booking-utils";
import { formatRooms } from "@/lib/booking-utils";
import {
  checkoutBookingClient,
  getActiveBookingsClient,
} from "@/lib/browser-bookings";
import { sendWhatsAppNotification } from "@/lib/notifications";
import type { Booking } from "@/lib/types";

type CheckOutClientProps = {
  bookings: Booking[];
};

export function CheckOutClient({ bookings }: CheckOutClientProps) {
  const [liveBookings, setLiveBookings] = useState(bookings);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Booking | null>(bookings[0] ?? null);
  const [amountReceived, setAmountReceived] = useState<number | "">("");
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    getActiveBookingsClient()
      .then((items) => {
        if (!isMounted) return;
        setLiveBookings(items);
        setSelected(items[0] ?? null);
        setAmountReceived(emptyIfZero(Math.max(0, items[0]?.remaining_balance ?? 0)));
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
    const needle = query.trim().toLowerCase();
    if (!needle) return liveBookings;
    return liveBookings.filter((booking) =>
      [
        booking.guest_name,
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

  function checkout() {
    if (!selected) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const receivedAmount = amountReceived === "" ? 0 : amountReceived;
        const booking = await checkoutBookingClient(
          selected.id,
          selected,
          receivedAmount,
        );
        const notification = await sendWhatsAppNotification(
          "checkout",
          booking,
          receivedAmount,
        );
        const items = await getActiveBookingsClient();
        setLiveBookings(items);
        setMessage({
          type: notification.ok ? "success" : "warning",
          text: notification.ok
            ? "Customer checked out successfully."
            : "Customer checked out, but WhatsApp notification failed.",
        });
        setSelected(null);
        setAmountReceived("");
      } catch (error) {
        setMessage({ type: "error", text: getErrorMessage(error) });
      }
    });
  }

  return (
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
                  setAmountReceived(emptyIfZero(Math.max(0, booking.remaining_balance)));
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
              <p>Expected checkout: {formatDateTime(selected.check_out_datetime)}</p>
              <p>Total payment: Rs {selected.total_payment}</p>
              <p>Advance taken: Rs {selected.advance_taken}</p>
              <p>Remaining balance: Rs {selected.remaining_balance}</p>
            </div>
            <Field label="Final payment received">
              <TextInput
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={amountReceived}
                onChange={(event) =>
                  setAmountReceived(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
              />
            </Field>
            <PrimaryButton type="button" disabled={isPending} onClick={checkout}>
              {isPending ? "Checking out..." : "Check Out"}
            </PrimaryButton>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Select a booking to check out.</p>
        )}
      </aside>
    </section>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function emptyIfZero(value: number) {
  return value === 0 ? "" : value;
}
