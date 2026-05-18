export const ROOMS = [
  "101",
  "102",
  "103",
  "104",
  "105",
  "106",
  "107",
  "108",
  "109",
  "110",
] as const;

export type RoomNo = (typeof ROOMS)[number];
