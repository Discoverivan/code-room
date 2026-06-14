import { describe, expect, it } from "vitest";
import { normalizeRoomName, roomNameStorageKey } from "./roomIdentity";

describe("room identity", () => {
  it("uses a separate storage key for each room", () => {
    expect(roomNameStorageKey("room-a")).toBe("code-room-name:room-a");
    expect(roomNameStorageKey("room-b")).toBe("code-room-name:room-b");
  });

  it("normalizes and limits participant names", () => {
    expect(normalizeRoomName("  Ivan  ")).toBe("Ivan");
    expect(normalizeRoomName("a".repeat(40))).toHaveLength(32);
    expect(normalizeRoomName(null)).toBe("");
  });
});
