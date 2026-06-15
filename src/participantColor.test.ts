import { describe, expect, it } from "vitest";
import { assignedParticipantColors, participantColor, participantSelectionColor } from "./participantColor";

describe("participant colors", () => {
  it("assigns unique colors consistently from client IDs", () => {
    const first = assignedParticipantColors([{ id: 42 }, { id: 7 }, { id: 100 }]);
    const second = assignedParticipantColors([{ id: 100 }, { id: 42 }, { id: 7 }]);

    expect(first).toEqual(second);
    expect(new Set(first.values()).size).toBe(3);
  });

  it("preserves existing unique colors and resolves collisions", () => {
    const colors = assignedParticipantColors([
      { id: 1, color: "#e53935" },
      { id: 2, color: "#e53935" },
      { id: 3, color: "#1e88e5" }
    ]);

    expect(colors.get(1)).toBe("#e53935");
    expect(colors.get(2)).not.toBe("#e53935");
    expect(colors.get(3)).toBe("#1e88e5");
    expect(new Set(colors.values()).size).toBe(3);
  });

  it("keeps selection colors tied to participant colors", () => {
    expect(participantColor(0)).toBe("#c62828");
    expect(participantColor(9)).toBe("#ad1457");
    expect(participantColor(10)).toBeUndefined();
    expect(participantSelectionColor("#c62828")).toBe("color-mix(in srgb, #c62828 22%, transparent)");
  });
});
