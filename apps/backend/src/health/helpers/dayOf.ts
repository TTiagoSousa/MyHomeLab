/** Uma coluna @db.Date como "2026-10-15" (null fica null). */
export function dayOf(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
