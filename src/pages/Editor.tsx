import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Viewport,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { BRANCH_COLORS, type AiMap } from "../../shared/aiMap";
import { MapControls, SavedIndicator, SelectionBar, ToolboxFab } from "../components/CanvasOverlays";
import { ContextMenu, type MenuItem } from "../components/ContextMenu";
import { EditorContext, type EditorContextValue } from "../components/editorContext";
import { FloatingEdge } from "../components/FloatingEdge";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileJsonIcon,
  FitIcon,
  ImageIcon,
  LayoutIcon,
  MoonIcon,
  MoreIcon,
  PaletteIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  SiblingIcon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
} from "../components/Icons";
import { MindNodeComponent } from "../components/MindNode";
import { btn } from "../components/Modal";
import { PromptBar, PromptWarning, type GenerateMode } from "../components/PromptBar";
import { ActionSheet, BottomSheet, type SheetAction } from "../components/Sheet";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toasts";
import { Toolbox } from "../components/Toolbox";
import { openClasseur, openMode } from "../hooks/useHashRoute";
import { classeurOfMap, loadClasseur } from "../lib/docs";
import { useHistory, type Snapshot } from "../hooks/useHistory";
import { isPhone, useLayout } from "../hooks/useLayout";
import { useTheme } from "../hooks/useTheme";
import { ApiError, appendToMap, expandNode, generateMap, getHealth, type Health } from "../lib/api";
import { BG_PALETTE, contrastText } from "../lib/colors";
import { exportJson, exportPng, parseImport, readFile } from "../lib/exporters";
import { layoutTree, nodeSize, placeNewNodes } from "../lib/layout";
import {
  aiToFlow,
  buildTree,
  defaultNodeData,
  findRootId,
  flowToAi,
  makeEdge,
  newId,
  persistEdge,
  persistNode,
} from "../lib/mapModel";
import { loadMap, saveMap } from "../lib/storage";
import {
  DRAG_MIME,
  type DragPayload,
  type MindEdge,
  type MindEdgeData,
  type MindMap,
  type MindNode,
  type MindNodeData,
  type Shape,
} from "../types";

const nodeTypes = { mind: MindNodeComponent };
const edgeTypes = { floating: FloatingEdge };
const DEFAULT_NAMES = ["Nouvelle carte mentale", "Carte sans titre"];
const CANVAS_BG = { dark: "#0b0e17", light: "#f6f7fb" };
const QUICK_COLORS = ["#4f46e5", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#64748b"];
const LONG_PRESS_MS = 500;
const DISMISS_KEY = "mm-avertissement-masque";

type MenuState = { x: number; y: number } & ({ kind: "node"; nodeId: string } | { kind: "pane"; flowX: number; flowY: number });

const isEditableTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Attend que React Flow ait mesuré tous les nœuds (quelques images au plus). */
async function waitForMeasure(getNodes: () => MindNode[], ids?: Set<string>) {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    const nodes = getNodes().filter((n) => !ids || ids.has(n.id));
    if (nodes.length && nodes.every((n) => n.measured?.width && n.measured?.height)) return;
  }
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/** Retour depuis l'éditeur : vers le classeur de la carte s'il existe, sinon vers « Mes cartes ». */
function leaveEditor(mapId: string) {
  const classeurId = classeurOfMap(mapId);
  if (classeurId && loadClasseur(classeurId)) openClasseur(classeurId);
  else openMode("cartes");
}

export default function EditorPage({ mapId }: { mapId: string }) {
  const [initial] = useState(() => loadMap(mapId));
  if (!initial) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">Cette carte est introuvable.</p>
        <p className="text-sm text-slate-500">Elle a peut-être été supprimée, ou créée dans un autre navigateur.</p>
        <button className={btn.primary} onClick={() => openMode("cartes")}>
          <ArrowLeftIcon size={16} /> Retour à mes cartes
        </button>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <Editor initial={initial} />
    </ReactFlowProvider>
  );
}

