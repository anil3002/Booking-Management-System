import type { Booking, BookingFormInput } from "@/lib/types";

export function calculateRemainingBalance(
  totalPayment: number | "",
  advanceTaken: number | "",
) {
  return roundMoney(toNumber(totalPayment) - toNumber(advanceTaken));
}

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function toNumber(value: number | "") {
  return value === "" ? 0 : Number(value);
}

export function toStoredDateTime(value: string) {
  return new Date(value).toISOString();
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function isActiveStatus(status: Booking["status"]) {
  return status !== "checked_out" && status !== "cancelled";
}

export function getBookingDisplayStatus(booking: Booking) {
  if (booking.status === "cancelled") return "Cancelled";
  if (booking.status === "checked_out") return "Checked Out";

  return new Date(booking.check_in_datetime).getTime() <= Date.now()
    ? "Checked In"
    : "Booked";
}

export function getRoomDisplayStatus(booking: Booking) {
  return new Date(booking.check_in_datetime).getTime() <= Date.now()
    ? ("Checked-in" as const)
    : ("Booked" as const);
}

export function overlaps(
  existingCheckIn: string,
  existingCheckOut: string,
  newCheckIn: string,
  newCheckOut: string,
) {
  // Conflict rule: existing_check_in < new_check_out AND existing_check_out > new_check_in.
  return (
    new Date(existingCheckIn).getTime() < new Date(newCheckOut).getTime() &&
    new Date(existingCheckOut).getTime() > new Date(newCheckIn).getTime()
  );
}

export function validateBookingInput(input: BookingFormInput) {
  const numberOfPersons = toNumber(input.number_of_persons);
  const numberOfChildren = toNumber(input.number_of_children);
  const advanceTaken = toNumber(input.advance_taken);
  const totalPayment = toNumber(input.total_payment);

  if (!input.guest_name.trim()) return "Guest name is required.";
  if (!input.customer_phone_number.trim()) return "Customer phone number is required.";
  if (!input.room_no) return "Room number is required.";
  if (!input.id_type) return "ID type is required.";
  if (!input.id_number.trim()) return "Aadhaar/PAN number is required.";
  if (numberOfPersons < 1) return "Number of persons must be at least 1.";
  if (numberOfChildren < 0) return "Number of children cannot be negative.";
  if (advanceTaken < 0 || totalPayment < 0) {
    return "Payment amounts cannot be negative.";
  }
  if (!input.check_in_datetime || !input.check_out_datetime) {
    return "Check-in and check-out date/time are required.";
  }
  if (
    new Date(input.check_out_datetime).getTime() <=
    new Date(input.check_in_datetime).getTime()
  ) {
    return "Check-out date/time must be after check-in date/time.";
  }

  return null;
}

export function getDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function getBookingRooms(booking: Pick<Booking, "room_no" | "room_nos">) {
  const rooms = booking.room_nos?.length ? booking.room_nos : [booking.room_no];
  return rooms.filter(Boolean);
}

export function formatRooms(booking: Pick<Booking, "room_no" | "room_nos">) {
  return getBookingRooms(booking).join(", ");
}
