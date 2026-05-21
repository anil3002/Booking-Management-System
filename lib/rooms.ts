export const ROOMS = [
  "111",
  "112",
  "113",
  "114",
  "115",
  "116",
  "117",
  "118",
  "119",
  "120",
] as const;

export type RoomNo = (typeof ROOMS)[number];

export const ROOM_RATES: Record<RoomNo, number> = {
  "111": 1850,
  "112": 1850,
  "113": 1850,
  "114": 1850,
  "115": 1850,
  "116": 1850,
  "117": 1350,
  "118": 2250,
  "119": 1350,
  "120": 2250,
};

export function calculateRoomsTotal(roomNumbers: string[]) {
  return roomNumbers.reduce(
    (total, roomNo) => total + (ROOM_RATES[roomNo as RoomNo] ?? 0),
    0,
  );
}

export function calculateBillableStayPeriods(
  checkInDateTime: string,
  checkOutDateTime: string,
) {
  const dayMs = 24 * 60 * 60 * 1000;
  const toleranceMs = 60 * 60 * 1000;
  const checkInTime = new Date(checkInDateTime).getTime();
  const checkOutTime = new Date(checkOutDateTime).getTime();
  const durationMs = checkOutTime - checkInTime;

  if (durationMs <= 0) return 0;

  return Math.max(1, Math.ceil((durationMs - toleranceMs) / dayMs));
}

export function calculateStayTotal(
  roomNumbers: string[],
  checkInDateTime: string,
  checkOutDateTime: string,
) {
  return (
    calculateRoomsTotal(roomNumbers) *
    calculateBillableStayPeriods(checkInDateTime, checkOutDateTime)
  );
}
