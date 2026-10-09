import { beforeEach, describe, expect, it } from "vitest";

class MemoryStorage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}
globalThis.localStorage ??= new MemoryStorage() as unknown as Storage;

const {
  dueReminders,
  groupAgenda,
  markNotified,
  mergeAgenda,
  newAgendaItem,
  readAgenda,
  removeAgenda,
  reminderText,
  toICS,
  upsertAgenda,
  upcomingAgenda,
} = await import("./agenda");

const NOW = "2026-10-09";
const item = (titre: string, date: string, extra = {}) => newAgendaItem({ titre, date, ...extra });

describe("agenda des devoirs", () => {
  beforeEach(() => localStorage.clear());

  it("enregistre, trie et supprime", () => {
    upsertAgenda(item("Exposé", "2026-10-20", { genre: "expose" }));
    const ctrl = item("Contrôle fractions", "2026-10-10", { genre: "controle", matiere: "Maths", heure: "08:00" });
    upsertAgenda(ctrl);
    expect(readAgenda().map((i) => i.titre)).toEqual(["Exposé", "Contrôle fractions"]);
    expect(upsertAgenda({ ...ctrl, fait: true }).map((i) => i.titre)).toEqual(["Contrôle fractions", "Exposé"]);
    expect(removeAgenda(ctrl.id).map((i) => i.titre)).toEqual(["Exposé"]);
  });

  it("regroupe par échéance", () => {
    const items = [
      item("Retard", "2026-10-07"),
      item("Aujourd'hui", NOW),
      item("Demain", "2026-10-10"),
      item("Semaine", "2026-10-14"),
      item("Plus tard", "2026-11-20"),
      item("Fait", "2026-10-08", { fait: true }),
    ];
    expect(groupAgenda(items, NOW).map((g) => [g.label, g.items.map((i) => i.titre)])).toEqual([
      ["En retard", ["Retard"]],
      ["Aujourd'hui", ["Aujourd'hui"]],
      ["Demain", ["Demain"]],
      ["Cette semaine", ["Semaine"]],
      ["Plus tard", ["Plus tard"]],
      ["Fait", ["Fait"]],
    ]);
    expect(upcomingAgenda(items, NOW).map((i) => i.titre)).toEqual(["Retard", "Aujourd'hui", "Demain"]);
  });

  it("rappelle la veille ou le jour même, une seule fois par jour", () => {
    const veille = item("Contrôle", "2026-10-10", { genre: "controle", matiere: "SVT" });
    const jour = item("Devoir", NOW, { rappel: "jour", heure: "14:30" });
    const sans = item("Rien", "2026-10-10", { rappel: "aucun" });
    const items = [veille, jour, sans];
    expect(dueReminders(items, NOW, {}).map((i) => i.titre)).toEqual(["Contrôle", "Devoir"]);
    markNotified([veille.id, jour.id], NOW);
    expect(dueReminders(items, NOW)).toEqual([]);
    expect(reminderText(veille, NOW)).toBe("📋 Demain : Contrôle de SVT — Contrôle");
    expect(reminderText(jour, NOW)).toBe("📝 Aujourd'hui à 14h30 : Devoir — Devoir");
  });

  it("fusionne deux appareils en gardant la version la plus récente", () => {
    const a = item("Version A", NOW);
    const b = { ...a, titre: "Version B", updatedAt: a.updatedAt + 1000 };
    const c = item("Autre", NOW);
    const merged = JSON.parse(mergeAgenda(JSON.stringify({ items: [a, c] }), JSON.stringify({ items: [b] })));
    expect(merged.items.map((i: { titre: string }) => i.titre).sort()).toEqual(["Autre", "Version B"]);
  });

  it("exporte un fichier calendrier avec un rappel", () => {
    const ics = toICS([
      item("Contrôle; fractions, chapitre 2", "2026-10-10", { genre: "controle", matiere: "Maths" }),
      item("Exposé", "2026-10-12", { heure: "10:15", rappel: "jour" }),
    ]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261010");
    expect(ics).toContain("DTEND;VALUE=DATE:20261011");
    expect(ics).toContain("SUMMARY:Contrôle de Maths : Contrôle\\; fractions\\, chapitre 2");
    expect(ics).toContain("TRIGGER:-PT6H");
    expect(ics).toContain("DTSTART:20261012T101500");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
  });
});
