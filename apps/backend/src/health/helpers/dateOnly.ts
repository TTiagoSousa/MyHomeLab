/** "2026-10-15" (ou um ISO completo) → Date à meia-noite UTC; vazio → null. */
export function dateOnly(value?: string | null): Date | null {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : null;
}
