"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import {
  Field,
  CurrencyInput,
  PrimaryButton,
  TextArea,
  TextInput,
  SelectInput,
} from "@/components/form-controls";
import type { BookingFormInput } from "@/lib/types";
import {
  formatDateTime,
  getOpenEndedCheckoutDateTime,
  toStoredDateTime,
} from "@/lib/booking-utils";
import {
  createBookingsClient,
  getAvailableRoomsClient,
} from "@/lib/browser-bookings";
import { sendWhatsAppNotification } from "@/lib/notifications";

const initialForm: BookingFormInput = {
  room_no: "",
  guest_name: "",
  customer_phone_number: "",
  number_of_persons: 1,
  id_type: "Aadhaar",
  id_number: "",
  number_of_children: "",
  check_in_datetime: "",
  check_out_datetime: "",
  advance_taken: "",
  total_payment: "",
  notes: "",
};

export function CheckInForm() {
  const router = useRouter();
  const [form, setForm] = useState<BookingFormInput>(initialForm);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof BookingFormInput>(
    key: K,
    value: BookingFormInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function checkRooms() {
    setMessage(null);
    startTransition(async () => {
      try {
        if (!form.check_in_datetime) {
          throw new Error("Choose check-in date/time first.");
        }

        const rooms = await getAvailableRoomsClient(
          toStoredDateTime(form.check_in_datetime),
          getOpenEndedCheckoutDateTime(form.check_in_datetime),
        );
        setAvailableRooms(rooms);
        setSelectedRooms([]);
        update("room_no", "");
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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setShowConfirmation(true);
  }

  function confirmBooking() {
    setMessage(null);
    startTransition(async () => {
      try {
        const booking = await createBookingsClient(
          { ...form, total_payment: 0 },
          selectedRooms,
        );
        const notification = await sendWhatsAppNotification("new_booking", booking);
        setForm(initialForm);
        setAvailableRooms([]);
        setSelectedRooms([]);
        setShowConfirmation(false);
        if (!notification.ok) {
          console.warn("Booking saved, but WhatsApp notification failed.");
        }
        router.push("/");
      } catch (error) {
        setShowConfirmation(false);
        setMessage({ type: "error", text: getErrorMessage(error) });
      }
    });
  }

  function toggleRoom(roomNo: string) {
    setSelectedRooms((current) =>
      current.includes(roomNo)
        ? current.filter((room) => room !== roomNo)
        : [...current, roomNo],
    );
  }

  return (
    <>
    <form onSubmit={submit} className="grid gap-5 rounded-lg border border-teal-200/80 bg-teal-50/80 p-4 shadow-xl shadow-teal-900/10 backdrop-blur-md sm:p-6">
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
      </div>

      <button
        type="button"
        onClick={checkRooms}
        disabled={isPending}
        className="h-12 rounded-md border border-emerald-700 bg-white px-5 text-base font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
      >
        {isPending ? "Checking..." : "Check Available Rooms"}
      </button>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Select Rooms</h2>
          {selectedRooms.length ? (
            <span className="rounded-md bg-teal-100 px-2 py-1 text-xs font-bold text-teal-900">
              {selectedRooms.length} selected
            </span>
          ) : null}
        </div>
        {availableRooms.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {availableRooms.map((room) => {
              const selected = selectedRooms.includes(room);
              return (
                <button
                  type="button"
                  key={room}
                  onClick={() => toggleRoom(room)}
                  className={`h-14 rounded-md border px-3 text-base font-bold shadow-sm transition ${
                    selected
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-teal-200 bg-white text-teal-900 hover:bg-teal-50"
                  }`}
                  aria-pressed={selected}
                >
                  Room {room}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-600">
            Check available rooms first, then select one or more rooms.
          </div>
        )}
      </section>

      <div className="grid gap-4">
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
            required
            placeholder="1"
            value={form.number_of_persons}
            onChange={(event) =>
              update("number_of_persons", parseNumberInput(event.target.value))
            }
          />
        </Field>
        <Field label="Number of children">
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
        <Field label="Advance taken">
          <CurrencyInput
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="0"
            value={form.advance_taken}
            onChange={(event) =>
              update("advance_taken", parseNumberInput(event.target.value))
            }
          />
        </Field>
      </div>

      <Field label="Notes">
        <TextArea
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
        />
      </Field>

      <PrimaryButton type="submit" disabled={isPending || !selectedRooms.length}>
        {isPending
          ? "Saving..."
          : selectedRooms.length > 1
            ? `Save ${selectedRooms.length} Bookings`
            : "Save Booking"}
      </PrimaryButton>
    </form>

    {showConfirmation ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-lg border border-teal-200 bg-teal-50 p-5 shadow-2xl shadow-slate-950/30">
          <h2 className="text-xl font-bold text-slate-950">Confirm booking</h2>
          <div className="mt-4 grid gap-2 text-sm text-slate-700">
            <p>
              <span className="font-bold text-slate-950">Guest:</span>{" "}
              {form.guest_name}
            </p>
            <p>
              <span className="font-bold text-slate-950">Phone:</span>{" "}
              {form.customer_phone_number}
            </p>
            <p>
              <span className="font-bold text-slate-950">Rooms:</span>{" "}
              {selectedRooms.join(", ")}
            </p>
            <p>
              <span className="font-bold text-slate-950">Check-in:</span>{" "}
              {formatDateTime(form.check_in_datetime)}
            </p>
            <p>
              <span className="font-bold text-slate-950">Persons:</span>{" "}
              {form.number_of_persons || 0}
            </p>
            <p>
              <span className="font-bold text-slate-950">Children:</span>{" "}
              {form.number_of_children || 0}
            </p>
            <p>
              <span className="font-bold text-slate-950">ID:</span>{" "}
              {form.id_type} {form.id_number}
            </p>
            <p>
              <span className="font-bold text-slate-950">Advance:</span> Rs{" "}
              {form.advance_taken || 0}
            </p>
            {form.notes.trim() ? (
              <p>
                <span className="font-bold text-slate-950">Notes:</span>{" "}
                {form.notes}
              </p>
            ) : null}
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
              onClick={confirmBooking}
              disabled={isPending}
              className="h-11 rounded-md bg-teal-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isPending ? "Saving..." : "Confirm booking"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

function parseNumberInput(value: string) {
  return value === "" ? "" : Number(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
