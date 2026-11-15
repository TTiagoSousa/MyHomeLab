/** A idade em anos completos num dia ("2026-10-15"), a partir da data de nascimento. */
export function ageOn(birthDate: Date, day: string): number {
  const birth = birthDate.toISOString().slice(0, 10);
  const years = Number(day.slice(0, 4)) - Number(birth.slice(0, 4));
  return day.slice(5) < birth.slice(5) ? years - 1 : years;
}
