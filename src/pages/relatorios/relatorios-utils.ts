import { addDays, differenceInCalendarDays, parseISO, startOfMonth } from "date-fns";

export function formatBRL(value: number) {
  const numValue = Number(value);
  if (!Number.isFinite(numValue)) return "R$ 0,00";
  return numValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function safeNumber(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export function toInicioDate(inicio: string) {
  return parseISO(`${inicio}T00:00:00`);
}

export function toFimDateExclusivo(fim: string) {
  return addDays(parseISO(`${fim}T00:00:00`), 1);
}

export function previousPeriodFromRange(inicioISO: string, fimISO: string) {
  const inicioDate = toInicioDate(inicioISO);
  const fimDateExclusivo = toFimDateExclusivo(fimISO);
  const dias = Math.max(1, differenceInCalendarDays(fimDateExclusivo, inicioDate));
  const prevFimExclusivo = inicioDate;
  const prevInicio = addDays(prevFimExclusivo, -dias);
  return { prevInicio, prevFimExclusivo };
}

export function changePercent(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function competenciaToDate(competenciaYYYYMM: string) {
  // yyyy-MM -> yyyy-MM-01
  const d = parseISO(`${competenciaYYYYMM}-01T00:00:00`);
  return startOfMonth(d);
}
