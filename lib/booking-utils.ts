import type { Booking, BookingFormInput } from "@/lib/types";

const INDIA_TIME_ZONE = "Asia/Kolkata";
const INDIA_OFFSET_MINUTES = 330;
const DATE_TIME_PARTS =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?/;
const EXPLICIT_TIME_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

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
  return toIndiaLocalDateTime(value);
}

export function getOpenEndedCheckoutDateTime(checkInDateTime: string) {
  const parts = getIndiaDateTimeParts(checkInDateTime);
  return toStoredDateTime(
    `${parts.year + 10}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
  );
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: INDIA_TIME_ZONE,
  }).format(new Date(getDateTimeMs(value)));
}

export function formatCheckoutDateTime(
  booking: Pick<
    Booking,
    "actual_checkout_datetime" | "check_in_datetime" | "check_out_datetime" | "status"
  >,
) {
  if (booking.actual_checkout_datetime) {
    return formatDateTime(booking.actual_checkout_datetime);
  }

  if (
    isActiveStatus(booking.status) &&
    isOpenEndedCheckoutDateTime(
      booking.check_in_datetime,
      booking.check_out_datetime,
    )
  ) {
    return "Open";
  }

  return formatDateTime(booking.check_out_datetime);
}

export function isOpenEndedCheckoutDateTime(
  checkInDateTime: string,
  checkOutDateTime?: string | null,
) {
  if (!checkOutDateTime) return false;

  const checkIn = getIndiaDateTimeParts(checkInDateTime);
  const threshold = toStoredDateTime(
    `${checkIn.year + 9}-${pad(checkIn.month)}-${pad(checkIn.day)}T${pad(checkIn.hour)}:${pad(checkIn.minute)}:${pad(checkIn.second)}`,
  );

  return getDateTimeMs(checkOutDateTime) >= getDateTimeMs(threshold);
}

export function isActiveStatus(status: Booking["status"]) {
  return status !== "checked_out" && status !== "cancelled";
}

export function getBookingDisplayStatus(booking: Booking) {
  if (booking.status === "cancelled") return "Cancelled";
  if (booking.status === "checked_out") return "Checked Out";

  return getDateTimeMs(booking.check_in_datetime) <= Date.now()
    ? "Checked In"
    : "Booked";
}

export function getRoomDisplayStatus(booking: Booking) {
  return getDateTimeMs(booking.check_in_datetime) <= Date.now()
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
    getDateTimeMs(existingCheckIn) < getDateTimeMs(newCheckOut) &&
    getDateTimeMs(existingCheckOut) > getDateTimeMs(newCheckIn)
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
  if (!Number.isInteger(advanceTaken)) {
    return "Advance taken must be a whole number.";
  }
  if (!input.check_in_datetime) {
    return "Check-in date/time is required.";
  }
  if (!input.check_out_datetime) {
    return "Check-out date/time is required.";
  }
  if (
    getDateTimeMs(input.check_out_datetime) <=
    getDateTimeMs(input.check_in_datetime)
  ) {
    return "Check-out date/time must be after check-in date/time.";
  }

  return null;
}

export function getDateTimeLocalValue(value: string) {
  return toIndiaLocalDateTime(value).slice(0, 16);
}

export function getCurrentDateTimeLocalValue() {
  return getDateTimeLocalValue(new Date().toISOString());
}

export function getDateTimeMs(value: string) {
  if (EXPLICIT_TIME_ZONE.test(value)) {
    return new Date(value).getTime();
  }

  const parts = parseDateTimeParts(value);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    ) -
    INDIA_OFFSET_MINUTES * 60_000
  );
}

export function getIndiaDayKey(value: string) {
  return toIndiaLocalDateTime(value).slice(0, 10);
}

export function getIndiaDayStart(value: string) {
  const parts = getIndiaDateTimeParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T00:00:00`;
}

export function getIndiaDayEnd(value: string) {
  const parts = getIndiaDateTimeParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T23:59:59`;
}

export function getBookingRooms(booking: Pick<Booking, "room_no" | "room_nos">) {
  const rooms = booking.room_nos?.length ? booking.room_nos : [booking.room_no];
  return rooms.filter(Boolean);
}

export function formatRooms(booking: Pick<Booking, "room_no" | "room_nos">) {
  return getBookingRooms(booking).join(", ");
}

function toIndiaLocalDateTime(value: string) {
  const parts = getIndiaDateTimeParts(value);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function getIndiaDateTimeParts(value: string) {
  if (EXPLICIT_TIME_ZONE.test(value)) {
    return getIndiaPartsFromInstant(new Date(value));
  }

  return parseDateTimeParts(value);
}

function parseDateTimeParts(value: string) {
  const match = DATE_TIME_PARTS.exec(value);
  if (!match) {
    throw new Error("Invalid date/time value.");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? "0").padEnd(3, "0")),
  };
}

function getIndiaPartsFromInstant(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour,
    minute: value.minute,
    second: value.second,
    millisecond: 0,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
