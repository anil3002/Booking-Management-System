import type { Booking } from "@/lib/types";

export type NotificationType = "new_booking" | "checkout" | "modify_booking";

type NotificationResult = {
  ok: boolean;
  error?: string;
};

export async function sendWhatsAppNotification(
  type: NotificationType,
  booking: Booking,
  amountReceived?: number,
): Promise<NotificationResult> {
  try {
    const response = await fetch(getWhatsAppApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, booking, amountReceived }),
    });
    const result = (await response.json()) as NotificationResult;

    if (!response.ok || !result.ok) {
      console.warn("WhatsApp notification failed:", result.error);
      return {
        ok: false,
        error: result.error ?? "WhatsApp notification failed.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.warn("WhatsApp notification failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "WhatsApp notification failed.",
    };
  }
}

function getWhatsAppApiUrl() {
  if (typeof window !== "undefined") {
    return "/api/whatsapp";
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/whatsapp`;
  }

  return `http://localhost:${process.env.PORT ?? "3000"}/api/whatsapp`;
}
