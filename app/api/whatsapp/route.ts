import twilio from "twilio";
import { formatDateTime } from "@/lib/booking-utils";
import type { Booking } from "@/lib/types";

type WhatsAppNotificationType = "new_booking" | "checkout" | "modify_booking";

type WhatsAppRequestBody = {
  type?: WhatsAppNotificationType;
  booking?: Booking;
  amountReceived?: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { type, booking, amountReceived } =
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
      body: buildWhatsAppMessage(type, booking, amountReceived ?? 0),
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
) {
  if (type === "checkout") {
    return [
      "✅ Customer Checked Out",
      `Room No: ${formatRooms(booking)}`,
      `Guest Name: ${booking.guest_name}`,
      `Phone: ${booking.customer_phone_number || "-"}`,
      `Actual Checkout: ${formatOptionalDateTime(booking.actual_checkout_datetime)}`,
      `Total owing: ${booking.total_payment}`,
      `Advance paid: ${booking.advance_taken}`,
      `Balance paid: ${amountReceived}`,
      `Remaining Balance: ${booking.remaining_balance}`,
    ].join("\n");
  }

  if (type === "modify_booking") {
    return [
      "✏️ Booking Modified",
      `Room No: ${formatRooms(booking)}`,
      `Guest Name: ${booking.guest_name}`,
      `Phone: ${booking.customer_phone_number || "-"}`,
      `Updated Check-in: ${formatDateTime(booking.check_in_datetime)}`,
      `Updated Check-out: ${formatDateTime(booking.check_out_datetime)}`,
      `Advance: ${booking.advance_taken}`,
      `Total: ${booking.total_payment}`,
      `Remaining: ${booking.remaining_balance}`,
      `Notes: ${booking.notes || "-"}`,
    ].join("\n");
  }

  return [
    "🏨 New Booking / Check-in",
    `Room No: ${formatRooms(booking)}`,
    `Guest Name: ${booking.guest_name}`,
    `Phone: ${booking.customer_phone_number || "-"}`,
    `Persons: ${booking.number_of_persons}`,
    `Children: ${booking.number_of_children}`,
    `ID: ${booking.id_type} ${booking.id_number}`,
    `Check-in: ${formatDateTime(booking.check_in_datetime)}`,
    `Check-out: ${formatDateTime(booking.check_out_datetime)}`,
    `Advance: ${booking.advance_taken}`,
    `Total: ${booking.total_payment}`,
    `Remaining: ${booking.remaining_balance}`,
    `Notes: ${booking.notes || "-"}`,
  ].join("\n");
}

function formatRooms(booking: Booking) {
  return booking.room_nos?.length ? booking.room_nos.join(", ") : booking.room_no;
}

function formatOptionalDateTime(value: string | null) {
  return value ? formatDateTime(value) : "-";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Twilio error";
}
