export function addMinutesToTime(time: string, min: number) {
  const [h, m] = time.split(":").map(Number);
  const total = (h! * 60 + (m ?? 0) + min) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
