export const CUSTOM_ANSWER_LABEL = "Custom";

export function normalizeOptions(
  options: readonly (string | { label: string; description?: string })[],
) {
  return options.map((option) =>
    typeof option === "string" ? { label: option } : option,
  );
}

export function moveSelection(index: number, delta: number, size: number) {
  if (size <= 0) return 0;
  return (index + delta + size) % size;
}
