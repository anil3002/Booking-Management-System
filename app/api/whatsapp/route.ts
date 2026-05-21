import twilio from "twilio";
import { formatDateTime } from "@/lib/booking-utils";
import type { Booking } from "@/lib/types";

type WhatsAppNotificationType =
  | "new_booking"
  | "checkout"
  | "modify_booking"
  | "cancel_booking";

type WhatsAppRequestBody = {
  type?: WhatsAppNotificationType;
  booking?: Booking;
  amountReceived?: number;
  previousBooking?: Booking;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { type, booking, amountReceived, previousBooking } =
      (await request.json()) as WhatsAppRequestBody;

    if (!type || !booking) {
      return Response.json(
        { ok: false, error: "Notification type and booking are required." },
        { status: 400 },
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = getWhatsAppNumber(
      process.env.TWILIO_WHATSAPP_FROM ??
        process.env.TWILIO_FROM_WHATSAPP_NUMBER,
    );
    const to = getWhatsAppNumber(
      process.env.TWILIO_WHATSAPP_TO ??
        process.env.TWILIO_TO_WHATSAPP_NUMBER ??
        process.env.OWNER_WHATSAPP_TO ??
        process.env.HOTEL_OWNER_WHATSAPP,
    );

    // These Twilio values come from server-only environment variables in .env.local.
    // Do not prefix them with NEXT_PUBLIC_ or they will be exposed to the browser.
    if (!accountSid || !authToken || !from || !to) {
      return Response.json(
        { ok: false, error: "Twilio WhatsApp environment variables are missing." },
        { status: 500 },
      );
    }

    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      from,
      to,
      body: buildWhatsAppMessage(
        type,
        booking,
        amountReceived ?? 0,
        previousBooking,
      ),
    });

    return Response.json({ ok: true, sid: message.sid });
  } catch (error) {
    console.error("Twilio WhatsApp notification failed:", error);
    return Response.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

function getWhatsAppNumber(value: string | undefined) {
  if (!value) return "";
  return value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;
}

function buildWhatsAppMessage(
  type: WhatsAppNotificationType,
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
    ...(booking.notes?.trim() ? [`Notes: ${booking.notes}`] : []),
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Twilio error";
}
