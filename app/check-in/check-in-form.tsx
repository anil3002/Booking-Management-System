"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert } from "@/components/alert";
import {
  Field,
  PrimaryButton,
  TextArea,
  TextInput,
  SelectInput,
} from "@/components/form-controls";
import type { BookingFormInput } from "@/lib/types";
import { calculateRemainingBalance } from "@/lib/booking-utils";
import {
  createBookingsClient,
  getAvailableRoomsClient,
} from "@/lib/browser-bookings";
import { sendWhatsAppNotification } from "@/lib/notifications";

const initialForm: BookingFormInput = {
  room_no: "",
  guest_name: "",
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
  const [form, setForm] = useState<BookingFormInput>(initialForm);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info" | "warning"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const remainingBalance = useMemo(
    () => calculateRemainingBalance(form.total_payment, form.advance_taken),
    [form.total_payment, form.advance_taken],
  );

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
    startTransition(async () => {
      try {
        const booking = await createBookingsClient(form, selectedRooms);
        const notification = await sendWhatsAppNotification("new_booking", booking);
        setForm(initialForm);
        setAvailableRooms([]);
        setSelectedRooms([]);
        setMessage({
          type: notification.ok ? "success" : "warning",
          text: notification.ok
            ? selectedRooms.length === 1
              ? "Booking saved successfully."
              : `Booking saved successfully for ${selectedRooms.length} rooms.`
            : "Booking saved, but WhatsApp notification failed.",
        });
      } catch (error) {
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

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Guest Name">
          <TextInput
            required
            value={form.guest_name}
            onChange={(event) => update("guest_name", event.target.value)}
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

      <PrimaryButton type="submit" disabled={isPending || !selectedRooms.length}>
        {isPending
          ? "Saving..."
          : selectedRooms.length > 1
            ? `Save ${selectedRooms.length} Bookings`
            : "Save Booking"}
      </PrimaryButton>
    </form>
  );
}

function parseNumberInput(value: string) {
  return value === "" ? "" : Number(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
