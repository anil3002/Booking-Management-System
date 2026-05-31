import {
  addIndiaDays,
  getBookingRooms,
  getCurrentDateTimeLocalValue,
  getDateTimeMs,
  getIndiaDayKey,
  isActiveStatus,
} from "@/lib/booking-utils";
import { supabase } from "@/lib/supabase";
import {
  buildTelegramOccupancyWarningMessage,
  buildTelegramReminderMessage,
  sendTelegramMessage,
  type TelegramReminderType,
} from "@/lib/telegram";
import type { Booking } from "@/lib/types";

type ReminderResult = {
  bookingId: string;
  guestName: string;
  reminderType: TelegramReminderType | "occupancy_warning";
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

      const occupiedConflicts = getOccupiedRoomConflicts(booking, bookings);
      if (occupiedConflicts.length) {
        results.push(await sendOccupancyWarning(booking, occupiedConflicts));
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

async function sendOccupancyWarning(
  booking: Booking,
  conflictingBookings: Booking[],
): Promise<ReminderResult> {
  const result = await sendTelegramMessage(
    buildTelegramOccupancyWarningMessage(booking, conflictingBookings),
  );

  if (!result.ok) {
    return {
      bookingId: booking.id,
      guestName: booking.guest_name,
      reminderType: "occupancy_warning",
      ok: false,
      error: result.error ?? "Telegram occupancy warning failed.",
    };
  }

  const { error } = await supabase!
    .from("bookings")
    .update({ occupancy_warning_sent_at: new Date().toISOString() })
    .eq("id", booking.id)
    .is("occupancy_warning_sent_at", null);

  if (error) {
    return {
      bookingId: booking.id,
      guestName: booking.guest_name,
      reminderType: "occupancy_warning",
      ok: false,
      error: error.message,
    };
  }

  return {
    bookingId: booking.id,
    guestName: booking.guest_name,
    reminderType: "occupancy_warning",
    ok: true,
  };
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

function getOccupiedRoomConflicts(booking: Booking, bookings: Booking[]) {
  if (booking.occupancy_warning_sent_at || !isTomorrowCheckIn(booking)) {
    return [];
  }

  const bookingRooms = new Set(getBookingRooms(booking));
  const now = Date.now();

  return bookings.filter((candidate) => {
    if (candidate.id === booking.id || candidate.status !== "checked_in") {
      return false;
    }

    if (getDateTimeMs(candidate.check_in_datetime) > now) {
      return false;
    }

    return getBookingRooms(candidate).some((room) => bookingRooms.has(room));
  });
}

function isTomorrowCheckIn(booking: Booking) {
  const tomorrow = addIndiaDays(getCurrentDateTimeLocalValue(), 1);
  return getIndiaDayKey(booking.check_in_datetime) === getIndiaDayKey(tomorrow);
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
