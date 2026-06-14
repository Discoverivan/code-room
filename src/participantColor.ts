const pastelColors = [
  "#8178b8",
  "#6f9f8a",
  "#7295b8",
  "#ad8b68",
  "#ad7f94",
  "#6d9fa0",
  "#9888b5",
  "#879c70"
];

export function participantColor(name: string) {
  let hash = 0;
  for (const character of name.trim().toLocaleLowerCase()) {
    hash = Math.imul(hash, 31) + character.charCodeAt(0);
  }
  return pastelColors[Math.abs(hash) % pastelColors.length];
}

export function participantSelectionColor(name: string) {
  return `${participantColor(name)}38`;
}
