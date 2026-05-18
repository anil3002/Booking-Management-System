import type { RoomStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/booking-utils";

type RoomStatusCardProps = {
  room: RoomStatus;
};

export function RoomStatusCard({ room }: RoomStatusCardProps) {
  const statusStyles = {
    Available: "bg-emerald-100 text-emerald-800",
    Booked: "bg-amber-100 text-amber-800",
    "Checked-in": "bg-sky-100 text-sky-800",
  };

  return (
    <article className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-xl shadow-emerald-900/10 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xl font-bold text-slate-950">{room.room_no}</p>
        <span
          className={`rounded-md px-2 py-1 text-xs font-bold ${statusStyles[room.status]}`}
        >
          {room.status}
        </span>
      </div>
      {room.guest_name ? (
        <div className="mt-4 text-sm leading-6 text-slate-700">
          <p className="font-semibold text-slate-950">{room.guest_name}</p>
          <p>Checkout: {formatDateTime(room.check_out_datetime)}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Ready for booking</p>
      )}
    </article>
  );
}
