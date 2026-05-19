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
