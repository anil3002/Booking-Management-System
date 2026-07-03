"use client";

import { createClient } from "@supabase/supabase-js";
import { ROOMS } from "@/lib/rooms";
import {
  calculateRemainingBalance,
  getCurrentDateTimeLocalValue,
  getDateTimeLocalValue,
  getDateTimeMs,
  getIndiaDayEnd,
  getIndiaDayKey,
  getIndiaDayStart,
  getBookingRooms,
  getOpenEndedCheckoutDateTime,
  getRoomDisplayStatus,
  availabilityOverlaps,
  bookingBlocksAvailability,
  getAvailabilityRange,
  isActiveStatus,
  isOpenEndedCheckoutDateTime,
  overlaps,
  roundMoney,
  toNumber,
  toStoredDateTime,
  validateBookingInput,
} from "@/lib/booking-utils";
import type { Booking, BookingFormInput } from "@/lib/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const browserSupabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function isBrowserSupabaseReady() {
  return Boolean(browserSupabase);
}

export async function getAllBookingsClient() {
  if (!browserSupabase) {
    throw new Error("Supabase URL/key are missing in .env.local.");
  }

  const { data, error } = await browserSupabase
    .from("bookings")
    .select("*")
    .order("check_in_datetime", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Booking[];
}

export async function getActiveBookingsClient() {
  const bookings = await getAllBookingsClient();
  return bookings.filter((booking) => isActiveStatus(booking.status));
}

export async function getEditableBookingsClient() {
  const now = Date.now();
  const bookings = await getAllBookingsClient();

  return bookings.filter(
    (booking) =>
      isActiveStatus(booking.status) ||
      getDateTimeMs(booking.check_out_datetime) >= now,
  );
}

export async function getDashboardStatsClient() {
  const bookings = await getAllBookingsClient();
  const activeBookings = bookings.filter((booking) => isActiveStatus(booking.status));
  const today = getCurrentDateTimeLocalValue();
  const tomorrow = addIndiaDays(today, 1);
  const availableRoomsToday = await getAvailableRoomsClient(
    getIndiaDayStart(today),
    getIndiaDayEnd(today),
  );

  return {
    totalRooms: ROOMS.length,
    currentlyBookedRooms: activeBookings.filter((booking) =>
      overlaps(
        booking.check_in_datetime,
        booking.check_out_datetime,
        today,
        getIndiaDayEnd(today),
      ),
    ).length,
    availableRoomsToday: availableRoomsToday.length,
    upcomingCheckIns: bookings.filter(
      (booking) =>
        isActiveStatus(booking.status) &&
        getIndiaDayKey(booking.check_in_datetime) === getIndiaDayKey(today),
    ).length,
    todaysCheckOuts: bookings.filter(
      (booking) =>
        isActiveStatus(booking.status) &&
        getIndiaDayKey(booking.check_out_datetime) === getIndiaDayKey(today),
    ).length,
    upcomingBookings: bookings.filter(
      (booking) =>
        isActiveStatus(booking.status) &&
        getDateTimeMs(booking.check_in_datetime) >=
          getDateTimeMs(getIndiaDayStart(tomorrow)),
    ).length,
  };
}

export async function getRoomStatusesClient() {
  const activeBookings = await getActiveBookingsClient();
  const now = getCurrentDateTimeLocalValue();

  return ROOMS.map((room) => {
    const current = activeBookings
      .filter(
        (booking) =>
          getBookingRooms(booking).includes(room) &&
          overlaps(
            booking.check_in_datetime,
            booking.check_out_datetime,
            now,
            now,
          ),
      )
      .sort(
        (a, b) =>
          getDateTimeMs(a.check_out_datetime) -
          getDateTimeMs(b.check_out_datetime),
      )[0];

    if (!current) {
      const future = activeBookings
        .filter(
          (booking) =>
            getBookingRooms(booking).includes(room) &&
            getDateTimeMs(booking.check_in_datetime) > Date.now(),
        )
        .sort(
          (a, b) =>
            getDateTimeMs(a.check_in_datetime) -
            getDateTimeMs(b.check_in_datetime),
        )[0];

      if (future) {
        return {
          room_no: room,
          status: "Booked" as const,
          guest_name: future.guest_name,
          check_out_datetime: getVisibleCheckoutDateTime(future),
        };
      }

      return { room_no: room, status: "Available" as const };
    }

    return {
      room_no: room,
      status: getRoomDisplayStatus(current),
      guest_name: current.guest_name,
      check_out_datetime: getVisibleCheckoutDateTime(current),
    };
  });
}

export async function getRoomStatusesForRangeClient(
  checkInDateTime: string,
  checkOutDateTime: string,
) {
  const activeBookings = await getActiveBookingsClient();

  return ROOMS.map((room) => {
    const conflicting = activeBookings
      .filter(
        (booking) =>
          getBookingRooms(booking).includes(room) &&
          availabilityOverlaps(
            booking.check_in_datetime,
            booking.check_out_datetime,
            checkInDateTime,
            checkOutDateTime,
          ),
      )
      .sort(
        (a, b) =>
          getDateTimeMs(a.check_in_datetime) -
          getDateTimeMs(b.check_in_datetime),
      )[0];

    if (!conflicting) {
      return { room_no: room, status: "Available" as const };
    }

    return {
      room_no: room,
      status: getRoomDisplayStatus(conflicting),
      guest_name: conflicting.guest_name,
      check_out_datetime: conflicting.check_out_datetime,
    };
  });
}

export async function getAvailableRoomsClient(
  checkInDateTime: string,
  checkOutDateTime: string,
  excludeBookingId?: string,
) {
  const conflicts = await findConflictingBookingsClient(
    checkInDateTime,
    checkOutDateTime,
    excludeBookingId,
  );
  const unavailable = new Set(conflicts.flatMap((booking) => getBookingRooms(booking)));
  return ROOMS.filter((room) => !unavailable.has(room));
}

export async function checkBookingConflictClient(
  roomNo: string,
  checkInDateTime: string,
  checkOutDateTime: string,
  excludeBookingId?: string,
) {
  const conflicts = await findConflictingBookingsClient(
    checkInDateTime,
    checkOutDateTime,
    excludeBookingId,
  );

  return conflicts.some((booking) => getBookingRooms(booking).includes(roomNo));
}

export async function createBookingClient(input: BookingFormInput) {
  if (!browserSupabase) {
    throw new Error("Supabase URL/key are missing in .env.local.");
  }

  const normalizedInput = withOpenEndedCheckout(input);
  const validationError = validateBookingInput(normalizedInput);
  if (validationError) throw new Error(validationError);

  const checkIn = toStoredDateTime(normalizedInput.check_in_datetime);
  const checkOut = toStoredDateTime(normalizedInput.check_out_datetime);
  const hasConflict = await checkBookingConflictClient(
    input.room_no,
    checkIn,
    checkOut,
  );

  if (hasConflict) {
    throw new Error("This room is already booked for the selected date/time.");
  }

  const { data, error } = await browserSupabase
    .from("bookings")
    .insert({
      room_no: input.room_no,
      room_nos: [input.room_no],
      guest_name: input.guest_name.trim(),
      customer_phone_number: input.customer_phone_number.trim(),
      number_of_persons: toNumber(input.number_of_persons),
      id_type: input.id_type,
      id_number: input.id_number.trim(),
      number_of_children: toNumber(input.number_of_children),
      check_in_datetime: checkIn,
      check_out_datetime: checkOut,
      actual_checkout_datetime: null,
      advance_taken: roundMoney(toNumber(input.advance_taken)),
      total_payment: roundMoney(toNumber(input.total_payment)),
      remaining_balance: Math.max(
        0,
        calculateRemainingBalance(input.total_payment, input.advance_taken),
      ),
      notes: input.notes.trim(),
      status: "checked_in",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function createBookingsClient(
  input: BookingFormInput,
  roomNumbers: string[],
) {
  if (!browserSupabase) {
    throw new Error("Supabase URL/key are missing in .env.local.");
  }

  if (!roomNumbers.length) {
    throw new Error("Select at least one available room.");
  }

  const normalizedInput = withOpenEndedCheckout(input);
  const validationError = validateBookingInput({
    ...normalizedInput,
    room_no: roomNumbers[0],
  });
  if (validationError) throw new Error(validationError);

  const checkIn = toStoredDateTime(normalizedInput.check_in_datetime);
  const checkOut = toStoredDateTime(normalizedInput.check_out_datetime);
  const availableRooms = await getAvailableRoomsClient(checkIn, checkOut);
  const unavailableSelectedRooms = roomNumbers.filter(
    (roomNo) => !availableRooms.includes(roomNo as (typeof ROOMS)[number]),
  );

  if (unavailableSelectedRooms.length) {
    throw new Error(
      `Room ${unavailableSelectedRooms.join(", ")} is no longer available for this date/time.`,
    );
  }

  const bookingRow = {
    room_no: roomNumbers[0],
    room_nos: roomNumbers,
    guest_name: input.guest_name.trim(),
    customer_phone_number: input.customer_phone_number.trim(),
    number_of_persons: toNumber(input.number_of_persons),
    id_type: input.id_type,
    id_number: input.id_number.trim(),
    number_of_children: toNumber(input.number_of_children),
    check_in_datetime: checkIn,
    check_out_datetime: checkOut,
    actual_checkout_datetime: null,
    advance_taken: roundMoney(toNumber(input.advance_taken)),
    total_payment: roundMoney(toNumber(input.total_payment)),
    remaining_balance: Math.max(
      0,
      calculateRemainingBalance(input.total_payment, input.advance_taken),
    ),
    notes: input.notes.trim(),
    status: "checked_in",
  };

  const { data, error } = await browserSupabase
    .from("bookings")
    .insert(bookingRow)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function updateBookingClient(id: string, input: BookingFormInput) {
  if (!browserSupabase) {
    throw new Error("Supabase URL/key are missing in .env.local.");
  }

  const validationError = validateBookingInput(input);
  if (validationError) throw new Error(validationError);

  const checkIn = toStoredDateTime(input.check_in_datetime);
  const checkOut = toStoredDateTime(input.check_out_datetime);
  const hasConflict = await checkBookingConflictClient(
    input.room_no,
    checkIn,
    checkOut,
    id,
  );

  if (hasConflict) {
    throw new Error("This update clashes with another active booking.");
  }

  const { data, error } = await browserSupabase
    .from("bookings")
    .update({
      room_no: input.room_no,
      room_nos: [input.room_no],
      guest_name: input.guest_name.trim(),
      customer_phone_number: input.customer_phone_number.trim(),
      number_of_persons: toNumber(input.number_of_persons),
      id_type: input.id_type,
      id_number: input.id_number.trim(),
      number_of_children: toNumber(input.number_of_children),
      check_in_datetime: checkIn,
      check_out_datetime: checkOut,
      advance_taken: roundMoney(toNumber(input.advance_taken)),
      total_payment: roundMoney(toNumber(input.total_payment)),
      remaining_balance: calculateRemainingBalance(
        input.total_payment,
        input.advance_taken,
      ),
      notes: input.notes.trim(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function updateBookingRoomsClient(
  id: string,
  input: BookingFormInput,
  roomNumbers: string[],
) {
  if (!browserSupabase) {
    throw new Error("Supabase URL/key are missing in .env.local.");
  }

  if (!roomNumbers.length) {
    throw new Error("Select at least one available room.");
  }

  const normalizedInput = withOpenEndedCheckout(input);
  const validationError = validateBookingInput({
    ...normalizedInput,
    room_no: roomNumbers[0],
  });
  if (validationError) throw new Error(validationError);

  const checkIn = toStoredDateTime(normalizedInput.check_in_datetime);
  const checkOut = toStoredDateTime(normalizedInput.check_out_datetime);
  const availableRooms = await getAvailableRoomsClient(checkIn, checkOut, id);
  const unavailableSelectedRooms = roomNumbers.filter(
    (roomNo) => !availableRooms.includes(roomNo as (typeof ROOMS)[number]),
  );

  if (unavailableSelectedRooms.length) {
    throw new Error(
      `Room ${unavailableSelectedRooms.join(", ")} is no longer available for this date/time.`,
    );
  }

  const { data, error } = await browserSupabase
    .from("bookings")
    .update({
      room_no: roomNumbers[0],
      room_nos: roomNumbers,
      guest_name: input.guest_name.trim(),
      customer_phone_number: input.customer_phone_number.trim(),
      number_of_persons: toNumber(input.number_of_persons),
      id_type: input.id_type,
      id_number: input.id_number.trim(),
      number_of_children: toNumber(input.number_of_children),
      check_in_datetime: checkIn,
      check_out_datetime: checkOut,
      advance_taken: roundMoney(toNumber(input.advance_taken)),
      total_payment: roundMoney(toNumber(input.total_payment)),
      remaining_balance: calculateRemainingBalance(
        input.total_payment,
        input.advance_taken,
      ),
      notes: input.notes.trim(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function cancelBookingClient(id: string) {
  if (!browserSupabase) {
    throw new Error("Supabase URL/key are missing in .env.local.");
  }

  const { data, error } = await browserSupabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

export async function checkoutBookingClient(
  id: string,
  booking: Booking,
  amountReceived: number,
  checkoutDateTime: string,
  discountApplied = 0,
  totalPayment: number,
) {
  if (!browserSupabase) {
    throw new Error("Supabase URL/key are missing in .env.local.");
  }

  const amount = roundMoney(amountReceived);
  if (amount < 0) throw new Error("Final payment cannot be negative.");
  const discount = roundMoney(discountApplied);
  if (discount < 0) throw new Error("Discount applied cannot be negative.");
  if (!Number.isInteger(discount)) {
    throw new Error("Discount applied must be a whole number.");
  }
  const total = roundMoney(totalPayment);
  if (total < 0) throw new Error("Total payment cannot be negative.");
  if (discount > total - booking.advance_taken) {
    throw new Error("Discount applied cannot be more than the remaining balance.");
  }
  if (!checkoutDateTime) throw new Error("Check-out date/time is required.");

  const checkoutAt = toStoredDateTime(checkoutDateTime);
  if (getDateTimeMs(checkoutAt) <= getDateTimeMs(booking.check_in_datetime)) {
    throw new Error("Check-out date/time must be after check-in date/time.");
  }

  const { data, error } = await browserSupabase
    .from("bookings")
    .update({
      status: "checked_out",
      check_out_datetime: checkoutAt,
      actual_checkout_datetime: checkoutAt,
      total_payment: total,
      final_payment_received: amount,
      discount_applied: discount,
      remaining_balance: roundMoney(
        Math.max(0, total - booking.advance_taken - discount - amount),
      ),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}

function withOpenEndedCheckout(input: BookingFormInput): BookingFormInput {
  if (input.check_out_datetime || !input.check_in_datetime) return input;

  return {
    ...input,
    check_out_datetime: getOpenEndedCheckoutDateTime(input.check_in_datetime),
  };
}

function getVisibleCheckoutDateTime(booking: Booking) {
  return isOpenEndedCheckoutDateTime(
    booking.check_in_datetime,
    booking.check_out_datetime,
  )
    ? undefined
    : booking.check_out_datetime;
}

async function findConflictingBookingsClient(
  checkInDateTime: string,
  checkOutDateTime: string,
  excludeBookingId?: string,
) {
  if (!browserSupabase) {
    throw new Error("Supabase URL/key are missing in .env.local.");
  }

  const requestedRange = getAvailabilityRange(checkInDateTime, checkOutDateTime);

  let query = browserSupabase
    .from("bookings")
    .select("*")
    .lte("check_in_datetime", getIndiaDayEnd(requestedRange.checkIn))
    .gt("check_out_datetime", requestedRange.checkIn)
    .not("status", "in", "(checked_out,cancelled)");

  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as Booking[]).filter((booking) =>
    bookingBlocksAvailability(
      booking.check_in_datetime,
      booking.check_out_datetime,
      checkInDateTime,
      checkOutDateTime,
    ),
  );
}

function addIndiaDays(value: string, days: number) {
  const next = new Date(getDateTimeMs(value) + days * 24 * 60 * 60 * 1000);
  return getDateTimeLocalValue(next.toISOString());
}
