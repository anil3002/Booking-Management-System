export type BookingStatus = "booked" | "checked_in" | "checked_out" | "cancelled";

export type Booking = {
  id: string;
  room_no: string;
  room_nos?: string[] | null;
  guest_name: string;
  customer_phone_number: string;
  number_of_persons: number;
  id_type: string;
  id_number: string;
  number_of_children: number;
  check_in_datetime: string;
  check_out_datetime: string;
  actual_checkout_datetime: string | null;
  advance_taken: number;
  total_payment: number;
  remaining_balance: number;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
};

export type BookingFormInput = {
  room_no: string;
  guest_name: string;
  customer_phone_number: string;
  number_of_persons: number | "";
  id_type: string;
  id_number: string;
  number_of_children: number | "";
  check_in_datetime: string;
  check_out_datetime: string;
  advance_taken: number | "";
  total_payment: number | "";
  notes: string;
};

export type DashboardSummary = {
  totalRooms: number;
  currentlyBookedRooms: number;
  availableRoomsToday: number;
  upcomingCheckIns: number;
  todaysCheckOuts: number;
  upcomingBookings: number;
};

export type RoomStatus = {
  room_no: string;
  status: "Available" | "Booked" | "Checked-in";
  guest_name?: string;
  check_out_datetime?: string;
};

export type ActionResult<T = undefined> = {
  ok: boolean;
  message: string;
  data?: T;
};
