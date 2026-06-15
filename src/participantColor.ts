const highContrastColors = [
  "#c62828",
  "#1565c0",
  "#2e7d32",
  "#6a1b9a",
  "#ef6c00",
  "#00838f",
  "#5d4037",
  "#283593",
  "#827717",
  "#ad1457"
];

export function participantColor(index: number) {
  return highContrastColors[index];
}

export function participantSelectionColor(color: string) {
  return `color-mix(in srgb, ${color} 22%, transparent)`;
}

export function assignedParticipantColors(participants: { id: number; color?: string }[]) {
  const assigned = new Map<number, string>();
  const used = new Set<string>();
  let nextColor = 0;

  for (const participant of [...participants].sort((first, second) => first.id - second.id)) {
    let color = participant.color;
    if (!color || used.has(color)) {
      do color = participantColor(nextColor++);
      while (used.has(color));
    }
    assigned.set(participant.id, color);
    used.add(color);
  }

  return assigned;
}
