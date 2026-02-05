export function parseTimeToMinutes(value: string) {
  const [h, m] = value.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

export function minutesToTime(minutes: number) {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}`;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function buildAvailableSlots(params: {
  workStart: string;
  workEnd: string;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  slotStepMinutes?: number;
  serviceDurationMinutes: number;
  busy: Array<{ start: string; durationMinutes: number }>;
}) {
  const step = params.slotStepMinutes ?? 30;
  const workStartM = parseTimeToMinutes(params.workStart);
  const workEndM = parseTimeToMinutes(params.workEnd);
  const lunchStartM = params.lunchStart ? parseTimeToMinutes(params.lunchStart) : null;
  const lunchEndM = params.lunchEnd ? parseTimeToMinutes(params.lunchEnd) : null;

  const serviceDur = params.serviceDurationMinutes;

  const busyRanges = params.busy.map((b) => {
    const s = parseTimeToMinutes(b.start);
    return { start: s, end: s + b.durationMinutes };
  });

  const slots: string[] = [];

  for (let start = workStartM; start + serviceDur <= workEndM; start += step) {
    const end = start + serviceDur;

    // não invadir almoço
    if (lunchStartM != null && lunchEndM != null && overlaps(start, end, lunchStartM, lunchEndM)) continue;

    // não sobrepor agendamentos existentes
    const collides = busyRanges.some((r) => overlaps(start, end, r.start, r.end));
    if (collides) continue;

    slots.push(minutesToTime(start));
  }

  return slots;
}
