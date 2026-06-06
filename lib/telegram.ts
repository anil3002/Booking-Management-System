import { formatDateTime } from "@/lib/booking-utils";
import type { Booking } from "@/lib/types";

export type TelegramNotificationType =
  | "new_booking"
  | "checkout"
  | "modify_booking"
  | "cancel_booking";

export type TelegramReminderType = "48h" | "24h";

export type TelegramSendResult = {
  ok: boolean;
  messageId?: number;
  error?: string;
};

export async function sendTelegramMessage(
  text: string,
): Promise<TelegramSendResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    process.env.TELEGRAM_CHAT_ID ??
    process.env.TELEGRAM_ADMIN_CHAT_ID ??
    process.env.HOTEL_OWNER_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return {
      ok: false,
      error: "Telegram environment variables are missing.",
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        message_thread_id: process.env.TELEGRAM_MESSAGE_THREAD_ID
          ? Number(process.env.TELEGRAM_MESSAGE_THREAD_ID)
          : undefined,
      }),
    },
  );
  const result = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: { message_id?: number };
  };

  if (!response.ok || !result.ok) {
    return {
      ok: false,
      error: result.description ?? "Telegram notification failed.",
    };
  }

  return { ok: true, messageId: result.result?.message_id };
}

export function buildTelegramMessage(
  type: TelegramNotificationType,
  booking: Booking,
  amountReceived: number,
  previousBooking?: Booking,
) {
  if (type === "checkout") {
    const discountApplied = getCheckoutDiscount(booking, amountReceived);

    return [
      "Customer Checked Out",
      `Guest: ${booking.guest_name}`,
      `Rooms: ${formatRooms(booking)}`,
      `Check-in: ${formatDateTime(booking.check_in_datetime)}`,
      `Check-out: ${formatOptionalDateTime(booking.actual_checkout_datetime)}`,
      `Total payment: Rs ${booking.total_payment}`,
      `Advance taken: Rs ${booking.advance_taken}`,
      `Discount applied: Rs ${discountApplied}`,
      `Final payment received: Rs ${amountReceived}`,
    ].join("\n");
  }

  if (type === "modify_booking") {
    const originalBooking = previousBooking ?? booking;

    return [
      "Booking Edited",
      "",
      ...formatBookingDetails(originalBooking),
      "",
      "Updated Details:",
      ...formatUpdatedDetails(originalBooking, booking),
    ].join("\n");
  }

  if (type === "cancel_booking") {
    return ["Booking Canceled", "", ...formatBookingDetails(booking)].join("\n");
  }

  return [
    "Check-in / New Booking",
    ...formatBookingDetails(booking),
  ].join("\n");
}

export function buildTelegramReminderMessage(
  reminderType: TelegramReminderType,
  booking: Booking,
) {
  return [
    `Upcoming Check-in Reminder - ${reminderType === "48h" ? "48 Hours" : "24 Hours"}`,
    "",
    ...formatBookingDetails(booking),
  ].join("\n");
}

export function buildTelegramOccupancyWarningMessage(
  reminderType: TelegramReminderType,
  booking: Booking,
  conflictingBookings: Booking[],
) {
  return [
    `Room Occupancy Warning - ${reminderType === "48h" ? "48 Hours" : "24 Hours"}`,
    "",
    "Upcoming booking:",
    ...formatBookingDetails(booking),
    "",
    "Current occupied booking:",
    ...conflictingBookings.flatMap((conflicting, index) => [
      ...(index > 0 ? [""] : []),
      ...formatBookingDetails(conflicting),
    ]),
  ].join("\n");
}

function formatRooms(booking: Booking) {
  return booking.room_nos?.length ? booking.room_nos.join(", ") : booking.room_no;
}

function formatOptionalDateTime(value: string | null) {
  return value ? formatDateTime(value) : "-";
}

function getCheckoutDiscount(booking: Booking, amountReceived: number) {
  return Math.max(
    0,
    booking.total_payment -
      booking.advance_taken -
      amountReceived -
      booking.remaining_balance,
  );
}

function formatBookingDetails(booking: Booking) {
  return [
    `Guest: ${booking.guest_name}`,
    `Phone: ${booking.customer_phone_number || "-"}`,
    `Rooms: ${formatRooms(booking)}`,
    `Check-in: ${formatDateTime(booking.check_in_datetime)}`,
    `Persons: ${booking.number_of_persons}`,
    `Children: ${booking.number_of_children}`,
    `ID: ${booking.id_type} ${booking.id_number}`,
    `Advance: Rs ${booking.advance_taken}`,
    `Notes: ${booking.notes?.trim() || "-"}`,
  ];
}

function formatUpdatedDetails(previousBooking: Booking, booking: Booking) {
  const details = [
    getUpdatedDetail(
      "Guest",
      previousBooking.guest_name,
      booking.guest_name,
      booking.guest_name,
    ),
    getUpdatedDetail(
      "Phone",
      previousBooking.customer_phone_number,
      booking.customer_phone_number,
      booking.customer_phone_number || "-",
    ),
    getUpdatedDetail(
      "Rooms",
      formatRooms(previousBooking),
      formatRooms(booking),
      formatRooms(booking),
    ),
    getUpdatedDetail(
      "Check-in",
      previousBooking.check_in_datetime,
      booking.check_in_datetime,
      formatDateTime(booking.check_in_datetime),
    ),
    getUpdatedDetail(
      "Persons",
      previousBooking.number_of_persons,
      booking.number_of_persons,
      String(booking.number_of_persons),
    ),
    getUpdatedDetail(
      "Children",
      previousBooking.number_of_children,
      booking.number_of_children,
      String(booking.number_of_children),
    ),
    getUpdatedDetail(
      "ID",
      `${previousBooking.id_type} ${previousBooking.id_number}`,
      `${booking.id_type} ${booking.id_number}`,
      `${booking.id_type} ${booking.id_number}`,
    ),
    getUpdatedDetail(
      "Advance",
      previousBooking.advance_taken,
      booking.advance_taken,
      `Rs ${booking.advance_taken}`,
    ),
    getUpdatedDetail(
      "Notes",
      previousBooking.notes?.trim() ?? "",
      booking.notes?.trim() ?? "",
      booking.notes?.trim() || "-",
    ),
  ].filter((detail): detail is string => Boolean(detail));

  return details.length ? details : ["No details changed"];
}

function getUpdatedDetail(
  label: string,
  previousValue: string | number,
  nextValue: string | number,
  formattedNextValue: string,
) {
  return previousValue === nextValue ? null : `${label}: ${formattedNextValue}`;
}
