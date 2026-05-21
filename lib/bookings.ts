import { ROOMS } from "@/lib/rooms";
import { getMockBookings, setMockBookings } from "@/lib/mock-store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  Booking,
  BookingFormInput,
  DashboardSummary,
  RoomStatus,
} from "@/lib/types";
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
  isActiveStatus,
  isOpenEndedCheckoutDateTime,
  overlaps,
  roundMoney,
  toStoredDateTime,
  toNumber,
  validateBookingInput,
} from "@/lib/booking-utils";

const ACTIVE_STATUSES = ["booked", "checked_in"] as const;

export async function listBookings() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("check_in_datetime", { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    } catch (error) {
      warnSupabaseReadFailure(error);
      return [];
    }
  }

  return getSortedMockBookings();
}

export async function getAllBookings() {
  return listBookings();
}

export async function getBookingById(id: string) {
  const bookings = await listBookings();
  return bookings.find((booking) => booking.id === id) ?? null;
}

export async function listActiveBookings() {
  const bookings = await listBookings();
  return bookings.filter((booking) => isActiveStatus(booking.status));
}

export async function getActiveBookings() {
  return listActiveBookings();
}

export async function listEditableBookings() {
  const now = Date.now();
  const bookings = await listBookings();

  return bookings.filter(
    (booking) =>
      isActiveStatus(booking.status) ||
      getDateTimeMs(booking.check_out_datetime) >= now,
  );
}

export async function getAvailableRooms(
  checkInDateTime: string,
  checkOutDateTime: string,
  excludeBookingId?: string,
) {
  const conflictingBookings = await findConflictingBookings(
    checkInDateTime,
    checkOutDateTime,
    excludeBookingId,
  );
  const unavailableRooms = new Set(
    conflictingBookings.flatMap((booking) => getBookingRooms(booking)),
  );

  return ROOMS.filter((room) => !unavailableRooms.has(room));
}

export async function checkBookingConflict(
  roomNo: string,
  checkInDateTime: string,
  checkOutDateTime: string,
  excludeBookingId?: string,
) {
  const conflicts = await findConflictingBookings(
    checkInDateTime,
    checkOutDateTime,
    excludeBookingId,
  );

  return conflicts.some((booking) => getBookingRooms(booking).includes(roomNo));
}

export async function createBooking(input: BookingFormInput) {
  const normalizedInput = withOpenEndedCheckout(input);
  const validationError = validateBookingInput(normalizedInput);
  if (validationError) throw new Error(validationError);

  const checkIn = toStoredDateTime(normalizedInput.check_in_datetime);
  const checkOut = toStoredDateTime(normalizedInput.check_out_datetime);
  const hasConflict = await checkBookingConflict(input.room_no, checkIn, checkOut);

  if (hasConflict) {
    throw new Error("This room is already booked for the selected date/time.");
  }

  const now = new Date().toISOString();
  const bookingPayload = {
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
    status: "checked_in" as const,
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .insert(bookingPayload)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      throw new Error(getSupabaseMutationMessage(error));
    }
  }

  const booking: Booking = {
    ...bookingPayload,
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  };

  setMockBookings([...getMockBookings(), booking]);
  return booking;
}

