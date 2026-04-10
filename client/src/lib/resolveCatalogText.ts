function normalize(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveEffectiveTitle({
  packetTitle,
  catalogTitle,
  masterTitle,
}: {
  packetTitle?: string | null;
  catalogTitle?: string | null;
  masterTitle?: string | null;
}): string {
  return normalize(packetTitle) ?? normalize(catalogTitle) ?? normalize(masterTitle) ?? "";
}

export function resolveEffectiveDescription({
  packetDescription,
  catalogDescription,
  masterDescription,
}: {
  packetDescription?: string | null;
  catalogDescription?: string | null;
  masterDescription?: string | null;
}): string | null {
  return normalize(packetDescription) ?? normalize(catalogDescription) ?? normalize(masterDescription) ?? null;
}
