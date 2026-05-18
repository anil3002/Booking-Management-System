"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/alert";
import { BookingCard } from "@/components/booking-card";
import { Field, TextInput } from "@/components/form-controls";
import { SummaryCard } from "@/components/summary-card";
import {
  getActiveBookingsClient,
  getAllBookingsClient,
  getAvailableRoomsClient,
} from "@/lib/browser-bookings";
import type { Booking, DashboardSummary } from "@/lib/types";

export function DashboardDetails() {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [todaysCheckouts, setTodaysCheckouts] = useState<Booking[]>([]);
  const [completedBookings, setCompletedBookings] = useState<Booking[]>([]);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || summary) return;

    let isMounted = true;

    loadDashboard(dateRange.checkIn, dateRange.checkOut)
      .then(({
        stats,
        rangeCheckIns,
        rangeCheckOuts,
        completedBookings,
        activeBookings,
        upcomingBookings,
      }) => {
        if (!isMounted) return;

        setSummary(stats);
        setUpcoming(rangeCheckIns.slice(0, 3));
        setTodaysCheckouts(rangeCheckOuts.slice(0, 3));
        setCompletedBookings(completedBookings);
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
  }, [dateRange.checkIn, dateRange.checkOut, isOpen, summary]);

  function toggleDetails() {
    setIsOpen((current) => {
      const next = !current;
      if (next && !summary) {
        setIsLoading(true);
        setError("");
      }
      return next;
    });
  }

  function applyDateRange() {
    if (
      new Date(dateRange.checkOut).getTime() <=
      new Date(dateRange.checkIn).getTime()
    ) {
      setError("Check-out date/time must be after check-in date/time.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSummary(null);
  }

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={toggleDetails}
        className="h-12 w-full rounded-md bg-teal-700 px-5 text-base font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-teal-800 sm:w-auto"
      >
        {isOpen ? "Hide dashboard details" : "Show dashboard details"}
      </button>

      {isOpen ? (
        <div className="mt-5 grid gap-6">
          {isLoading ? <Alert type="info" message="Loading dashboard details..." /> : null}
          {error ? <Alert type="error" message={error} /> : null}

          {summary ? (
            <section className="grid gap-4">
              <div className="rounded-lg border border-teal-200/80 bg-teal-50/80 p-4 shadow-xl shadow-teal-900/10 backdrop-blur-md">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      Booking Summary
                    </h2>
                    <p className="mt-1 text-sm text-slate-700">
                      Select a check-in and check-out range to view room
                      availability and booking counts.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] lg:min-w-[620px]">
                    <Field label="Check-in">
                      <TextInput
                        type="datetime-local"
                        value={dateRange.checkIn}
                        onChange={(event) =>
                          setDateRange((current) => ({
                            ...current,
                            checkIn: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <Field label="Check-out">
                      <TextInput
                        type="datetime-local"
                        value={dateRange.checkOut}
                        onChange={(event) =>
                          setDateRange((current) => ({
                            ...current,
                            checkOut: event.target.value,
                          }))
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={applyDateRange}
                      disabled={isLoading}
                      className="h-11 self-end rounded-md bg-rose-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isLoading ? "Loading..." : "Apply"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                <SummaryCard label="Total rooms" value={summary.totalRooms} />
                <SummaryCard
                  label="Occupied in range"
                  value={summary.currentlyBookedRooms}
                />
                <SummaryCard
                  label="Available in range"
                  value={summary.availableRoomsToday}
                />
                <SummaryCard
                  label="Range check-ins"
                  value={summary.upcomingCheckIns}
                />
                <SummaryCard
                  label="Range check-outs"
                  value={summary.todaysCheckOuts}
                />
                <SummaryCard
                  label="Future bookings"
                  value={summary.upcomingBookings}
                />
              </div>
            </section>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-bold text-slate-950">
                Check-ins in Selected Range
              </h2>
              <div className="grid gap-3">
                {upcoming.length ? (
                  upcoming.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                ) : (
                  <EmptyState message="No check-ins found for this range." />
                )}
              </div>
            </div>
            <div>
              <h2 className="mb-3 text-lg font-bold text-slate-950">
                Check-outs in Selected Range
              </h2>
              <div className="grid gap-3">
                {todaysCheckouts.length ? (
                  todaysCheckouts.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                ) : (
                  <EmptyState message="No check-outs found for this range." />
                )}
              </div>
            </div>
          </section>

          {summary ? (
            <section className="grid gap-4">
              <h2 className="text-lg font-bold text-slate-950">
                Booking Lists
              </h2>
              <div className="grid gap-4 xl:grid-cols-3">
                <BookingList
                  title="Completed Bookings"
                  bookings={completedBookings}
                  emptyMessage="No completed bookings yet."
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
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load dashboard data.";
}

async function loadDashboard(checkIn: string, checkOut: string) {
  const rangeStart = new Date(checkIn).toISOString();
  const rangeEnd = new Date(checkOut).toISOString();
  const [bookings, activeBookings, availableRooms] = await Promise.all([
    getAllBookingsClient(),
    getActiveBookingsClient(),
    getAvailableRoomsClient(rangeStart, rangeEnd),
  ]);
  const now = Date.now();
  const completedBookings = bookings
    .filter((booking) => booking.status === "checked_out")
    .sort(
      (left, right) =>
        new Date(right.actual_checkout_datetime ?? right.updated_at).getTime() -
        new Date(left.actual_checkout_datetime ?? left.updated_at).getTime(),
    );
  const upcomingBookings = activeBookings
    .filter((booking) => new Date(booking.check_in_datetime).getTime() > now)
    .sort(
      (left, right) =>
        new Date(left.check_in_datetime).getTime() -
        new Date(right.check_in_datetime).getTime(),
    );
  const currentActiveBookings = activeBookings
    .filter((booking) => new Date(booking.check_in_datetime).getTime() <= now)
    .sort(
      (left, right) =>
        new Date(left.check_out_datetime).getTime() -
        new Date(right.check_out_datetime).getTime(),
    );

  const rangeCheckIns = activeBookings.filter((booking) =>
    isWithinRange(booking.check_in_datetime, rangeStart, rangeEnd),
  );
  const rangeCheckOuts = activeBookings.filter((booking) =>
    isWithinRange(booking.check_out_datetime, rangeStart, rangeEnd),
  );
  const occupiedInRange = activeBookings.filter((booking) =>
    rangesOverlap(
      booking.check_in_datetime,
      booking.check_out_datetime,
      rangeStart,
      rangeEnd,
    ),
  );

  return {
    stats: {
      totalRooms: 10,
      currentlyBookedRooms: occupiedInRange.length,
      availableRoomsToday: availableRooms.length,
      upcomingCheckIns: rangeCheckIns.length,
      todaysCheckOuts: rangeCheckOuts.length,
      upcomingBookings: bookings.filter(
        (booking) =>
          booking.status !== "cancelled" &&
          booking.status !== "checked_out" &&
          new Date(booking.check_in_datetime).getTime() >
            new Date(rangeEnd).getTime(),
      ).length,
    },
    rangeCheckIns,
    rangeCheckOuts,
    completedBookings,
    activeBookings: currentActiveBookings,
    upcomingBookings,
  };
}

function isWithinRange(value: string, rangeStart: string, rangeEnd: string) {
  const time = new Date(value).getTime();
  return (
    time >= new Date(rangeStart).getTime() &&
    time <= new Date(rangeEnd).getTime()
  );
}

function rangesOverlap(
  existingCheckIn: string,
  existingCheckOut: string,
  newCheckIn: string,
  newCheckOut: string,
) {
  return (
    new Date(existingCheckIn).getTime() < new Date(newCheckOut).getTime() &&
    new Date(existingCheckOut).getTime() > new Date(newCheckIn).getTime()
  );
}

function getDefaultDateRange() {
  const checkIn = new Date();
  checkIn.setHours(11, 0, 0, 0);

  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 1);
  checkOut.setHours(10, 0, 0, 0);

  return {
    checkIn: toDateTimeLocal(checkIn),
    checkOut: toDateTimeLocal(checkOut),
  };
}

function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
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
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
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
