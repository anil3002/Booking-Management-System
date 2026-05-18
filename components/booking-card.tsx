import type { Booking } from "@/lib/types";
import {
  formatDateTime,
  formatRooms,
  getBookingDisplayStatus,
} from "@/lib/booking-utils";

type BookingCardProps = {
  booking: Booking;
  onSelect?: (booking: Booking) => void;
  selected?: boolean;
  isDisabled?: boolean;
  onRemove?: (booking: Booking) => void;
};

export function BookingCard({
  booking,
  onSelect,
  selected,
  isDisabled,
  onRemove,
}: BookingCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-950">{booking.guest_name}</p>
          <p className="mt-1 text-sm text-slate-600">
            {booking.room_nos && booking.room_nos.length > 1 ? "Rooms" : "Room"}{" "}
            {formatRooms(booking)}
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
          {getBookingDisplayStatus(booking)}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <p>Check-in: {formatDateTime(booking.check_in_datetime)}</p>
        <p>Check-out: {formatDateTime(booking.check_out_datetime)}</p>
        <p>Balance: Rs {booking.remaining_balance}</p>
        <p>ID: {booking.id_type} {booking.id_number}</p>
      </div>
      {onRemove && !isDisabled ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={isDisabled}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(booking);
            }}
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 shadow-sm hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ) : null}
    </>
  );

  if (!onSelect) {
    return (
      <article
        className={`rounded-lg border border-sky-200/80 bg-sky-50/80 p-4 shadow-xl shadow-sky-900/10 backdrop-blur-md ${
          isDisabled ? "opacity-45" : ""
        }`}
      >
        {content}
      </article>
    );
  }

  return (
    <article
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      onClick={() => onSelect(booking)}
      onKeyDown={(event) => {
        if (!isDisabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect(booking);
        }
      }}
      aria-disabled={isDisabled}
      className={`w-full rounded-lg border bg-sky-50/80 p-4 text-left shadow-xl shadow-sky-900/10 backdrop-blur-md transition hover:border-teal-300 ${
        isDisabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
      } ${
        selected ? "border-teal-500 ring-2 ring-teal-100" : "border-sky-200/80"
      }`}
    >
      {content}
    </article>
  );
}
