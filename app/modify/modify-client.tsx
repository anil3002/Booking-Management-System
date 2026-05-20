"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import { BookingCard } from "@/components/booking-card";
import {
  Field,
  PrimaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/form-controls";
import {
  calculateRemainingBalance,
  formatRooms,
  getDateTimeLocalValue,
} from "@/lib/booking-utils";
import {
  cancelBookingClient,
  getAvailableRoomsClient,
  getEditableBookingsClient,
  updateBookingClient,
} from "@/lib/browser-bookings";
import { sendWhatsAppNotification } from "@/lib/notifications";
import type { Booking, BookingFormInput } from "@/lib/types";

type ModifyClientProps = {
  bookings: Booking[];
};

export function ModifyClient({ bookings }: ModifyClientProps) {
  const [liveBookings, setLiveBookings] = useState(bookings);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [form, setForm] = useState<BookingFormInput | null>(null);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [bookingToRemove, setBookingToRemove] = useState<Booking | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    getEditableBookingsClient()
      .then((items) => {
        if (isMounted) setLiveBookings(items);
      })
      .catch((error) => {
        if (isMounted) setMessage({ type: "error", text: getErrorMessage(error) });
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

  const remainingBalance = form
    ? calculateRemainingBalance(form.total_payment, form.advance_taken)
    : 0;

  function chooseBooking(booking: Booking) {
    if (removedIds.has(booking.id) || booking.status === "cancelled") return;

    if (selected?.id === booking.id) {
      closeForm();
      return;
    }

    setSelected(booking);
    setForm(toForm(booking));
    setAvailableRooms([booking.room_no]);
    setMessage(null);
  }

  function removeBooking(booking: Booking) {
    setBookingToRemove(booking);
  }

  function confirmRemoveBooking() {
    if (!bookingToRemove) return;

    const booking = bookingToRemove;
    setBookingToRemove(null);
    setRemovedIds((current) => new Set(current).add(booking.id));
    if (selected?.id === booking.id) {
      closeForm();
    }
    setMessage(null);

    startTransition(async () => {
      try {
        await cancelBookingClient(booking.id);
        setLiveBookings((current) =>
          current.map((item) =>
            item.id === booking.id ? { ...item, status: "cancelled" } : item,
          ),
        );
        setMessage({
          type: "success",
          text: "Booking removed successfully.",
        });
      } catch (error) {
        setRemovedIds((current) => {
          const next = new Set(current);
          next.delete(booking.id);
          return next;
        });
        setMessage({ type: "error", text: getErrorMessage(error) });
      }
    });
  }

  function closeForm() {
    setSelected(null);
    setForm(null);
    setAvailableRooms([]);
    setMessage(null);
  }

  function update<K extends keyof BookingFormInput>(
    key: K,
    value: BookingFormInput[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function checkRooms() {
    if (!form || !selected) return;
    setMessage(null);
    startTransition(async () => {
      try {
        if (!form.check_in_datetime || !form.check_out_datetime) {
          throw new Error("Choose check-in and check-out date/time first.");
        }
        if (
          new Date(form.check_out_datetime).getTime() <=
          new Date(form.check_in_datetime).getTime()
        ) {
          throw new Error("Check-out date/time must be after check-in date/time.");
        }

        const rooms = await getAvailableRoomsClient(
          new Date(form.check_in_datetime).toISOString(),
          new Date(form.check_out_datetime).toISOString(),
          selected.id,
        );
        setAvailableRooms(rooms);
        if (!rooms.some((room) => room === form.room_no)) {
          update("room_no", "");
        }
        setMessage({
          type: rooms.length ? "success" : "info",
          text: rooms.length
            ? "Available rooms loaded."
            : "No rooms are available for this date/time range.",
        });
      } catch (error) {
        setAvailableRooms([]);
        setMessage({ type: "error", text: getErrorMessage(error) });
      }
    });
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !selected) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const booking = await updateBookingClient(selected.id, form);
        const notification = await sendWhatsAppNotification(
          "modify_booking",
          booking,
        );
        const items = await getEditableBookingsClient();
        setLiveBookings(items);
        setSelected(booking);
        setForm(toForm(booking));
        setAvailableRooms([booking.room_no]);
        setMessage({
          type: notification.ok ? "success" : "warning",
          text: notification.ok
            ? "Booking updated successfully."
            : "Booking updated, but WhatsApp notification failed.",
        });
      } catch (error) {
        setMessage({ type: "error", text: getErrorMessage(error) });
      }
    });
  }

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[1fr_520px]">
        <div className="grid content-start gap-4">
          {message && !selected ? <Alert type={message.type} message={message.text} /> : null}
          {isLoading ? <Alert type="info" message="Loading bookings..." /> : null}
          <Field label="Search bookings">
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
                  onSelect={chooseBooking}
                  onRemove={
                    removedIds.has(booking.id) || booking.status === "cancelled"
                      ? undefined
                      : removeBooking
                  }
                  isDisabled={
                    removedIds.has(booking.id) || booking.status === "cancelled"
                  }
                />
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                No bookings found.
              </p>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-fuchsia-200/80 bg-fuchsia-50/80 p-4 shadow-xl shadow-fuchsia-900/10 backdrop-blur-md">
        {form && selected ? (
          <form onSubmit={save} className="grid gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Edit Booking
                </h2>
                <p className="text-sm text-slate-600">
                  {selected.room_nos && selected.room_nos.length > 1 ? "Rooms" : "Room"}{" "}
                  {formatRooms(selected)} - {selected.guest_name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-fuchsia-200 bg-white/70 px-3 py-2 text-sm font-semibold text-fuchsia-900 shadow-sm hover:bg-fuchsia-100"
              >
                Close form
              </button>
            </div>
            {message ? <Alert type={message.type} message={message.text} /> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Check-in date/time">
                <TextInput
                  type="datetime-local"
                  required
                  value={form.check_in_datetime}
                  onChange={(event) => update("check_in_datetime", event.target.value)}
                />
              </Field>
              <Field label="Check-out date/time">
                <TextInput
                  type="datetime-local"
                  required
                  value={form.check_out_datetime}
                  onChange={(event) => update("check_out_datetime", event.target.value)}
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={checkRooms}
              disabled={isPending}
              className="h-11 rounded-md border border-emerald-700 bg-white px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
            >
              {isPending ? "Checking..." : "Check Available Rooms"}
            </button>

            <Field label="Room No">
              <SelectInput
                required
                value={form.room_no}
                disabled={!availableRooms.length}
                onChange={(event) => update("room_no", event.target.value)}
              >
                <option value="">
                  {availableRooms.length ? "Select room" : "Check available rooms first"}
                </option>
                {availableRooms.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Guest Name">
                <TextInput
                  required
                  value={form.guest_name}
                  onChange={(event) => update("guest_name", event.target.value)}
                />
              </Field>
              <Field label="Customer phone number">
                <TextInput
                  type="tel"
                  required
                  value={form.customer_phone_number}
                  onChange={(event) =>
                    update("customer_phone_number", event.target.value)
                  }
                />
              </Field>
              <Field label="Number of persons">
                <TextInput
                  type="number"
                  min={1}
                  placeholder="1"
                  value={form.number_of_persons}
                  onChange={(event) =>
                    update("number_of_persons", parseNumberInput(event.target.value))
                  }
                />
              </Field>
              <Field label="Aadhaar / PAN">
                <SelectInput
                  value={form.id_type}
                  onChange={(event) => update("id_type", event.target.value)}
                >
                  <option value="Aadhaar">Aadhaar</option>
                  <option value="PAN">PAN</option>
                </SelectInput>
              </Field>
              <Field label="ID Number">
                <TextInput
                  required
                  value={form.id_number}
                  onChange={(event) => update("id_number", event.target.value)}
                />
              </Field>
              <Field label="Children">
                <TextInput
                  type="number"
                  min={0}
                  placeholder="0"
                  value={form.number_of_children}
                  onChange={(event) =>
                    update("number_of_children", parseNumberInput(event.target.value))
                  }
                />
              </Field>
              <Field label="Advance taken">
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={form.advance_taken}
                  onChange={(event) =>
                    update("advance_taken", parseNumberInput(event.target.value))
                  }
                />
              </Field>
              <Field label="Total payment">
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={form.total_payment}
                  onChange={(event) =>
                    update("total_payment", parseNumberInput(event.target.value))
                  }
                />
              </Field>
              <Field label="Remaining balance">
                <TextInput value={`Rs ${remainingBalance}`} readOnly />
              </Field>
            </div>

            <Field label="Notes">
              <TextArea
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </Field>

            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </PrimaryButton>
          </form>
        ) : (
          <div className="rounded-md border border-dashed border-fuchsia-300 bg-white/50 p-4 text-sm text-slate-700">
            Select a booking card to open the modify form. Click the same card
            again to close it.
          </div>
        )}
        </aside>
      </section>

      {bookingToRemove ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-5 shadow-2xl shadow-slate-950/30">
            <h2 className="text-xl font-bold text-slate-950">Remove booking?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              This will cancel the booking for{" "}
              <span className="font-bold">{bookingToRemove.guest_name}</span> in
              {bookingToRemove.room_nos && bookingToRemove.room_nos.length > 1
                ? " rooms "
                : " room "}
              <span className="font-bold">{formatRooms(bookingToRemove)}</span>.
              The room will become available and this booking will no longer show
              in active booking screens.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBookingToRemove(null)}
                className="h-11 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-100"
              >
                Keep booking
              </button>
              <button
                type="button"
                onClick={confirmRemoveBooking}
                className="h-11 rounded-md bg-red-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-red-800"
              >
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function toForm(booking: Booking): BookingFormInput {
  return {
    room_no: booking.room_no,
    guest_name: booking.guest_name,
    customer_phone_number: booking.customer_phone_number ?? "",
    number_of_persons: booking.number_of_persons,
    id_type: booking.id_type,
    id_number: booking.id_number,
    number_of_children: emptyIfZero(booking.number_of_children),
    check_in_datetime: getDateTimeLocalValue(booking.check_in_datetime),
    check_out_datetime: getDateTimeLocalValue(booking.check_out_datetime),
    advance_taken: emptyIfZero(booking.advance_taken),
    total_payment: emptyIfZero(booking.total_payment),
    notes: booking.notes ?? "",
  };
}

function parseNumberInput(value: string) {
  return value === "" ? "" : Number(value);
}

function emptyIfZero(value: number) {
  return value === 0 ? "" : value;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
