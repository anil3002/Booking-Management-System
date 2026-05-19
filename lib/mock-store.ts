import type { Booking } from "@/lib/types";
import { calculateRemainingBalance } from "@/lib/booking-utils";

const now = new Date();
const todayStart = new Date(now);
todayStart.setHours(11, 0, 0, 0);

const tomorrow = new Date(todayStart);
tomorrow.setDate(todayStart.getDate() + 1);

const nextDay = new Date(todayStart);
nextDay.setDate(todayStart.getDate() + 2);

const yesterday = new Date(todayStart);
yesterday.setDate(todayStart.getDate() - 1);

const laterToday = new Date(now);
laterToday.setHours(19, 0, 0, 0);

const seedBookings: Booking[] = [
  {
    id: "mock-1",
    room_no: "111",
    guest_name: "Rahul Sharma",
    number_of_persons: 2,
    id_type: "Aadhaar",
    id_number: "XXXX-XXXX-1234",
    number_of_children: 1,
    check_in_datetime: yesterday.toISOString(),
    check_out_datetime: laterToday.toISOString(),
    actual_checkout_datetime: null,
    advance_taken: 1000,
    total_payment: 3200,
    remaining_balance: calculateRemainingBalance(3200, 1000),
    notes: "Needs extra towels",
    status: "checked_in",
    created_at: yesterday.toISOString(),
    updated_at: yesterday.toISOString(),
  },
  {
    id: "mock-2",
    room_no: "114",
    guest_name: "Priya Nair",
    number_of_persons: 1,
    id_type: "PAN",
    id_number: "ABCDE1234F",
    number_of_children: 0,
    check_in_datetime: tomorrow.toISOString(),
    check_out_datetime: nextDay.toISOString(),
    actual_checkout_datetime: null,
    advance_taken: 500,
    total_payment: 1800,
    remaining_balance: calculateRemainingBalance(1800, 500),
    notes: "",
    status: "booked",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
];

const globalStore = globalThis as typeof globalThis & {
  __bookingMockStore?: Booking[];
};

if (!globalStore.__bookingMockStore) {
  globalStore.__bookingMockStore = seedBookings;
}

export function getMockBookings() {
  return globalStore.__bookingMockStore!;
}

export function setMockBookings(bookings: Booking[]) {
  globalStore.__bookingMockStore = bookings;
}
