const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

/** « à l'instant », « il y a 5 minutes », « hier »… puis la date complète au-delà d'une semaine. */
export function formatDate(ts: number) {
  const diff = (ts - Date.now()) / 1000;
  if (diff > -60) return "à l'instant";
  if (diff > -3600) return relative.format(Math.round(diff / 60), "minute");
  if (diff > -86400) return relative.format(Math.round(diff / 3600), "hour");
  if (diff > -7 * 86400) return relative.format(Math.round(diff / 86400), "day");
  return `le ${dateFormat.format(ts)}`;
}

/** Recherche insensible aux accents et à la casse. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
