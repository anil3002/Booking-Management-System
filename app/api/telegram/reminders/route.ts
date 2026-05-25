import { getDateTimeMs, isActiveStatus } from "@/lib/booking-utils";
import { supabase } from "@/lib/supabase";
import {
  buildTelegramReminderMessage,
  sendTelegramMessage,
  type TelegramReminderType,
} from "@/lib/telegram";
import type { Booking } from "@/lib/types";

type ReminderResult = {
  bookingId: string;
  guestName: string;
  reminderType: TelegramReminderType;
  ok: boolean;
  error?: string;
};

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_WINDOW_MS = 30 * 60 * 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authError = validateCronRequest(request);
    if (authError) return authError;

    if (!supabase) {
      return Response.json(
        { ok: false, error: "Supabase URL/key are missing." },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .in("status", ["booked", "checked_in"]);

    if (error) throw new Error(error.message);

    const bookings = ((data ?? []) as Booking[]).filter((booking) =>
      isActiveStatus(booking.status),
    );
    const results: ReminderResult[] = [];

    for (const booking of bookings) {
      for (const reminderType of getDueReminderTypes(booking)) {
        results.push(await sendReminder(booking, reminderType));
      }
    }

    return Response.json({
      ok: true,
      checked: bookings.length,
      sent: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    });
  } catch (error) {
    console.error("Telegram reminder job failed:", error);
    return Response.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

async function sendReminder(
  booking: Booking,
  reminderType: TelegramReminderType,
): Promise<ReminderResult> {
  const result = await sendTelegramMessage(
    buildTelegramReminderMessage(reminderType, booking),
  );

  if (!result.ok) {
    return {
      bookingId: booking.id,
      guestName: booking.guest_name,
      reminderType,
      ok: false,
      error: result.error ?? "Telegram reminder failed.",
    };
  }

  const sentColumn =
    reminderType === "48h" ? "reminder_48h_sent_at" : "reminder_24h_sent_at";
  const { error } = await supabase!
    .from("bookings")
    .update({ [sentColumn]: new Date().toISOString() })
    .eq("id", booking.id)
    .is(sentColumn, null);

  if (error) {
    return {
      bookingId: booking.id,
      guestName: booking.guest_name,
      reminderType,
      ok: false,
      error: error.message,
    };
  }

  return {
    bookingId: booking.id,
    guestName: booking.guest_name,
    reminderType,
    ok: true,
  };
}

function getDueReminderTypes(booking: Booking) {
  const dueTypes: TelegramReminderType[] = [];

  if (!booking.reminder_48h_sent_at && isInsideReminderWindow(booking, 48)) {
    dueTypes.push("48h");
  }

  if (!booking.reminder_24h_sent_at && isInsideReminderWindow(booking, 24)) {
    dueTypes.push("24h");
  }

  return dueTypes;
}

function isInsideReminderWindow(booking: Booking, targetHours: number) {
  const remainingMs = getDateTimeMs(booking.check_in_datetime) - Date.now();
  const targetMs = targetHours * HOUR_MS;

  return Math.abs(remainingMs - targetMs) <= REMINDER_WINDOW_MS;
}

function validateCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.VERCEL_ENV === "production") {
      return Response.json(
        { ok: false, error: "CRON_SECRET is required in production." },
        { status: 500 },
      );
    }

    return null;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return null;

  return Response.json(
    { ok: false, error: "Unauthorized reminder request." },
    { status: 401 },
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown reminder error";
}
