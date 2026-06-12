import { describe, expect, it } from "vitest";
import { parseRoomId } from "./roomInput";

const id = "f83b1ca2RoomLink";

describe("parseRoomId", () => {
  it("accepts a room ID", () => expect(parseRoomId(id)).toBe(id));
  it("extracts an ID from a room link", () =>
    expect(parseRoomId(`https://example.com/room/${id}`)).toBe(id));
  it("rejects invalid input", () => expect(parseRoomId("not-a-room")).toBeNull());
});
