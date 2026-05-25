import type { Booking } from "@/lib/types";

export type NotificationType =
  | "new_booking"
  | "checkout"
  | "modify_booking"
  | "cancel_booking";

type NotificationResult = {
  ok: boolean;
  error?: string;
};

export async function sendTelegramNotification(
  type: NotificationType,
  booking: Booking,
  amountReceived?: number,
  previousBooking?: Booking,
): Promise<NotificationResult> {
  try {
    const response = await fetch(getTelegramApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, booking, amountReceived, previousBooking }),
    });
    const result = (await response.json()) as NotificationResult;

    if (!response.ok || !result.ok) {
      console.warn("Telegram notification failed:", result.error);
      return {
        ok: false,
        error: result.error ?? "Telegram notification failed.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.warn("Telegram notification failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Telegram notification failed.",
    };
  }
}

function getTelegramApiUrl() {
  if (typeof window !== "undefined") {
    return "/api/telegram";
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/telegram`;
  }

  return `http://localhost:${process.env.PORT ?? "3000"}/api/telegram`;
}
