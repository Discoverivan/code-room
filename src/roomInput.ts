export const ROOM_ID_PATTERN = /^[\w-]{16}$/;

export function parseRoomId(value: string) {
  const trimmed = value.trim();
  if (ROOM_ID_PATTERN.test(trimmed)) return trimmed;
  try {
    const parts = new URL(trimmed).pathname.split("/").filter(Boolean);
    const id = parts.at(-1) ?? "";
    return ROOM_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}
