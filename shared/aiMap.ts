// Format JSON échangé avec Claude, partagé entre le serveur et le front.

export interface AiNode {
  id: string;
  texte: string;
  parentId: string | null;
  couleur: string;
  emoji: string;
}

export interface AiMap {
  titre: string;
  noeuds: AiNode[];
}

export const ROOT_COLOR = "#4f46e5";

/** Couleurs vives attribuées aux branches principales quand Claude n'en donne pas. */
export const BRANCH_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#06b6d4",
  "#a855f7",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#3b82f6",
];

export const MAX_TEXT_LENGTH = 200;

/** Renvoie une couleur "#rrggbb" valide, ou null. Accepte "#abc" et l'absence de "#". */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  const long = /^#?([0-9a-f]{6})$/i.exec(s);
  if (long) return `#${long[1].toLowerCase()}`;
  const short = /^#?([0-9a-f]{3})$/i.exec(s);
  if (short) {
    return `#${short[1]
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  return null;
}

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Garde uniquement le premier emoji de la chaîne (ou "" s'il n'y en a pas). */
export function firstEmoji(input: unknown): string {
  if (typeof input !== "string") return "";
  const s = input.trim();
  if (!s) return "";
  const segments =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment)
      : Array.from(s);
  const found = segments.find((g) => PICTOGRAPHIC.test(g));
  return found ?? "";
}

export interface SanitizeOptions {
  /** Ids déjà présents dans la carte (modes « ajouter » et « développer »). */
  existingIds?: Iterable<string>;
  /** Où rattacher un nœud dont le parent est absent ou invalide. */
  fallbackParentId?: string;
  /** Mode « développer » : tout nouveau nœud de premier niveau est rattaché ici. */
  onlyUnder?: string;
  /** Nombre maximum de nœuds conservés. */
  maxNodes?: number;
}

interface WorkingNode {
  id: string;
  texte: string;
  parentId: string | null;
  couleur: string | null;
  emoji: string;
}

/**
 * Nettoie une carte renvoyée par Claude (ou importée) :
 * textes vides, ids en double, parents inconnus, cycles, couleurs et emojis invalides.
 *
 * - Sans `existingIds` (mode « remplacer ») : garantit exactement un nœud central.
 * - Avec `existingIds` (modes « ajouter » / « développer ») : ne renvoie que des nœuds
 *   nouveaux, chacun rattaché à un nœud existant ou à un autre nouveau nœud.
 */
export function sanitizeAiMap(raw: unknown, opts: SanitizeOptions = {}): AiMap {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const titreRaw = typeof obj.titre === "string" ? obj.titre.trim() : "";
  const list = Array.isArray(obj.noeuds) ? obj.noeuds : [];
  const existing = new Set(opts.existingIds ?? []);
  const appendMode = existing.size > 0;
  const maxNodes = opts.maxNodes ?? 200;

  const used = new Set<string>(existing);
  const nodes: WorkingNode[] = [];

  for (let i = 0; i < list.length && nodes.length < maxNodes; i++) {
    const item = list[i];
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const texte = String(it.texte ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT_LENGTH);
    if (!texte) continue;

    const rawId = String(it.id ?? "").trim();
    // En mode ajout, un id existant signifie que Claude a recopié un nœud déjà présent :
    // on l'ignore, et ses éventuels enfants restent rattachés au nœud existant.
    if (appendMode && rawId && existing.has(rawId)) continue;

    let id = rawId || `n${i + 1}`;
    if (used.has(id)) {
      let k = 2;
      while (used.has(`${id}_${k}`)) k++;
      id = `${id}_${k}`;
    }
    used.add(id);

    const parentRaw = it.parentId;
    const parentId = parentRaw === null || parentRaw === undefined || String(parentRaw).trim() === "" ? null : String(parentRaw).trim();

    nodes.push({
      id,
      texte,
      parentId,
      couleur: normalizeHex(it.couleur),
      emoji: firstEmoji(it.emoji),
    });
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  let rootId: string | null = null;

  if (appendMode) {
    const fallback = opts.onlyUnder ?? opts.fallbackParentId ?? null;
    for (const n of nodes) {
      const parentIsNew = n.parentId !== null && byId.has(n.parentId) && n.parentId !== n.id;
      if (opts.onlyUnder) {
        if (!parentIsNew) n.parentId = opts.onlyUnder;
      } else if (!parentIsNew && !(n.parentId !== null && existing.has(n.parentId))) {
        n.parentId = fallback;
      }
    }
    breakCycles(nodes, byId, () => fallback);
  } else {
    const root = nodes.find((n) => n.parentId === null);
    if (root) {
      rootId = root.id;
    } else {
      let id = "racine";
      while (byId.has(id)) id += "_";
      const created: WorkingNode = { id, texte: titreRaw || "Carte mentale", parentId: null, couleur: null, emoji: "" };
      nodes.unshift(created);
      byId.set(id, created);
      rootId = id;
    }
    for (const n of nodes) {
      if (n.id === rootId) continue;
      if (n.parentId === null || n.parentId === n.id || !byId.has(n.parentId)) n.parentId = rootId;
    }
    breakCycles(nodes, byId, () => rootId);
  }

  assignColors(nodes, byId, rootId);

  const titre = titreRaw || (rootId ? byId.get(rootId)!.texte : "") || "Carte mentale";
  return {
    titre: titre.slice(0, MAX_TEXT_LENGTH),
    noeuds: nodes.map((n) => ({
      id: n.id,
      texte: n.texte,
      parentId: n.parentId,
      couleur: n.couleur ?? BRANCH_COLORS[0],
      emoji: n.emoji,
    })),
  };
}

/** Coupe tout cycle parent → enfant en rattachant le nœud fautif au point de repli. */
function breakCycles(nodes: WorkingNode[], byId: Map<string, WorkingNode>, fallback: () => string | null) {
  for (const n of nodes) {
    const seen = new Set<string>([n.id]);
    let cur = n.parentId;
    while (cur !== null && byId.has(cur)) {
      if (seen.has(cur)) {
        n.parentId = fallback();
        break;
      }
      seen.add(cur);
      cur = byId.get(cur)!.parentId;
    }
  }
}

/** Complète les couleurs manquantes : une couleur par branche, héritée par les descendants. */
function assignColors(nodes: WorkingNode[], byId: Map<string, WorkingNode>, rootId: string | null) {
  let branchIndex = 0;
  const resolve = (n: WorkingNode, depth = 0): string => {
    if (n.couleur) return n.couleur;
    if (n.id === rootId) return (n.couleur = ROOT_COLOR);
    const parent = n.parentId ? byId.get(n.parentId) : undefined;
    if (!parent || parent.id === rootId || depth > nodes.length) {
      return (n.couleur = BRANCH_COLORS[branchIndex++ % BRANCH_COLORS.length]);
    }
    return (n.couleur = resolve(parent, depth + 1));
  };
  for (const n of nodes) resolve(n);
}
