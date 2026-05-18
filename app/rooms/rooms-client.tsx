"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/alert";
import { Field, TextInput } from "@/components/form-controls";
import { RoomStatusCard } from "@/components/room-status-card";
import { getRoomStatusesForRangeClient } from "@/lib/browser-bookings";
import type { RoomStatus } from "@/lib/types";

export function RoomsClient() {
  const [rooms, setRooms] = useState<RoomStatus[]>([]);
  const [draftRange, setDraftRange] = useState(getDefaultDateRange);
  const [appliedRange, setAppliedRange] = useState(getDefaultDateRange);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    loadRooms(appliedRange.checkIn, appliedRange.checkOut)
      .then((items) => {
        if (isMounted) setRooms(items);
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
  }, [appliedRange.checkIn, appliedRange.checkOut]);

  function applyDateRange() {
    if (
      new Date(draftRange.checkOut).getTime() <=
      new Date(draftRange.checkIn).getTime()
    ) {
      setError("Check-out date/time must be after check-in date/time.");
      return;
    }

    setError("");
    setIsLoading(true);
    setAppliedRange(draftRange);
  }

  const availableCount = rooms.filter((room) => room.status === "Available").length;

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-teal-200/80 bg-teal-50/80 p-4 shadow-xl shadow-teal-900/10 backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Room Availability by Date
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Select a check-in and check-out range to see which rooms are
              available, booked, or checked-in for that period.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] lg:min-w-[620px]">
            <Field label="Check-in">
              <TextInput
                type="datetime-local"
                value={draftRange.checkIn}
                onChange={(event) =>
                  setDraftRange((current) => ({
                    ...current,
                    checkIn: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Check-out">
              <TextInput
                type="datetime-local"
                value={draftRange.checkOut}
                onChange={(event) =>
                  setDraftRange((current) => ({
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

      {isLoading ? <Alert type="info" message="Loading room status from Supabase..." /> : null}
      {error ? <Alert type="error" message={error} /> : null}

      {!isLoading && !error ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm font-bold text-emerald-900 shadow-sm">
          {availableCount} of 10 rooms available for selected range.
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {rooms.map((room) => (
          <RoomStatusCard key={room.room_no} room={room} />
        ))}
      </section>
    </section>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load room status.";
}

async function loadRooms(checkIn: string, checkOut: string) {
  return getRoomStatusesForRangeClient(
    new Date(checkIn).toISOString(),
    new Date(checkOut).toISOString(),
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