export async function updateBooking(id: string, input: BookingFormInput) {
  const validationError = validateBookingInput(input);
  if (validationError) throw new Error(validationError);

  const checkIn = toStoredDateTime(input.check_in_datetime);
  const checkOut = toStoredDateTime(input.check_out_datetime);
  const hasConflict = await checkBookingConflict(
    input.room_no,
    checkIn,
    checkOut,
    id,
  );

  if (hasConflict) {
    throw new Error("This update clashes with another active booking.");
  }

  const updatePayload = {
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
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      throw new Error(getSupabaseMutationMessage(error));
    }
  }

  const bookings = getMockBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) throw new Error("Booking not found.");

  const updated: Booking = { ...booking, ...updatePayload };
  setMockBookings(bookings.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export async function cancelBooking(id: string) {
  const updatePayload = {
    status: "cancelled" as const,
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      throw new Error(getSupabaseMutationMessage(error));
    }
  }

  const bookings = getMockBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) throw new Error("Booking not found.");

  const updated: Booking = { ...booking, ...updatePayload };
  setMockBookings(bookings.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export async function checkoutBooking(
  id: string,
  amountReceived: number,
  checkoutDateTime = getCurrentDateTimeLocalValue(),
  discountApplied = 0,
  totalPayment?: number,
) {
  const amount = roundMoney(amountReceived);
  if (amount < 0) throw new Error("Final payment cannot be negative.");
  const discount = roundMoney(discountApplied);
  if (discount < 0) throw new Error("Discount applied cannot be negative.");
  if (!Number.isInteger(discount)) {
    throw new Error("Discount applied must be a whole number.");
  }

  const bookings = await listBookings();
  const booking = bookings.find((item) => item.id === id);
  if (!booking) throw new Error("Booking not found.");
  if (!isActiveStatus(booking.status)) {
    throw new Error("Only active bookings can be checked out.");
  }
  const total = roundMoney(totalPayment ?? booking.total_payment);
  if (total < 0) throw new Error("Total payment cannot be negative.");
  if (discount > total - booking.advance_taken) {
    throw new Error("Discount applied cannot be more than the remaining balance.");
  }

  const checkoutAt = toStoredDateTime(checkoutDateTime);
  if (getDateTimeMs(checkoutAt) <= getDateTimeMs(booking.check_in_datetime)) {
    throw new Error("Check-out date/time must be after check-in date/time.");
  }

  const remainingBalance = roundMoney(
    Math.max(0, total - booking.advance_taken - discount - amount),
  );
  const updatePayload = {
    status: "checked_out" as const,
    check_out_datetime: checkoutAt,
    actual_checkout_datetime: checkoutAt,
    total_payment: total,
    remaining_balance: remainingBalance,
    updated_at: new Date().toISOString(),
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (error) {
      throw new Error(getSupabaseMutationMessage(error));
    }
  }

  const updated: Booking = { ...booking, ...updatePayload };
  setMockBookings(
    getMockBookings().map((item) => (item.id === id ? updated : item)),
  );
  return updated;
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

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const bookings = await listBookings();
  const activeBookings = bookings.filter((booking) => isActiveStatus(booking.status));
  const today = getCurrentDateTimeLocalValue();
  const tomorrow = addIndiaDays(today, 1);
  const availableRoomsToday = await getAvailableRooms(
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

export async function getDashboardStats() {
  return getDashboardSummary();
}

export async function getRoomStatuses(): Promise<RoomStatus[]> {
  const activeBookings = await listActiveBookings();
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
          status: "Booked",
          guest_name: future.guest_name,
          check_out_datetime: getVisibleCheckoutDateTime(future),
        };
      }

      return { room_no: room, status: "Available" };
    }

    return {
      room_no: room,
      status: getRoomDisplayStatus(current),
      guest_name: current.guest_name,
      check_out_datetime: getVisibleCheckoutDateTime(current),
    };
  });
}

async function findConflictingBookings(
  checkInDateTime: string,
  checkOutDateTime: string,
  excludeBookingId?: string,
) {
  if (supabase) {
    // Room clash rule: existing check-in is before new checkout and existing
    // checkout is after new check-in, excluding checked-out/cancelled bookings.
    let query = supabase
      .from("bookings")
      .select("*")
      .lt("check_in_datetime", checkOutDateTime)
      .gt("check_out_datetime", checkInDateTime)
      .in("status", [...ACTIVE_STATUSES]);

    if (excludeBookingId) {
      query = query.neq("id", excludeBookingId);
    }

    try {
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    } catch (error) {
      warnSupabaseReadFailure(error);
      return [];
    }
  }

  return getMockConflicts(checkInDateTime, checkOutDateTime, excludeBookingId);
}

function getSortedMockBookings() {
  return [...getMockBookings()].sort(
    (a, b) =>
      getDateTimeMs(a.check_in_datetime) -
      getDateTimeMs(b.check_in_datetime),
  );
}

function getMockConflicts(
  checkInDateTime: string,
  checkOutDateTime: string,
  excludeBookingId?: string,
) {
  return getMockBookings().filter(
    (booking) =>
      (!excludeBookingId || booking.id !== excludeBookingId) &&
      isActiveStatus(booking.status) &&
      overlaps(
        booking.check_in_datetime,
        booking.check_out_datetime,
        checkInDateTime,
        checkOutDateTime,
      ),
  );
}

function warnSupabaseReadFailure(error: unknown) {
  console.warn(
    "Supabase read failed; returning no bookings until the backend is reachable.",
    getErrorMessage(error),
  );
}

function getSupabaseMutationMessage(error: unknown) {
  return `Could not save to Supabase. Check your internet connection, Supabase URL/key, and that supabase/schema.sql has been run. Details: ${getErrorMessage(error)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Supabase error";
}

function addIndiaDays(value: string, days: number) {
  const next = new Date(getDateTimeMs(value) + days * 24 * 60 * 60 * 1000);
  return getDateTimeLocalValue(next.toISOString());
}

export { isSupabaseConfigured };