function Editor({ initial }: { initial: MindMap }) {
  const layout = useLayout();
  const phone = isPhone(layout);
  const landscape = layout === "phone-landscape";
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const rf = useReactFlow<MindNode, MindEdge>();

  const [nodes, setNodes, onNodesChange] = useNodesState<MindNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<MindEdge>(initial.edges);
  const [name, setName] = useState(initial.name);
  const [nameDraft, setNameDraft] = useState(initial.name);
  const [edgeDefaults, setEdgeDefaults] = useState<MindEdgeData>(initial.edgeDefaults);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [exportAt, setExportAt] = useState<{ x: number; y: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 900);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nodeMenu, setNodeMenu] = useState<string | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ flowX: number; flowY: number } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);
  const abortRef = useRef<AbortController | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const lastTouchAt = useRef(0);

  // ---------- Historique ----------
  const getState = useCallback((): Snapshot => ({ nodes: rf.getNodes(), edges: rf.getEdges() }), [rf]);
  const setState = useCallback(
    (s: Snapshot) => {
      setEditingId(null);
      setNodes(s.nodes);
      setEdges(s.edges);
    },
    [setNodes, setEdges],
  );
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useHistory(getState, setState);

  // ---------- Sauvegarde automatique ----------
  const latest = useRef({ nodes, edges, name, edgeDefaults });
  latest.current = { nodes, edges, name, edgeDefaults };
  const viewportRef = useRef<Viewport | undefined>(initial.viewport);
  const updatedAtRef = useRef(initial.updatedAt);
  const serialize = (s: typeof latest.current) =>
    JSON.stringify({ n: s.name, d: s.edgeDefaults, nodes: s.nodes.map(persistNode), edges: s.edges.map(persistEdge) });
  const lastSaved = useRef(serialize(latest.current));

  const persist = useCallback(
    (bumpDate: boolean) => {
      const s = latest.current;
      if (bumpDate) updatedAtRef.current = Date.now();
      try {
        saveMap({
          id: initial.id,
          createdAt: initial.createdAt,
          updatedAt: updatedAtRef.current,
          name: s.name,
          nodes: s.nodes.map(persistNode),
          edges: s.edges.map(persistEdge),
          edgeDefaults: s.edgeDefaults,
          viewport: viewportRef.current,
        });
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Échec de la sauvegarde.");
        return false;
      }
    },
    [initial.id, initial.createdAt, toast],
  );

  const saveIfChanged = useCallback(() => {
    const snapshot = serialize(latest.current);
    if (snapshot === lastSaved.current) return;
    if (persist(true)) {
      lastSaved.current = snapshot;
      setSavedAt(Date.now());
    }
  }, [persist]);

  useEffect(() => {
    const t = setTimeout(saveIfChanged, 300);
    return () => clearTimeout(t);
  }, [nodes, edges, name, edgeDefaults, saveIfChanged]);

  useEffect(() => {
    // « pagehide » : seul événement fiable quand on quitte l'appli sur téléphone.
    const flush = () => saveIfChanged();
    const onHidden = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
  }, [saveIfChanged]);

  const viewportTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onMoveEnd = useCallback(
    (_: unknown, vp: Viewport) => {
      viewportRef.current = vp;
      clearTimeout(viewportTimer.current);
      // Mémorise le zoom / déplacement sans changer la date de modification.
      viewportTimer.current = setTimeout(() => persist(false), 500);
    },
    [persist],
  );

  // ---------- Serveur, connexion et avertissements ----------
  useEffect(() => {
    const refresh = () => getHealth().then(setHealth);
    const goOnline = () => {
      setOnline(true);
      void refresh();
    };
    const goOffline = () => setOnline(false);
    void refresh();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const warning = useMemo((): { key: string; text: string } | null => {
    if (!online) {
      return { key: "offline", text: "Hors connexion : tes cartes restent consultables et modifiables. Claude reviendra avec internet." };
    }
    if (health === null) {
      return { key: "server", text: "Serveur injoignable : la génération avec Claude est indisponible pour l'instant." };
    }
    if (health && !health.cleApi) {
      return { key: "nokey", text: "Génération avec Claude désactivée (aucune clé API configurée). Tout le reste fonctionne." };
    }
    return null;
  }, [online, health]);

  const dismissWarning = () => {
    if (!warning) return;
    setDismissed(warning.key);
    try {
      if (warning.key !== "offline") localStorage.setItem(DISMISS_KEY, warning.key);
    } catch {
      // Sans stockage, le message sera simplement réaffiché la prochaine fois.
    }
  };
  const visibleWarning = warning && warning.key !== dismissed ? warning : null;

  // Hauteur des barres flottantes du bas : les notifications s'affichent au-dessus.
  useEffect(() => {
    // En paysage, les barres sont sur les côtés : la notification peut descendre tout en bas.
    document.documentElement.style.setProperty("--mm-bottom-ui", layout === "phone" ? "76px" : "0px");
    return () => {
      document.documentElement.style.removeProperty("--mm-bottom-ui");
    };
  }, [layout]);

  // ---------- Dérivés ----------
  const rootId = useMemo(() => findRootId(nodes, edges), [nodes, edges]);
  const rootCenterX = useMemo(() => {
    const root = nodes.find((n) => n.id === rootId);
    return root ? root.position.x + nodeSize(root).width / 2 : 0;
  }, [nodes, rootId]);
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);
  const selectedIds = useMemo(() => new Set(selectedNodes.map((n) => n.id)), [selectedNodes]);

  const animate = useCallback(() => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 500);
  }, []);

  const selectOnly = useCallback(
    (id: string | null) => {
      setNodes((nds) => nds.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })));
      setEdges((eds) => eds.map((e) => (e.selected ? { ...e, selected: false } : e)));
    },
    [setNodes, setEdges],
  );

  // ---------- Garder un nœud visible (clavier, panneau du bas) ----------
  /**
   * Fait glisser la carte pour que le nœud soit entièrement visible : sous l'en-tête,
   * au-dessus du clavier (visualViewport) et du panneau du bas s'il est ouvert.
   */
  const revealNode = useCallback(
    (id: string, { zoomUp = false, duration = 220 } = {}) => {
      const node = rf.getInternalNode(id);
      const paneRect = mainRef.current?.getBoundingClientRect();
      if (!node || !paneRect || !node.measured.width || !node.measured.height) return;
      const vv = window.visualViewport;
      const sheetTop = document.querySelector('[aria-label="Boîte à outils"]')?.getBoundingClientRect().top ?? Infinity;
      const top = paneRect.top + 12;
      const bottom = Math.min(paneRect.bottom, vv ? vv.offsetTop + vv.height : window.innerHeight, sheetTop) - 12;
      const left = paneRect.left + 12;
      const right = paneRect.right - 12;
      if (bottom - top < 40) return;

      const v = rf.getViewport();
      const zoom = zoomUp ? Math.max(v.zoom, 0.9) : v.zoom;
      const { x: fx, y: fy } = node.internals.positionAbsolute;
      const w = node.measured.width * zoom;
      const h = node.measured.height * zoom;
      let sx = paneRect.left + v.x + fx * zoom; // position écran du nœud au zoom voulu
      let sy = paneRect.top + v.y + fy * zoom;
      if (zoom !== v.zoom) {
        // On zoome autour du centre du nœud.
        const cx = paneRect.left + v.x + (fx + node.measured.width / 2) * v.zoom;
        const cy = paneRect.top + v.y + (fy + node.measured.height / 2) * v.zoom;
        sx = cx - w / 2;
        sy = cy - h / 2;
      }
      let tx = sx;
      let ty = sy;
      if (w > right - left || sx < left || sx + w > right) tx = left + Math.max(0, (right - left - w) / 2);
      if (sy < top || sy + h > bottom) ty = top + Math.max(0, Math.min((bottom - top) * 0.3, bottom - top - h));
      if (tx === sx && ty === sy && zoom === v.zoom) return;
      rf.setViewport(
        { x: tx - paneRect.left - fx * zoom, y: ty - paneRect.top - fy * zoom, zoom },
        { duration },
      );
    },
    [rf],
  );

  useEffect(() => {
    if (!editingId || !phone) return;
    setSheetOpen(false);
    const run = () => revealNode(editingId, { zoomUp: true });
    const timers = [setTimeout(run, 60), setTimeout(run, 450)];
    const vv = window.visualViewport;
    vv?.addEventListener("resize", run);
    window.addEventListener("resize", run);
    return () => {
      timers.forEach(clearTimeout);
      vv?.removeEventListener("resize", run);
      window.removeEventListener("resize", run);
      // iOS peut laisser la page décalée après la fermeture du clavier.
      setTimeout(() => window.scrollY && window.scrollTo(0, 0), 100);
    };
  }, [editingId, phone, revealNode]);

  // ---------- Actions sur les nœuds ----------
  /** Insère un nouveau nœud relié à `parentId`, placé sans chevauchement, et passe en édition. */
  const insertNode = useCallback(
    (parentId: string, data: MindNodeData) => {
      const all = rf.getNodes();
      const eds = rf.getEdges();
      takeSnapshot();
      const child: MindNode = { id: newId(), type: "mind", position: { x: 0, y: 0 }, data, selected: true };
      const nextNodes = [...all.map((n) => (n.selected ? { ...n, selected: false } : n)), child];
      const nextEdges = [...eds.map((e) => (e.selected ? { ...e, selected: false } : e)), makeEdge(parentId, child.id, edgeDefaults)];
      const pos = placeNewNodes(nextNodes, nextEdges, new Set([child.id])).get(child.id);
      if (pos) child.position = pos;
      setNodes(nextNodes);
      setEdges(nextEdges);
      setEditingId(child.id);
    },
    [rf, takeSnapshot, edgeDefaults, setNodes, setEdges],
  );

  const addChild = useCallback(
    (parentId: string) => {
      const all = rf.getNodes();
      const eds = rf.getEdges();
      const parent = all.find((n) => n.id === parentId);
      if (!parent) return;
      if (parentId === findRootId(all, eds)) {
        const branches = eds.filter((e) => e.source === parentId || e.target === parentId).length;
        const bgColor = BRANCH_COLORS[branches % BRANCH_COLORS.length];
        insertNode(parentId, defaultNodeData({ bgColor, textColor: contrastText(bgColor), fontSize: 17, bold: true }));
      } else {
        insertNode(
          parentId,
          defaultNodeData({
            bgColor: parent.data.bgColor,
            textColor: parent.data.textColor,
            shape: parent.data.shape,
            fontSize: Math.min(parent.data.fontSize, 15),
          }),
        );
      }
    },
    [rf, insertNode],
  );

  /** Ajoute une idée au même niveau (même parent), avec le même style. */
  const addSibling = useCallback(
    (nodeId: string) => {
      const all = rf.getNodes();
      const eds = rf.getEdges();
      const { root, parent } = buildTree(all, eds);
      const parentId = parent.get(nodeId);
      const ref = all.find((n) => n.id === nodeId);
      if (!ref) return;
      if (!parentId) return addChild(nodeId); // nœud central (ou isolé) : on ajoute un enfant
      if (parentId === root) return addChild(root); // nouvelle branche principale : nouvelle couleur
      const { label: _label, emoji: _emoji, isRoot: _isRoot, loading: _loading, ...style } = ref.data;
      insertNode(parentId, defaultNodeData(style));
    },
    [rf, addChild, insertNode],
  );

  const commitLabel = useCallback(
    (id: string, label: string) => {
      setEditingId(null);
      const node = rf.getNode(id);
      if (!node || node.data.label === label) return;
      takeSnapshot();
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
    },
    [rf, takeSnapshot, setNodes],
  );

  const updateNodes = useCallback(
    (ids: Set<string>, patch: Partial<MindNodeData>, historyKey?: string) => {
      if (ids.size === 0) return;
      takeSnapshot(historyKey ? `${historyKey}:${[...ids].join(",")}` : undefined);
      const full = patch.bgColor && !("textColor" in patch) ? { ...patch, textColor: contrastText(patch.bgColor) } : patch;
      setNodes((nds) => nds.map((n) => (ids.has(n.id) ? { ...n, data: { ...n.data, ...full } } : n)));
    },
    [takeSnapshot, setNodes],
  );

  const createFreeNode = useCallback(
    (position: { x: number; y: number }, overrides: Partial<MindNodeData>) => {
      takeSnapshot();
      const data = defaultNodeData(overrides);
      if (overrides.shape === "postit" && !overrides.bgColor) {
        data.bgColor = "#fde68a";
        data.textColor = "#0f172a";
      }
      const node: MindNode = { id: newId(), type: "mind", position, data, selected: true };
      const size = nodeSize(node);
      node.position = { x: position.x - size.width / 2, y: position.y - size.height / 2 };
      setNodes((nds) => [...nds.map((n) => (n.selected ? { ...n, selected: false } : n)), node]);
      setEditingId(node.id);
    },
    [takeSnapshot, setNodes],
  );

  const viewportCenter = useCallback(() => {
    const r = mainRef.current?.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 600) / 2, y: (r?.top ?? 0) + (r?.height ?? 400) / 2 });
  }, [rf]);

  const deleteNode = useCallback((id: string) => void rf.deleteElements({ nodes: [{ id }] }), [rf]);

  /** Suppression animée : on marque les éléments, on laisse l'animation jouer, puis on supprime. */
  const onBeforeDelete = useCallback(
    async ({ nodes: dn, edges: de }: { nodes: MindNode[]; edges: MindEdge[] }) => {
      takeSnapshot();
      const nodeIds = new Set(dn.map((n) => n.id));
      const edgeIds = new Set(de.map((e) => e.id));
      setNodes((nds) => nds.map((n) => (nodeIds.has(n.id) ? { ...n, className: "mm-leaving" } : n)));
      setEdges((eds) =>
        eds.map((e) => (edgeIds.has(e.id) || nodeIds.has(e.source) || nodeIds.has(e.target) ? { ...e, className: "mm-leaving" } : e)),
      );
      await sleep(170);
      return true;
    },
    [takeSnapshot, setNodes, setEdges],
  );

  // ---------- Liens ----------
  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      const exists = rf
        .getEdges()
        .some((e) => (e.source === c.source && e.target === c.target) || (e.source === c.target && e.target === c.source));
      if (exists) return;
      takeSnapshot();
      setEdges((eds) => [...eds, makeEdge(c.source, c.target, edgeDefaults)]);
    },
    [rf, takeSnapshot, setEdges, edgeDefaults],
  );

  const applyEdgeStyle = useCallback(
    (patch: Partial<MindEdgeData>) => {
      const selected = rf.getEdges().filter((e) => e.selected);
      takeSnapshot("edge-style");
      if (selected.length) {
        const ids = new Set(selected.map((e) => e.id));
        setEdges((eds) => eds.map((e) => (ids.has(e.id) ? { ...e, data: { ...e.data!, ...patch } } : e)));
      } else {
        setEdgeDefaults((d) => ({ ...d, ...patch }));
        setEdges((eds) => eds.map((e) => ({ ...e, data: { ...e.data!, ...patch } })));
      }
    },
    [rf, takeSnapshot, setEdges],
  );

  const edgeStyleShown: MindEdgeData = selectedEdges[0]?.data ?? edgeDefaults;

  // ---------- Disposition et cadrage ----------
  const relayoutAll = useCallback(
    (withSnapshot = true) => {
      const all = rf.getNodes();
      if (all.length < 2) return;
      if (withSnapshot) takeSnapshot();
      const positions = layoutTree(all, rf.getEdges());
      animate();
      setNodes((nds) => nds.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n)));
      if (withSnapshot) setTimeout(() => rf.fitView({ duration: 500, padding: 0.15, maxZoom: 1.1 }), 480);
    },
    [rf, takeSnapshot, animate, setNodes],
  );

  const recenter = useCallback(() => void rf.fitView({ duration: 450, padding: phone ? 0.12 : 0.2, maxZoom: 1.2 }), [rf, phone]);

  // ---------- Claude ----------
  const depthMap = useCallback(() => {
    const { root, parent } = buildTree(rf.getNodes(), rf.getEdges());
    return (id: string) => {
      let d = 0;
      let cur: string | null | undefined = id;
      while (cur && cur !== root && d < 100) {
        cur = parent.get(cur);
        d++;
      }
      return d;
    };
  }, [rf]);

  /** Ajoute à la carte les nœuds proposés par Claude, sans déplacer l'existant. */
  const applyAddition = useCallback(
    async (ai: AiMap, toReal: Map<string, string>, focusId?: string) => {
      const all = rf.getNodes();
      const eds = rf.getEdges();
      const conv = aiToFlow(ai, edgeDefaults, { idMap: toReal, depthOf: depthMap(), rootRealId: findRootId(all, eds) });
      takeSnapshot();
      const newIds = new Set(conv.nodes.map((n) => n.id));
      const nextNodes = [...all.map((n) => (n.selected ? { ...n, selected: false } : n)), ...conv.nodes];
      const nextEdges = [...eds, ...conv.edges];
      const pos = placeNewNodes(nextNodes, nextEdges, newIds);
      setNodes(nextNodes.map((n) => (pos.has(n.id) ? { ...n, position: pos.get(n.id)! } : n)));
      setEdges(nextEdges);

      // Seconde passe avec les tailles réelles, puis cadrage sur les nouveautés.
      await waitForMeasure(rf.getNodes, newIds);
      const refined = placeNewNodes(rf.getNodes(), rf.getEdges(), newIds);
      animate();
      setNodes((nds) => nds.map((n) => (refined.has(n.id) ? { ...n, position: refined.get(n.id)! } : n)));
      const focus = [...newIds, ...(focusId ? [focusId] : [])].map((id) => ({ id }));
      setTimeout(() => rf.fitView({ nodes: focus, duration: 600, padding: 0.25, maxZoom: 1.1 }), 60);
      return conv.nodes.length;
    },
    [rf, edgeDefaults, depthMap, takeSnapshot, setNodes, setEdges, animate],
  );

  /** Erreur de génération claire, avec « Réessayer » quand ça a du sens. */
  const reportClaudeError = useCallback(
    (err: unknown, retry: () => void) => {
      const offline = !navigator.onLine;
      const message = offline
        ? "Pas de connexion internet : la génération avec Claude reviendra quand tu seras en ligne."
        : err instanceof Error
          ? err.message
          : "La génération a échoué.";
      const retryable = offline || !(err instanceof ApiError) || err.retryable;
      toast.error(message, retryable ? { label: "Réessayer", onClick: retry } : undefined);
    },
    [toast],
  );

  const onGenerate = useCallback(
    async (prompt: string, mode: GenerateMode): Promise<boolean> => {
      const retry = () => void onGenerateRef.current(prompt, mode);
      if (!navigator.onLine) {
        reportClaudeError(null, retry);
        return false;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setGenerating(true);
      setEditingId(null);
      try {
        if (mode === "replace") {
          const ai = await generateMap(prompt, controller.signal);
          const { nodes: newNodes, edges: newEdges } = aiToFlow(ai, edgeDefaults);
          const positions = layoutTree(newNodes, newEdges);
          takeSnapshot();
          setNodes(newNodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })));
          setEdges(newEdges);
          if (DEFAULT_NAMES.includes(latest.current.name)) {
            setName(ai.titre);
            setNameDraft(ai.titre);
          }
          await waitForMeasure(rf.getNodes);
          relayoutAll(false);
          setTimeout(() => rf.fitView({ duration: 700, padding: 0.12 }), 60);
          toast.success(`Carte générée : ${newNodes.length} idées. ${phone ? "Touche ↶ pour revenir en arrière." : "Ctrl + Z pour revenir en arrière."}`);
        } else {
          const { carte, toReal } = flowToAi(rf.getNodes(), rf.getEdges(), latest.current.name);
          const ai = await appendToMap(prompt, carte, controller.signal);
          const count = await applyAddition(ai, toReal);
          toast.success(`${count} idée${count > 1 ? "s" : ""} ajoutée${count > 1 ? "s" : ""} à la carte.`);
        }
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") toast.info("Génération annulée.");
        else reportClaudeError(err, retry);
        return false;
      } finally {
        abortRef.current = null;
        setGenerating(false);
      }
    },
    [rf, edgeDefaults, takeSnapshot, setNodes, setEdges, relayoutAll, applyAddition, toast, phone, reportClaudeError],
  );
  const onGenerateRef = useRef(onGenerate);
  onGenerateRef.current = onGenerate;

  const expandWithClaude = useCallback(
    async (nodeId: string) => {
      const retry = () => void expandRef.current(nodeId);
      if (!navigator.onLine) return reportClaudeError(null, retry);
      const setLoading = (loading: boolean) =>
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== nodeId) return n;
            const { loading: _old, ...data } = n.data;
            return { ...n, data: loading ? { ...data, loading: true } : data };
          }),
        );
      const { carte, toShort, toReal } = flowToAi(rf.getNodes(), rf.getEdges(), latest.current.name);
      const shortId = toShort.get(nodeId);
      if (!shortId) return;
      setLoading(true);
      try {
        const ai = await expandNode(carte, shortId);
        const count = await applyAddition(ai, toReal, nodeId);
        toast.success(`${count} sous-idée${count > 1 ? "s" : ""} ajoutée${count > 1 ? "s" : ""}.`);
      } catch (err) {
        reportClaudeError(err, retry);
      } finally {
        setLoading(false);
      }
    },
    [rf, setNodes, applyAddition, toast, reportClaudeError],
  );
  const expandRef = useRef(expandWithClaude);
  expandRef.current = expandWithClaude;

  // ---------- Glisser-déposer depuis la boîte à outils (souris) ----------
  const onDragOver = useCallback((e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      e.preventDefault();
      let payload: DragPayload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      const target = document
        .elementsFromPoint(e.clientX, e.clientY)
        .find((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains("react-flow__node"));
      const targetId = target?.dataset.id;

      const patch: Partial<MindNodeData> =
        payload.kind === "shape"
          ? { shape: payload.shape }
          : payload.kind === "emoji"
            ? { emoji: payload.emoji }
            : payload.target === "bg"
              ? { bgColor: payload.color }
              : { textColor: payload.color };

      if (targetId) {
        updateNodes(new Set([targetId]), patch);
      } else {
        if (payload.kind === "color" && payload.target === "text") return;
        createFreeNode(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }), patch);
      }
    },
    [rf, updateNodes, createFreeNode],
  );

  // ---------- Menus ----------
  const openNodeMenu = useCallback(
    (id: string) => {
      setEditingId(null);
      setSheetOpen(false);
      selectOnly(id);
      setNodeMenu(id);
    },
    [selectOnly],
  );

  const openToolbox = useCallback(() => {
    setNodeMenu(null);
    setSheetOpen(true);
    const sel = rf.getNodes().find((n) => n.selected);
    // Une fois le panneau ouvert, on remonte le nœud sélectionné au-dessus de lui.
    if (sel) setTimeout(() => revealNode(sel.id), 320);
  }, [rf, revealNode]);

  // Appui long au doigt : menu d'actions (sur un nœud ou sur le canevas).
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: { x: number; y: number; nodeId?: string } | null = null;
    const cancel = () => {
      clearTimeout(timer);
      start = null;
    };
    // Un deuxième doigt (pincement) annule l'appui long ; TouchEvent donne le nombre exact de doigts posés.
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) cancel();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      lastTouchAt.current = Date.now();
      if (!e.isPrimary) return cancel();
      const target = e.target as HTMLElement;
      if (target.closest("button, input, textarea, .react-flow__minimap")) return;
      const nodeEl = target.closest<HTMLElement>(".react-flow__node");
      if (!nodeEl && !target.closest(".react-flow__pane")) return;
      start = { x: e.clientX, y: e.clientY, nodeId: nodeEl?.dataset.id };
      timer = setTimeout(() => {
        const s = start;
        start = null;
        if (!s) return;
        navigator.vibrate?.(12);
        // Le menu s'ouvre sous le doigt : le « clic » envoyé en relevant le doigt ne doit rien déclencher.
        suppressClickUntil = Date.now() + 800;
        if (s.nodeId) openNodeMenu(s.nodeId);
        else {
          const p = rf.screenToFlowPosition({ x: s.x, y: s.y });
          setPaneMenu({ flowX: p.x, flowY: p.y });
        }
      }, LONG_PRESS_MS);
    };
    const onMove = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
    };
    const onUp = () => cancel();
    let suppressClickUntil = 0;
    const onClick = (e: MouseEvent) => {
      if (Date.now() < suppressClickUntil) {
        suppressClickUntil = 0;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("click", onClick, true);
    el.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      cancel();
      window.removeEventListener("click", onClick, true);
      el.removeEventListener("touchstart", onTouchStart, true);
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [rf, openNodeMenu]);

  // ---------- Raccourcis clavier (ordinateur) ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === "Escape") {
        setMenu(null);
        selectOnly(null);
      } else if (!mod && (e.key === "Tab" || e.key === "Enter" || e.key === "F2")) {
        if (e.target instanceof HTMLButtonElement && e.key !== "Tab") return;
        const sel = rf.getNodes().filter((n) => n.selected);
        if (sel.length !== 1) return;
        e.preventDefault();
        if (e.key === "Tab") addChild(sel[0].id);
        else if (e.key === "Enter") addSibling(sel[0].id);
        else setEditingId(sel[0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, addChild, addSibling, rf, selectOnly]);

  // ---------- Import / export ----------
  const currentMap = (): MindMap => ({
    id: initial.id,
    name,
    createdAt: initial.createdAt,
    updatedAt: Date.now(),
    nodes: rf.getNodes().map(persistNode),
    edges: rf.getEdges().map(persistEdge),
    edgeDefaults,
  });

  const onExportPng = async () => {
    setEditingId(null);
    try {
      await exportPng(rf.getNodesBounds(rf.getNodes()), name, CANVAS_BG[theme]);
      toast.success("Image PNG exportée.");
    } catch (err) {
      toast.error(err instanceof Error ? `Export PNG impossible : ${err.message}` : "Export PNG impossible.");
    }
  };

  const onImportFile = async (file: File) => {
    try {
      const content = parseImport(await readFile(file), edgeDefaults);
      takeSnapshot();
      setNodes(content.nodes);
      setEdges(content.edges);
      setEdgeDefaults(content.edgeDefaults);
      setTimeout(() => rf.fitView({ duration: 600, padding: 0.15 }), 80);
      toast.success(`« ${content.name} » importée dans cette carte. ${phone ? "Touche ↶ pour annuler." : "Ctrl + Z pour annuler."}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    }
  };

  const commitName = () => {
    const value = nameDraft.trim();
    if (!value || value === name) {
      setNameDraft(name);
      return;
    }
    // Le nœud central suit le nom s'il portait encore l'ancien.
    const root = rf.getNodes().find((n) => n.id === rootId);
    if (root && root.data.label === name) {
      takeSnapshot();
      setNodes((nds) => nds.map((n) => (n.id === root.id ? { ...n, data: { ...n.data, label: value } } : n)));
    }
    setName(value);
  };

  // ---------- Contenu des menus ----------
  const menuItems = (m: MenuState): MenuItem[] => {
    if (m.kind === "pane") {
      return [
        { label: "Ajouter une idée ici", icon: <PlusIcon size={16} />, onSelect: () => createFreeNode({ x: m.flowX, y: m.flowY }, {}) },
        { label: "Organiser automatiquement", icon: <LayoutIcon size={16} />, onSelect: () => relayoutAll() },
        { label: "Recentrer la carte", icon: <FitIcon size={16} />, onSelect: recenter },
      ];
    }
    const node = rf.getNode(m.nodeId);
    return [
      {
        label: "Développer avec Claude",
        icon: <SparklesIcon size={16} />,
        accent: true,
        disabled: !!node?.data.loading,
        onSelect: () => void expandWithClaude(m.nodeId),
      },
      { label: "Ajouter un enfant (Tab)", icon: <PlusIcon size={16} />, onSelect: () => addChild(m.nodeId) },
      { label: "Ajouter un frère (Entrée)", icon: <SiblingIcon size={16} />, onSelect: () => addSibling(m.nodeId) },
      { label: "Modifier le texte (F2)", icon: <PencilIcon size={16} />, onSelect: () => setEditingId(m.nodeId) },
      { label: "Supprimer (Suppr)", icon: <TrashIcon size={16} />, danger: true, onSelect: () => deleteNode(m.nodeId) },
    ];
  };

  const menuNode = nodeMenu ? nodes.find((n) => n.id === nodeMenu) : undefined;
  const nodeActions = (id: string): SheetAction[] => [
    { label: "Modifier le texte", icon: <PencilIcon />, onSelect: () => setEditingId(id) },
    { label: "Ajouter un enfant", icon: <PlusIcon />, onSelect: () => addChild(id) },
    ...(id !== rootId ? [{ label: "Ajouter un frère", icon: <SiblingIcon />, onSelect: () => addSibling(id) }] : []),
    {
      label: "Développer avec Claude",
      icon: <SparklesIcon />,
      accent: true,
      disabled: !!menuNode?.data.loading,
      onSelect: () => void expandWithClaude(id),
    },
    { label: "Forme, emoji, texte…", icon: <PaletteIcon />, onSelect: openToolbox },
    { label: "Supprimer", icon: <TrashIcon />, danger: true, onSelect: () => deleteNode(id) },
  ];

  const moreActions: SheetAction[] = [
    { label: "Organiser automatiquement", icon: <LayoutIcon />, onSelect: () => relayoutAll() },
    { label: "Recentrer la carte", icon: <FitIcon />, onSelect: recenter },
    { label: "Exporter en image (PNG)", icon: <ImageIcon />, onSelect: () => void onExportPng() },
    { label: "Exporter en fichier JSON", icon: <FileJsonIcon />, onSelect: () => exportJson(currentMap()) },
    { label: "Importer un fichier JSON", icon: <UploadIcon />, onSelect: () => importRef.current?.click() },
    theme === "dark"
      ? { label: "Passer en mode clair", icon: <SunIcon />, onSelect: toggle }
      : { label: "Passer en mode sombre", icon: <MoonIcon />, onSelect: toggle },
  ];

  const ctx = useMemo<EditorContextValue>(
    () => ({ addChild, commitLabel, editingId, setEditingId, rootCenterX }),
    [addChild, commitLabel, editingId, rootCenterX],
  );

  const toolbox = (variant: "panel" | "sheet") => (
    <Toolbox
      variant={variant}
      selection={selectedNodes[0]?.data ?? null}
      selectedNodeCount={selectedNodes.length}
      selectedEdgeCount={selectedEdges.length}
      edgeStyle={edgeStyleShown}
      onNodeStyle={(patch, key) => updateNodes(selectedIds, patch, key)}
      onEdgeStyle={applyEdgeStyle}
      onAddShape={(shape: Shape) => createFreeNode(viewportCenter(), { shape })}
      onNeedSelection={() =>
        toast.info(phone ? "Touche d'abord un nœud pour le sélectionner." : "Sélectionne d'abord un nœud (ou glisse l'élément sur le canevas).")
      }
    />
  );

  const selectionLabel =
    selectedNodes.length === 1
      ? `« ${selectedNodes[0].data.label.slice(0, 24) || "…"} »`
      : selectedNodes.length > 1
        ? `${selectedNodes.length} nœuds`
        : selectedEdges.length
          ? `${selectedEdges.length} lien${selectedEdges.length > 1 ? "s" : ""}`
          : "rien de sélectionné";

  const promptBar = (variant: "floating" | "compact") => (
    <PromptBar loading={generating} onGenerate={onGenerate} onCancel={() => abortRef.current?.abort()} variant={variant} />
  );

  const importInput = (
    <input
      ref={importRef}
      type="file"
      accept="application/json,.json"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void onImportFile(f);
        e.target.value = "";
      }}
    />
  );

  const nameInput = (
    <input
      value={nameDraft}
      onChange={(e) => setNameDraft(e.target.value)}
      onBlur={commitName}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setNameDraft(name);
          setTimeout(() => (document.activeElement as HTMLElement | null)?.blur());
        }
      }}
      enterKeyHint="done"
      aria-label="Nom de la carte"
      className={`h-10 min-w-0 truncate rounded-lg border border-transparent bg-transparent px-2 text-base font-semibold outline-none hover:border-slate-200 focus:border-indigo-400 dark:hover:border-slate-700 ${
        landscape ? "w-36 shrink-0" : "max-w-xs flex-1"
      }`}
    />
  );

  const showSelectionBar = phone && selectedNodes.length === 1 && !editingId && !sheetOpen && !nodeMenu;
  const phoneOverlaysVisible = phone && !editingId;

  return (
    <EditorContext.Provider value={ctx}>
      <div className="flex h-dvh flex-col overflow-hidden">
        {/* ---------- En-tête ---------- */}
        <header
          className="z-20 shrink-0 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-[#0f1320]/85"
          style={{ paddingTop: "var(--safe-top)", paddingLeft: "max(0.25rem, var(--safe-left))", paddingRight: "max(0.25rem, var(--safe-right))" }}
        >
          <div className={`flex items-center gap-1 ${phone ? "h-13" : "h-14 px-2 gap-2"}`}>
            <button className={btn.icon} onClick={() => leaveEditor(initial.id)} title="Retour" aria-label="Retour">
              <ArrowLeftIcon />
            </button>
            {nameInput}
            {landscape && <div className="min-w-0 flex-1">{promptBar("compact")}</div>}
            {!phone && <SavedIndicator at={savedAt} className="hidden sm:inline-flex" />}

            <div className={`flex shrink-0 items-center gap-0.5 ${landscape ? "" : "ml-auto"}`}>
              <button className={btn.icon} onClick={undo} disabled={!canUndo} title="Annuler (Ctrl + Z)" aria-label="Annuler">
                <UndoIcon />
              </button>
              <button className={btn.icon} onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl + Y)" aria-label="Rétablir">
                <RedoIcon />
              </button>
              {phone ? (
                <button className={btn.icon} onClick={() => setMoreOpen(true)} title="Plus d'actions" aria-label="Plus d'actions">
                  <MoreIcon />
                </button>
              ) : (
                <>
                  <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-800" />
                  <div className="relative">
                    <button
                      className={`${btn.icon} w-auto gap-1.5 px-2.5 text-sm tap:w-auto`}
                      // Empêche la fermeture « clic à l'extérieur » du menu pour que le bouton serve de bascule.
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setExportAt((open) => (open ? null : { x: r.left, y: r.bottom + 6 }));
                      }}
                      aria-expanded={!!exportAt}
                      aria-haspopup="menu"
                    >
                      <DownloadIcon size={17} />
                      <span className="hidden md:inline">Exporter</span>
                    </button>
                    {exportAt && (
                      <ContextMenu
                        x={exportAt.x}
                        y={exportAt.y}
                        onClose={() => setExportAt(null)}
                        items={[
                          { label: "Image PNG", icon: <ImageIcon size={16} />, onSelect: () => void onExportPng() },
                          { label: "Fichier JSON", icon: <FileJsonIcon size={16} />, onSelect: () => exportJson(currentMap()) },
                          { label: "Importer un JSON…", icon: <UploadIcon size={16} />, onSelect: () => importRef.current?.click() },
                        ]}
                      />
                    )}
                  </div>
                  <ThemeToggle theme={theme} onToggle={toggle} />
                  <button
                    className={`${btn.icon} ${panelOpen ? "text-indigo-600 dark:text-indigo-300" : ""}`}
                    onClick={() => setPanelOpen((o) => !o)}
                    title={panelOpen ? "Masquer la boîte à outils" : "Afficher la boîte à outils"}
                    aria-label="Boîte à outils"
                    aria-pressed={panelOpen}
                  >
                    <PanelRightIcon />
                  </button>
                </>
              )}
            </div>
            {importInput}
          </div>
          {/* Pendant la saisie dans un nœud, on libère la place pour le clavier. */}
          {layout === "phone" && !editingId && <div className="px-1 pb-1.5">{promptBar("compact")}</div>}
          {phone && !editingId && visibleWarning && (
            <div className="px-1 pb-1.5">
              <PromptWarning message={visibleWarning.text} onDismiss={dismissWarning} compact />
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          {/* ---------- Canevas ---------- */}
          <main ref={mainRef} className="relative min-w-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
            {!phone && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex flex-col items-center px-3">
                {promptBar("floating")}
                {visibleWarning && <PromptWarning message={visibleWarning.text} onDismiss={dismissWarning} />}
              </div>
            )}
            {phone && (
              <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
                <SavedIndicator at={savedAt} className="bg-white/90 shadow-sm dark:bg-slate-900/90" />
              </div>
            )}

            <ReactFlow<MindNode, MindEdge>
              className={animating ? "mm-animate" : ""}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              colorMode={theme}
              connectionMode={ConnectionMode.Loose}
              connectOnClick={false}
              deleteKeyCode={["Delete", "Backspace"]}
              zoomOnDoubleClick={false}
              // Au doigt, un léger tremblement ne doit ni lancer un déplacement ni annuler un toucher.
              nodeDragThreshold={phone ? 6 : 1}
              nodeClickDistance={phone ? 10 : 2}
              paneClickDistance={phone ? 10 : 2}
              minZoom={0.1}
              maxZoom={2.5}
              defaultViewport={initial.viewport}
              fitView={!initial.viewport}
              fitViewOptions={{ padding: phone ? 0.15 : 0.3, maxZoom: 1.1 }}
              attributionPosition={phone ? "top-right" : "bottom-right"}
              onBeforeDelete={onBeforeDelete}
              onNodeDragStart={() => takeSnapshot()}
              onSelectionDragStart={() => takeSnapshot()}
              onMoveEnd={onMoveEnd}
              onNodeContextMenu={(e, node) => {
                e.preventDefault();
                if (Date.now() - lastTouchAt.current < 1500) return; // déjà géré par l'appui long
                setMenu({ kind: "node", nodeId: node.id, x: e.clientX, y: e.clientY });
              }}
              onPaneContextMenu={(e) => {
                e.preventDefault();
                if (Date.now() - lastTouchAt.current < 1500) return;
                const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
                setMenu({ kind: "pane", x: e.clientX, y: e.clientY, flowX: p.x, flowY: p.y });
              }}
              onPaneClick={() => {
                setMenu(null);
                setSheetOpen(false);
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
              {!phone && (
                <MiniMap
                  position="bottom-right"
                  pannable
                  zoomable
                  nodeColor={(n) => (n as MindNode).data.bgColor}
                  nodeBorderRadius={6}
                  ariaLabel="Mini-carte"
                />
              )}
            </ReactFlow>

            {/* Contrôles de la carte */}
            {!phone && (
              <div className="absolute bottom-3 left-3 z-10">
                <MapControls
                  vertical
                  showZoom
                  onZoomIn={() => void rf.zoomIn({ duration: 200 })}
                  onZoomOut={() => void rf.zoomOut({ duration: 200 })}
                  onFit={recenter}
                  onLayout={() => relayoutAll()}
                />
              </div>
            )}
            {phoneOverlaysVisible && (
              <>
                <div
                  className="absolute z-10"
                  style={{ left: "calc(0.75rem + var(--safe-left))", bottom: "calc(0.75rem + var(--safe-bottom))" }}
                >
                  {showSelectionBar ? (
                    <SelectionBar
                      onAddChild={() => addChild(selectedNodes[0].id)}
                      onEdit={() => setEditingId(selectedNodes[0].id)}
                      onStyle={openToolbox}
                      onMore={() => openNodeMenu(selectedNodes[0].id)}
                    />
                  ) : (
                    !sheetOpen && (
                      <MapControls
                        vertical={false}
                        showZoom={false}
                        onZoomIn={() => void rf.zoomIn()}
                        onZoomOut={() => void rf.zoomOut()}
                        onFit={recenter}
                        onLayout={() => relayoutAll()}
                      />
                    )
                  )}
                </div>
                {!sheetOpen && (
                  <div
                    className="absolute z-10"
                    style={{ right: "calc(0.75rem + var(--safe-right))", bottom: "calc(0.75rem + var(--safe-bottom))" }}
                  >
                    <ToolboxFab onClick={openToolbox} />
                  </div>
                )}
              </>
            )}
          </main>

          {/* ---------- Boîte à outils (ordinateur) ---------- */}
          {!phone && (
            <aside
              className={`shrink-0 overflow-hidden border-l border-slate-200 bg-white/70 transition-[width] duration-300 dark:border-slate-800 dark:bg-[#0f1320]/70 ${
                panelOpen ? "w-72" : "w-0 border-l-0"
              }`}
              aria-hidden={!panelOpen}
              inert={!panelOpen}
            >
              <div className="h-full w-72">{toolbox("panel")}</div>
            </aside>
          )}
        </div>
      </div>

      {/* ---------- Téléphone : panneaux du bas ---------- */}
      {phone && (
        <>
          <BottomSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title={<>Boîte à outils <span className="font-normal text-slate-500 dark:text-slate-400">· {selectionLabel}</span></>}
            label="Boîte à outils"
            maxHeight={landscape ? "78dvh" : "58dvh"}
          >
            {toolbox("sheet")}
          </BottomSheet>
          <ActionSheet
            open={!!menuNode}
            onClose={() => setNodeMenu(null)}
            title={menuNode ? `« ${menuNode.data.label.slice(0, 40) || "…"} »` : ""}
            actions={menuNode ? nodeActions(menuNode.id) : []}
            header={
              menuNode && (
                <div className="flex flex-wrap gap-1 px-3 pb-1" role="group" aria-label="Couleur du nœud">
                  {QUICK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Couleur ${c}`}
                      onClick={() => {
                        updateNodes(new Set([menuNode.id]), { bgColor: c });
                        setNodeMenu(null);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
                    >
                      <span
                        className={`block h-8 w-8 rounded-full border border-black/10 dark:border-white/15 ${
                          menuNode.data.bgColor === c ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""
                        }`}
                        style={{ background: c }}
                      />
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Plus de couleurs"
                    onClick={openToolbox}
                    className="flex h-11 w-11 items-center justify-center rounded-full active:scale-90"
                  >
                    <span
                      className="block h-8 w-8 rounded-full border border-black/10 dark:border-white/15"
                      style={{ background: `conic-gradient(${BG_PALETTE.slice(0, 13).join(",")})` }}
                    />
                  </button>
                </div>
              )
            }
          />
          <ActionSheet
            open={!!paneMenu}
            onClose={() => setPaneMenu(null)}
            title="Carte"
            actions={
              paneMenu
                ? [
                    { label: "Ajouter une idée ici", icon: <PlusIcon />, onSelect: () => createFreeNode({ x: paneMenu.flowX, y: paneMenu.flowY }, {}) },
                    { label: "Organiser automatiquement", icon: <LayoutIcon />, onSelect: () => relayoutAll() },
                    { label: "Recentrer la carte", icon: <FitIcon />, onSelect: recenter },
                  ]
                : []
            }
          />
          <ActionSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={name} actions={moreActions} />
        </>
      )}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={() => setMenu(null)} />}
    </EditorContext.Provider>
  );
}
