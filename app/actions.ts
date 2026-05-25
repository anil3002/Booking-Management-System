"use server";

import { revalidatePath } from "next/cache";
import {
  cancelBooking,
  checkoutBooking,
  createBooking,
  getAvailableRooms,
  getBookingById,
  updateBooking,
} from "@/lib/bookings";
import { getDateTimeMs, toStoredDateTime } from "@/lib/booking-utils";
import { sendTelegramNotification } from "@/lib/notifications";
import type { ActionResult, Booking, BookingFormInput } from "@/lib/types";

export async function checkAvailableRoomsAction(
  checkInDateTime: string,
  checkOutDateTime: string,
  excludeBookingId?: string,
): Promise<ActionResult<string[]>> {
  try {
    if (!checkInDateTime || !checkOutDateTime) {
      return {
        ok: false,
        message: "Choose check-in and check-out date/time first.",
      };
    }

    if (getDateTimeMs(checkOutDateTime) <= getDateTimeMs(checkInDateTime)) {
      return {
        ok: false,
        message: "Check-out date/time must be after check-in date/time.",
      };
    }

    const rooms = await getAvailableRooms(
      toStoredDateTime(checkInDateTime),
      toStoredDateTime(checkOutDateTime),
      excludeBookingId,
    );

    return {
      ok: true,
      message: rooms.length
        ? "Available rooms loaded."
        : "No rooms are available for this date/time range.",
      data: rooms,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function createBookingAction(
  input: BookingFormInput,
): Promise<ActionResult<Booking>> {
  try {
    const booking = await createBooking(input);
    const notification = await sendTelegramNotification("new_booking", booking);
    revalidateBookingPages();
    return {
      ok: true,
      message: notification.ok
        ? "Booking saved successfully."
        : "Booking saved, but Telegram notification failed.",
      data: booking,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function updateBookingAction(
  id: string,
  input: BookingFormInput,
): Promise<ActionResult<Booking>> {
  try {
    const previousBooking = await getBookingById(id);
    const booking = await updateBooking(id, input);
    const notification = await sendTelegramNotification(
      "modify_booking",
      booking,
      undefined,
      previousBooking ?? undefined,
    );
    revalidateBookingPages();
    return {
      ok: true,
      message: notification.ok
        ? "Booking updated successfully."
        : "Booking updated, but Telegram notification failed.",
      data: booking,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelBookingAction(
  id: string,
): Promise<ActionResult<Booking>> {
  try {
    const booking = await cancelBooking(id);
    const notification = await sendTelegramNotification("cancel_booking", booking);
    revalidateBookingPages();
    return {
      ok: true,
      message: notification.ok
        ? "Booking removed successfully."
        : "Booking removed, but Telegram notification failed.",
      data: booking,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function checkoutBookingAction(
  id: string,
  amountReceived: number,
  checkoutDateTime?: string,
  discountApplied?: number,
  totalPayment?: number,
): Promise<ActionResult<Booking>> {
  try {
    const booking = await checkoutBooking(
      id,
      amountReceived,
      checkoutDateTime,
      discountApplied,
      totalPayment,
    );
    const notification = await sendTelegramNotification(
      "checkout",
      booking,
      amountReceived,
    );
    revalidateBookingPages();
    return {
      ok: true,
      message: notification.ok
        ? "Customer checked out successfully."
        : "Customer checked out, but Telegram notification failed.",
      data: booking,
    };
  } catch (error) {
    return failure(error);
  }
}

function revalidateBookingPages() {
  revalidatePath("/");
  revalidatePath("/check-out");
  revalidatePath("/upcoming");
  revalidatePath("/rooms");
}

function failure<T = undefined>(error: unknown): ActionResult<T> {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}
