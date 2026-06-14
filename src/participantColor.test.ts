import { describe, expect, it } from "vitest";
import { participantColor } from "./participantColor";

describe("participant color", () => {
  it("is stable for the same name", () => {
    expect(participantColor("Ivan")).toBe(participantColor("Ivan"));
    expect(participantColor(" Ivan ")).toBe(participantColor("ivan"));
  });

  it("returns a pastel palette color", () => {
    expect(participantColor("Ivan")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
