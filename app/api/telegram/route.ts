import {
  buildTelegramMessage,
  sendTelegramMessage,
  type TelegramNotificationType,
} from "@/lib/telegram";
import type { Booking } from "@/lib/types";

type TelegramRequestBody = {
  type?: TelegramNotificationType;
  booking?: Booking;
  amountReceived?: number;
  previousBooking?: Booking;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { type, booking, amountReceived, previousBooking } =
      (await request.json()) as TelegramRequestBody;

    if (!type || !booking) {
      return Response.json(
        { ok: false, error: "Notification type and booking are required." },
        { status: 400 },
      );
    }

    const result = await sendTelegramMessage(
      buildTelegramMessage(
        type,
        booking,
        amountReceived ?? 0,
        previousBooking,
      ),
    );

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error ?? "Telegram notification failed." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true, messageId: result.messageId });
  } catch (error) {
    console.error("Telegram notification failed:", error);
    return Response.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Telegram error";
}
