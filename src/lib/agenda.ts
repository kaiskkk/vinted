// Agenda des devoirs et contrôles, avec rappels. Une seule clé (ed-agenda), synchronisée avec le compte.
import { cleanText } from "../../shared/study";
import { newId } from "./mapModel";
import { addDays, parseDay, today } from "./planning";

export type Genre = "devoir" | "controle" | "expose" | "autre";
export const GENRES: { value: Genre; label: string; emoji: string }[] = [
  { value: "devoir", label: "Devoir", emoji: "📝" },
  { value: "controle", label: "Contrôle", emoji: "📋" },
  { value: "expose", label: "Exposé", emoji: "🎤" },
  { value: "autre", label: "Autre", emoji: "📌" },
];

export type Rappel = "aucun" | "veille" | "jour";
export const RAPPELS: { value: Rappel; label: string }[] = [
  { value: "veille", label: "La veille" },
  { value: "jour", label: "Le jour même" },
  { value: "aucun", label: "Aucun" },
];

export interface AgendaItem {
  id: string;
  titre: string;
  matiere: string;
  genre: Genre;
  /** Jour local AAAA-MM-JJ. */
  date: string;
  /** « HH:MM » ou "" (toute la journée). */
  heure: string;
  rappel: Rappel;
  fait: boolean;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

const KEY = "ed-agenda";
const NOTIFIED_KEY = "ed-agenda-rappels";
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function normalizeItem(raw: unknown): AgendaItem | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const titre = cleanText(o.titre, 140);
  if (!titre || !isDay(o.date)) return null;
  const now = Date.now();
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : now);
  return {
    id: typeof o.id === "string" && o.id ? o.id.slice(0, 100) : newId(),
    titre,
    matiere: cleanText(o.matiere, 60),
    genre: GENRES.some((g) => g.value === o.genre) ? (o.genre as Genre) : "devoir",
    date: o.date,
    heure: typeof o.heure === "string" && /^\d{2}:\d{2}$/.test(o.heure) ? o.heure : "",
    rappel: RAPPELS.some((r) => r.value === o.rappel) ? (o.rappel as Rappel) : "veille",
    fait: Boolean(o.fait),
    notes: typeof o.notes === "string" ? o.notes.slice(0, 1000) : "",
    createdAt: num(o.createdAt),
    updatedAt: num(o.updatedAt),
  };
}

export function parseAgenda(text: string | null): AgendaItem[] {
  try {
    const raw = JSON.parse(text ?? "null") as { items?: unknown } | null;
    return (Array.isArray(raw?.items) ? raw.items : []).map(normalizeItem).filter((i): i is AgendaItem => i !== null);
  } catch {
    return [];
  }
}

