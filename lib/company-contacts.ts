/** Dedupe + join profile full_name values for display under a company row. */
export function contactNamesFromProfiles(
  profiles: { full_name: string | null }[] | null | undefined
): string {
  const raw = (profiles ?? [])
    .map((p) => p.full_name?.trim())
    .filter((s): s is string => Boolean(s));
  const seen = new Set<string>();
  const names: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (!seen.has(s)) {
      seen.add(s);
      names.push(s);
    }
  }
  return names.join(", ");
}
