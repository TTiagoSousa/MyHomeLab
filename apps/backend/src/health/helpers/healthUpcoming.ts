export type UpcomingKind = 'APPOINTMENT' | 'FOLLOW_UP' | 'VACCINE' | 'LENS';

export interface UpcomingItem {
  kind: UpcomingKind;
  id: string;
  date: string; // AAAA-MM-DD
  at: Date | null; // nas consultas, a hora
  title: string;
  overdue: boolean;
}

export interface UpcomingSources {
  appointments: {
    id: string;
    at: Date;
    specialty: string;
    doctor: string | null;
    followUpDate: Date | null;
  }[];
  vaccines: { id: string; name: string; nextDueDate: Date | null }[];
  lenses: { id: string; startDate: Date; replaceDays: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * O que vem aí: consultas marcadas, voltas ao médico (followUpDate), reforços
 * de vacinas e a troca das lentes. Inclui o que já passou da data há menos de
 * `overdueDays` (para não se esquecer) e o que vem nos próximos `aheadDays`.
 */
export function healthUpcoming(
  sources: UpcomingSources,
  now: Date,
  aheadDays = 60,
  overdueDays = 30,
): UpcomingItem[] {
  const today = iso(now);
  const until = iso(new Date(now.getTime() + aheadDays * DAY_MS));
  const since = iso(new Date(now.getTime() - overdueDays * DAY_MS));
  const items: UpcomingItem[] = [];
  const add = (item: Omit<UpcomingItem, 'overdue'>) => {
    if (item.date > until || item.date < since) return;
    items.push({ ...item, overdue: item.date < today });
  };

  // A volta ao médico só conta na consulta mais recente de cada especialidade:
  // se já há outra depois (passada ou marcada), essa volta já foi tratada.
  const latestBySpecialty = new Map<string, string>();
  for (const appointment of [...sources.appointments].sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  ))
    latestBySpecialty.set(appointment.specialty, appointment.id);

  for (const appointment of sources.appointments) {
    const title = appointment.doctor ?? appointment.specialty;
    if (appointment.at >= now)
      add({
        kind: 'APPOINTMENT',
        id: appointment.id,
        date: iso(appointment.at),
        at: appointment.at,
        title,
      });
    if (
      appointment.followUpDate &&
      latestBySpecialty.get(appointment.specialty) === appointment.id
    )
      add({
        kind: 'FOLLOW_UP',
        id: appointment.id,
        date: iso(appointment.followUpDate),
        at: null,
        title,
      });
  }
  for (const vaccine of sources.vaccines) {
    if (vaccine.nextDueDate)
      add({
        kind: 'VACCINE',
        id: vaccine.id,
        date: iso(vaccine.nextDueDate),
        at: null,
        title: vaccine.name,
      });
  }
  const lens = [...sources.lenses].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  )[0];
  if (lens)
    add({
      kind: 'LENS',
      id: lens.id,
      date: iso(new Date(lens.startDate.getTime() + lens.replaceDays * DAY_MS)),
      at: null,
      title: '',
    });

  return items.sort((a, b) => a.date.localeCompare(b.date));
}
