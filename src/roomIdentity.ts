const ROOM_NAME_PREFIX = "code-room-name:";

export function roomNameStorageKey(roomId: string) {
  return `${ROOM_NAME_PREFIX}${roomId}`;
}

export function normalizeRoomName(value: string | null) {
  return value?.trim().slice(0, 32) ?? "";
}
