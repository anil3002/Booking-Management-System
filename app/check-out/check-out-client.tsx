"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Alert } from "@/components/alert";
import { BookingCard } from "@/components/booking-card";
import {
  CurrencyInput,
  Field,
  PrimaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/form-controls";
import {
  calculateRemainingBalance,
  formatDateTime,
  formatRooms,
  getBookingRooms,
  getDateTimeLocalValue,
  getDateTimeMs,
  getOpenEndedCheckoutDateTime,
  roundMoney,
  toStoredDateTime,
} from "@/lib/booking-utils";
import {
  checkoutBookingClient,
  getAvailableRoomsClient,
  getActiveBookingsClient,
  updateBookingRoomsClient,
} from "@/lib/browser-bookings";
import { sendTelegramNotification } from "@/lib/notifications";
import { calculateRoomsTotal, calculateStayTotal } from "@/lib/rooms";
import type { Booking, BookingFormInput } from "@/lib/types";

type CheckOutClientProps = {
  bookings: Booking[];
};

export function CheckOutClient({ bookings }: CheckOutClientProps) {
  const [liveBookings, setLiveBookings] = useState(bookings);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState<BookingFormInput | null>(null);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [discountApplied, setDiscountApplied] = useState<number | "">(0);
  const [checkoutDateTime, setCheckoutDateTime] = useState("");
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
        setSelected(null);
        setDiscountApplied(0);
        setCheckoutDateTime("");
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

  const selectedRoomsTotal = useMemo(
    () => calculateRoomsTotal(selectedRooms),
    [selectedRooms],
  );

  const remainingBalance = form
    ? calculateRemainingBalance(selectedRoomsTotal, form.advance_taken)
    : 0;

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
      getDateTimeMs(checkoutDateTime) <=
      getDateTimeMs(selected.check_in_datetime)
    ) {
      throw new Error("Check-out date/time must be after check-in date/time.");
    }
  }

  function editBooking(booking: Booking) {
    const rooms = getBookingRooms(booking);
    setSelected(booking);
    setEditing(booking);
    setForm(toForm(booking));
    setSelectedRooms(rooms);
    setAvailableRooms(rooms);
    setDiscountApplied(0);
    setCheckoutDateTime(getDefaultCheckoutDateTime(booking));
    setShowConfirmation(false);
    setMessage(null);
    scrollActionPanelIntoViewOnMobile();
  }

  function startCheckout(booking: Booking) {
    setSelected(booking);
    setEditing(null);
    setForm(null);
    setAvailableRooms([]);
    setSelectedRooms([]);
    setMessage(null);
    setDiscountApplied(0);
    setCheckoutDateTime(getDefaultCheckoutDateTime(booking));
    scrollActionPanelIntoViewOnMobile();
  }

  function closeCheckoutForm() {
    setSelected(null);
    setDiscountApplied(0);
    setCheckoutDateTime("");
    setShowConfirmation(false);
    setMessage(null);
  }

  function closeEditForm() {
    setEditing(null);
    setForm(null);
    setAvailableRooms([]);
    setSelectedRooms([]);
    setMessage(null);
  }

  function update<K extends keyof BookingFormInput>(
    key: K,
    value: BookingFormInput[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function checkRooms() {
    if (!form || !editing) return;
    setMessage(null);
    startTransition(async () => {
      try {
        if (!form.check_in_datetime) {
          throw new Error("Choose check-in date/time first.");
        }

        const rooms = await getAvailableRoomsClient(
          toStoredDateTime(form.check_in_datetime),
          getOpenEndedCheckoutDateTime(form.check_in_datetime),
          editing.id,
        );
        const availableRoomNumbers: string[] = [...rooms];
        setAvailableRooms(availableRoomNumbers);
        setSelectedRooms((current) =>
          current.filter((room) => availableRoomNumbers.includes(room)),
        );
        setMessage({
          type: rooms.length ? "success" : "warning",
          text: rooms.length
            ? "Available rooms loaded."
            : "No rooms are available for this date/time range.",
        });
      } catch (error) {
        setAvailableRooms([]);
        setSelectedRooms([]);
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

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !editing) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const booking = await updateBookingRoomsClient(
          editing.id,
          {
            ...form,
            check_out_datetime: getOpenEndedCheckoutDateTime(
              form.check_in_datetime,
            ),
            total_payment: selectedRoomsTotal,
          },
          selectedRooms,
        );
        const notification = await sendTelegramNotification(
          "modify_booking",
          booking,
          undefined,
          editing,
        );
        const currentBookings = await loadCurrentBookings();
        setLiveBookings(currentBookings);
        setSelected(null);
        setEditing(null);
        setForm(null);
        setAvailableRooms([]);
        setSelectedRooms([]);
        setDiscountApplied(0);
        setCheckoutDateTime("");
        setMessage({
          type: notification.ok ? "success" : "warning",
          text: notification.ok
            ? "Booking updated successfully."
            : "Booking updated, but Telegram notification failed.",
        });
      } catch (error) {
        setMessage({ type: "error", text: getErrorMessage(error) });
      }
    });
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
        const notification = await sendTelegramNotification(
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
            : "Customer checked out, but Telegram notification failed.",
        });
        setSelected(null);
        setDiscountApplied(0);
        setCheckoutDateTime("");
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
        {message && !editing ? <Alert type={message.type} message={message.text} /> : null}
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
                onEdit={editBooking}
                onCheckout={startCheckout}
              />
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
              No active bookings found.
            </p>
          )}
        </div>
      </div>

      <aside
        data-checkout-action-panel
        className="h-fit rounded-lg border border-amber-200/80 bg-amber-50/80 p-4 shadow-xl shadow-amber-900/10 backdrop-blur-md lg:sticky lg:top-4 lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto"
      >
        {editing && form ? (
          <form onSubmit={saveEdit} className="grid gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Edit Booking
                </h2>
                <p className="text-sm text-slate-600">
                  {formatRooms(editing)} - {editing.guest_name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditForm}
                className="rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
              >
                Close form
              </button>
            </div>

            {message ? <Alert type={message.type} message={message.text} /> : null}

            <Field label="Check-in date/time">
              <TextInput
                type="datetime-local"
                required
                value={form.check_in_datetime}
                onChange={(event) =>
                  update("check_in_datetime", event.target.value)
                }
              />
            </Field>

            <button
              type="button"
              onClick={checkRooms}
              disabled={isPending}
              className="h-11 rounded-md border border-emerald-700 bg-white px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
            >
              {isPending ? "Checking..." : "Check Available Rooms"}
            </button>

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-800">
                  Select Rooms
                </h3>
                {selectedRooms.length ? (
                  <span className="rounded-md bg-teal-100 px-2 py-1 text-xs font-bold text-teal-900">
                    {selectedRooms.length} selected
                  </span>
                ) : null}
              </div>
              {availableRooms.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-3">
                  {availableRooms.map((room) => {
                    const isSelected = selectedRooms.includes(room);
                    return (
                      <button
                        type="button"
                        key={room}
                        onClick={() => toggleRoom(room)}
                        className={`h-12 rounded-md border px-3 text-sm font-bold shadow-sm transition ${
                          isSelected
                            ? "border-teal-700 bg-teal-700 text-white"
                            : "border-teal-200 bg-white text-teal-900 hover:bg-teal-50"
                        }`}
                        aria-pressed={isSelected}
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
              <Field label="Total payment">
                <ReadOnlyAmount value={selectedRoomsTotal} />
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
              <Field label="Remaining balance">
                <ReadOnlyAmount value={remainingBalance} />
              </Field>
            </div>

            <Field label="Notes">
              <TextArea
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
              />
            </Field>

            <PrimaryButton
              type="submit"
              disabled={isPending || !selectedRooms.length}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </PrimaryButton>
          </form>
        ) : selected ? (
          <div className="grid gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {selected.guest_name}
                </h2>
                <p className="text-sm text-slate-600">
                  {selected.room_nos && selected.room_nos.length > 1 ? "Rooms" : "Room"}{" "}
                  {formatRooms(selected)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCheckoutForm}
                className="rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
              >
                Close
              </button>
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
          <p className="text-sm text-slate-600">
            Select Checkout on a booking card to record final payment.
          </p>
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
    (booking) => getDateTimeMs(booking.check_in_datetime) <= now,
  );
}

function getDefaultCheckoutDateTime(booking: Booking | null) {
  if (!booking) return "";

  const checkoutMs = getDateTimeMs(booking.check_in_datetime) + 24 * 60 * 60 * 1000;
  return getDateTimeLocalValue(new Date(checkoutMs).toISOString());
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
    check_out_datetime: getOpenEndedCheckoutDateTime(booking.check_in_datetime),
    advance_taken: emptyIfZero(booking.advance_taken),
    total_payment: booking.total_payment,
    notes: booking.notes ?? "",
  };
}

function parseNumberInput(value: string) {
  return value === "" ? "" : Number(value);
}

function emptyIfZero(value: number) {
  return value === 0 ? "" : value;
}

async function loadCurrentBookings() {
  const bookings = await getActiveBookingsClient();
  return getCurrentBookings(bookings);
}

function scrollActionPanelIntoViewOnMobile() {
  if (
    typeof window === "undefined" ||
    window.matchMedia("(min-width: 1024px)").matches
  ) {
    return;
  }

  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>("[data-checkout-action-panel]")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function ReadOnlyAmount({ value }: { value: number }) {
  return (
    <span className="block py-2 text-base font-semibold text-slate-950">
      Rs {value}
    </span>
  );
}
