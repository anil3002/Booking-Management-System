"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/alert";
import { BookingCard } from "@/components/booking-card";
import {
  getActiveBookingsClient,
  getAllBookingsClient,
} from "@/lib/browser-bookings";
import { getDateTimeMs } from "@/lib/booking-utils";
import type { Booking } from "@/lib/types";

export function DashboardDetails() {
  const [pastBookings, setPastBookings] = useState<Booking[]>([]);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    loadDashboardBookings()
      .then(({ pastBookings, activeBookings, upcomingBookings }) => {
        if (!isMounted) return;

        setPastBookings(pastBookings);
        setActiveBookings(activeBookings);
        setUpcomingBookings(upcomingBookings);
      })
      .catch((loadError) => {
        if (isMounted) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="mt-8 grid gap-4">
      {isLoading ? <Alert type="info" message="Loading bookings..." /> : null}
      {error ? <Alert type="error" message={error} /> : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <BookingList
          title="Past Bookings"
          bookings={pastBookings}
          emptyMessage="No past bookings yet."
        />
        <BookingList
          title="Active Bookings"
          bookings={activeBookings}
          emptyMessage="No active bookings right now."
        />
        <BookingList
          title="Upcoming Bookings"
          bookings={upcomingBookings}
          emptyMessage="No upcoming bookings found."
        />
      </div>
    </section>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load bookings.";
}

async function loadDashboardBookings() {
  const [bookings, openBookings] = await Promise.all([
    getAllBookingsClient(),
    getActiveBookingsClient(),
  ]);
  const now = Date.now();

  const pastBookings = bookings
    .filter((booking) => booking.status === "checked_out")
    .sort(
      (left, right) =>
        getDateTimeMs(right.actual_checkout_datetime ?? right.updated_at) -
        getDateTimeMs(left.actual_checkout_datetime ?? left.updated_at),
    );

  const activeBookings = openBookings
    .filter((booking) => getDateTimeMs(booking.check_in_datetime) <= now)
    .sort(
      (left, right) =>
        getDateTimeMs(left.check_in_datetime) -
        getDateTimeMs(right.check_in_datetime),
    );

  const upcomingBookings = openBookings
    .filter((booking) => getDateTimeMs(booking.check_in_datetime) > now)
    .sort(
      (left, right) =>
        getDateTimeMs(left.check_in_datetime) -
        getDateTimeMs(right.check_in_datetime),
    );

  return {
    pastBookings,
    activeBookings,
    upcomingBookings,
  };
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-600">
      {message}
    </div>
  );
}

function BookingList({
  title,
  bookings,
  emptyMessage,
}: {
  title: string;
  bookings: Booking[];
  emptyMessage: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <span className="rounded-md bg-white/80 px-2 py-1 text-xs font-bold text-slate-700">
          {bookings.length}
        </span>
      </div>
      <div className="grid gap-3">
        {bookings.length ? (
          bookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))
        ) : (
          <EmptyState message={emptyMessage} />
        )}
      </div>
    </section>
  );
}
