import { describe, expect, it } from "vitest";
import { participantColor, participantSelectionColor } from "./participantColor";

describe("participant colors", () => {
  it("keeps avatar and selection colors stable for a name", () => {
    expect(participantColor("Ivan")).toBe(participantColor(" Ivan "));
    expect(participantSelectionColor("Ivan")).toBe(`${participantColor("Ivan")}38`);
  });
});