export function readAgenda(): AgendaItem[] {
  try {
    return parseAgenda(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

function write(items: AgendaItem[]) {
  localStorage.setItem(KEY, JSON.stringify({ items }));
}

export function newAgendaItem(data: Partial<AgendaItem> & Pick<AgendaItem, "titre" | "date">): AgendaItem {
  const now = Date.now();
  return { id: newId(), matiere: "", genre: "devoir", heure: "", rappel: "veille", fait: false, notes: "", createdAt: now, updatedAt: now, ...data };
}

export function upsertAgenda(item: AgendaItem): AgendaItem[] {
  const items = readAgenda().filter((i) => i.id !== item.id);
  items.push({ ...item, updatedAt: Date.now() });
  write(items);
  return sortAgenda(items);
}

export function removeAgenda(id: string): AgendaItem[] {
  const items = readAgenda().filter((i) => i.id !== id);
  write(items);
  return sortAgenda(items);
}

const order = (i: AgendaItem) => `${i.date} ${i.heure || "99:99"}`;
export const sortAgenda = (items: AgendaItem[]) => [...items].sort((a, b) => order(a).localeCompare(order(b)));

/** Fusion de deux appareils (synchro) : pour un même élément, la version la plus récente. */
export function mergeAgenda(a: string | null, b: string | null): string {
  const byId = new Map<string, AgendaItem>();
  for (const item of [...parseAgenda(a), ...parseAgenda(b)]) {
    const old = byId.get(item.id);
    if (!old || item.updatedAt >= old.updatedAt) byId.set(item.id, item);
  }
  return JSON.stringify({ items: sortAgenda([...byId.values()]) });
}

export interface AgendaGroup {
  key: string;
  label: string;
  items: AgendaItem[];
}

/** Regroupe par échéance : en retard, aujourd'hui, demain, cette semaine, plus tard, fait. */
export function groupAgenda(items: AgendaItem[], now = today()): AgendaGroup[] {
  const tomorrow = addDays(now, 1);
  const week = addDays(now, 7);
  const groups: AgendaGroup[] = [
    { key: "retard", label: "En retard", items: [] },
    { key: "aujourdhui", label: "Aujourd'hui", items: [] },
    { key: "demain", label: "Demain", items: [] },
    { key: "semaine", label: "Cette semaine", items: [] },
    { key: "plus-tard", label: "Plus tard", items: [] },
    { key: "fait", label: "Fait", items: [] },
  ];
  const at = (k: string) => groups.find((g) => g.key === k)!.items;
  for (const i of sortAgenda(items)) {
    if (i.fait) at("fait").push(i);
    else if (i.date < now) at("retard").push(i);
    else if (i.date === now) at("aujourdhui").push(i);
    else if (i.date === tomorrow) at("demain").push(i);
    else if (i.date <= week) at("semaine").push(i);
    else at("plus-tard").push(i);
  }
  // Les plus récents d'abord parmi ce qui est fait, et seulement les 20 derniers.
  const done = at("fait");
  done.reverse().splice(20);
  return groups.filter((g) => g.items.length);
}

const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** « aujourd'hui », « demain », « hier » ou « jeudi 15 octobre ». */
export function dayLabel(date: string, now = today()): string {
  if (date === now) return "aujourd'hui";
  if (date === addDays(now, 1)) return "demain";
  if (date === addDays(now, -1)) return "hier";
  return dayFormat.format(parseDay(date));
}

/** Ce qui arrive bientôt (ou est en retard) et n'est pas fait : pour l'accueil. */
export const upcomingAgenda = (items = readAgenda(), now = today()) => sortAgenda(items).filter((i) => !i.fait && i.date <= addDays(now, 1));

// ---------- Rappels ----------

function readNotified(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

/** Rappels à afficher maintenant (une seule fois par jour et par élément). */
export function dueReminders(items = readAgenda(), now = today(), notified = readNotified()): AgendaItem[] {
  const tomorrow = addDays(now, 1);
  return items.filter(
    (i) => !i.fait && i.rappel !== "aucun" && notified[i.id] !== now && (i.rappel === "veille" ? i.date === tomorrow : i.date === now),
  );
}

export function markNotified(ids: string[], now = today()) {
  const notified = readNotified();
  for (const id of ids) notified[id] = now;
  // On ne garde que les rappels du jour : la liste ne grossit pas.
  for (const [id, day] of Object.entries(notified)) if (day !== now) delete notified[id];
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
  } catch {
    // Sans gravité : le rappel pourra être affiché une seconde fois.
  }
}

export const genreOf = (g: Genre) => GENRES.find((x) => x.value === g) ?? GENRES[0];

export function reminderText(i: AgendaItem, now = today()): string {
  const g = genreOf(i.genre);
  return `${g.emoji} ${dayLabel(i.date, now).replace(/^./, (c) => c.toUpperCase())}${i.heure ? ` à ${i.heure.replace(":", "h")}` : ""} : ${g.label}${i.matiere ? ` de ${i.matiere}` : ""} — ${i.titre}`;
}

// ---------- Export vers l'agenda du téléphone (.ics) ----------

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (date: string) => date.replace(/-/g, "");
const stamp = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** Fichier calendrier : l'application Agenda du téléphone se charge des rappels, même site fermé. */
export function toICS(items: AgendaItem[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ecoleduc//Agenda//FR", "CALSCALE:GREGORIAN"];
  for (const i of items) {
    const g = genreOf(i.genre);
    const summary = `${g.label}${i.matiere ? ` de ${i.matiere}` : ""} : ${i.titre}`;
    lines.push("BEGIN:VEVENT", `UID:${i.id}@ecoleduc`, `DTSTAMP:${stamp(i.updatedAt)}`);
    if (i.heure) {
      const start = `${compact(i.date)}T${i.heure.replace(":", "")}00`;
      const [h, m] = i.heure.split(":").map(Number);
      const endH = Math.min(23, h + 1);
      lines.push(`DTSTART:${start}`, `DTEND:${compact(i.date)}T${String(endH).padStart(2, "0")}${String(m).padStart(2, "0")}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(i.date)}`, `DTEND;VALUE=DATE:${compact(addDays(i.date, 1))}`);
    }
    lines.push(`SUMMARY:${icsText(summary)}`);
    if (i.notes) lines.push(`DESCRIPTION:${icsText(i.notes)}`);
    if (i.rappel !== "aucun") {
      // Journée entière : la veille à 18 h ou le jour même à 7 h ; sinon la veille ou une heure avant.
      const trigger = i.heure ? (i.rappel === "veille" ? "-P1D" : "-PT1H") : i.rappel === "veille" ? "-PT6H" : "PT7H";
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(summary)}`, `TRIGGER:${trigger}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICS(items: AgendaItem[], name = "ecoleduc-agenda") {
  const blob = new Blob([toICS(items)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
