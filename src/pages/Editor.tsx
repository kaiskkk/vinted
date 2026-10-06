import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
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
import { BRANCH_COLORS } from "../../shared/aiMap";
import { ContextMenu, type MenuItem } from "../components/ContextMenu";
import { EditorContext, type EditorContextValue } from "../components/editorContext";
import { FloatingEdge } from "../components/FloatingEdge";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileJsonIcon,
  ImageIcon,
  LayoutIcon,
  PanelRightIcon,
  PencilIcon,
  PlusIcon,
  RedoIcon,
  SparklesIcon,
  TrashIcon,
  UndoIcon,
  UploadIcon,
  CheckIcon,
} from "../components/Icons";
import { MindNodeComponent } from "../components/MindNode";
import { btn } from "../components/Modal";
import { PromptBar, type GenerateMode } from "../components/PromptBar";
import { ThemeToggle } from "../components/ThemeToggle";
import { useToast } from "../components/Toasts";
import { Toolbox } from "../components/Toolbox";
import { goHome } from "../hooks/useHashRoute";
import { useHistory, type Snapshot } from "../hooks/useHistory";
import { useTheme } from "../hooks/useTheme";
import { appendToMap, expandNode, generateMap, getHealth } from "../lib/api";
import { contrastText } from "../lib/colors";
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
import { DRAG_MIME, type DragPayload, type MindEdge, type MindEdgeData, type MindMap, type MindNode, type MindNodeData, type Shape } from "../types";
import type { AiMap } from "../../shared/aiMap";

const nodeTypes = { mind: MindNodeComponent };
const edgeTypes = { floating: FloatingEdge };
const DEFAULT_NAMES = ["Nouvelle carte mentale", "Carte sans titre"];
const CANVAS_BG = { dark: "#0b0e17", light: "#f6f7fb" };

type MenuState = { x: number; y: number } & ({ kind: "node"; nodeId: string } | { kind: "pane"; flowX: number; flowY: number });

const isEditableTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/** Attend que React Flow ait mesuré tous les nœuds (quelques images au plus). */
async function waitForMeasure(getNodes: () => MindNode[], ids?: Set<string>) {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    const nodes = getNodes().filter((n) => !ids || ids.has(n.id));
    if (nodes.length && nodes.every((n) => n.measured?.width && n.measured?.height)) return;
  }
}

export default function EditorPage({ mapId }: { mapId: string }) {
  const [initial] = useState(() => loadMap(mapId));
  if (!initial) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">Cette carte est introuvable.</p>
        <p className="text-sm text-slate-500">Elle a peut-être été supprimée, ou créée dans un autre navigateur.</p>
        <button className={btn.primary} onClick={goHome}>
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
  const [generating, setGenerating] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

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
    window.addEventListener("beforeunload", saveIfChanged);
    return () => {
      window.removeEventListener("beforeunload", saveIfChanged);
      saveIfChanged();
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

  // ---------- Vérification du serveur ----------
  useEffect(() => {
    getHealth().then((h) => {
      if (!h) setWarning("Serveur local injoignable : lance « npm run dev » pour activer la génération avec Claude.");
      else if (!h.cleApi) setWarning("Clé API absente : ajoute ANTHROPIC_API_KEY dans le fichier .env puis relance le serveur.");
    });
  }, []);

  // ---------- Dérivés ----------
  const rootId = useMemo(() => findRootId(nodes, edges), [nodes, edges]);
  const rootCenterX = useMemo(() => {
    const root = nodes.find((n) => n.id === rootId);
    return root ? root.position.x + nodeSize(root).width / 2 : 0;
  }, [nodes, rootId]);
  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);

  const animate = useCallback(() => {
    setAnimating(true);
    setTimeout(() => setAnimating(false), 500);
  }, []);

  // ---------- Actions sur les nœuds ----------
  const addChild = useCallback(
    (parentId: string) => {
      const all = rf.getNodes();
      const eds = rf.getEdges();
      const parent = all.find((n) => n.id === parentId);
      if (!parent) return;
      takeSnapshot();
      const isRootParent = parentId === findRootId(all, eds);
      let data: MindNodeData;
      if (isRootParent) {
        const branches = eds.filter((e) => e.source === parentId || e.target === parentId).length;
        const bgColor = BRANCH_COLORS[branches % BRANCH_COLORS.length];
        data = defaultNodeData({ bgColor, textColor: contrastText(bgColor), fontSize: 17, bold: true });
      } else {
        data = defaultNodeData({
          bgColor: parent.data.bgColor,
          textColor: parent.data.textColor,
          shape: parent.data.shape,
          fontSize: Math.min(parent.data.fontSize, 15),
        });
      }
      const child: MindNode = { id: newId(), type: "mind", position: { x: 0, y: 0 }, data, selected: true };
      const nextNodes = [...all.map((n) => (n.selected ? { ...n, selected: false } : n)), child];
      const nextEdges = [...eds, makeEdge(parentId, child.id, edgeDefaults)];
      const pos = placeNewNodes(nextNodes, nextEdges, new Set([child.id])).get(child.id);
      if (pos) child.position = pos;
      setNodes(nextNodes);
      setEdges(nextEdges);
      setEditingId(child.id);
    },
    [rf, takeSnapshot, edgeDefaults, setNodes, setEdges],
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
    const el = document.querySelector(".react-flow");
    const r = el?.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 600) / 2, y: (r?.top ?? 0) + (r?.height ?? 400) / 2 });
  }, [rf]);

  const deleteNode = useCallback((id: string) => void rf.deleteElements({ nodes: [{ id }] }), [rf]);

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

  // ---------- Disposition ----------
  const relayoutAll = useCallback(
    (withSnapshot = true) => {
      const all = rf.getNodes();
      if (all.length < 2) return;
      if (withSnapshot) takeSnapshot();
      const positions = layoutTree(all, rf.getEdges());
      animate();
      setNodes((nds) => nds.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n)));
    },
    [rf, takeSnapshot, animate, setNodes],
  );

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

  const onGenerate = useCallback(
    async (prompt: string, mode: GenerateMode): Promise<boolean> => {
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
          toast.success(`Carte générée : ${newNodes.length} idées. Ctrl + Z pour revenir en arrière.`);
        } else {
          const { carte, toReal } = flowToAi(rf.getNodes(), rf.getEdges(), latest.current.name);
          const ai = await appendToMap(prompt, carte, controller.signal);
          const count = await applyAddition(ai, toReal);
          toast.success(`${count} idée${count > 1 ? "s" : ""} ajoutée${count > 1 ? "s" : ""} à la carte.`);
        }
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          toast.info("Génération annulée.");
        } else {
          toast.error(err instanceof Error ? err.message : "La génération a échoué.");
        }
        return false;
      } finally {
        abortRef.current = null;
        setGenerating(false);
      }
    },
    [rf, edgeDefaults, takeSnapshot, setNodes, setEdges, relayoutAll, applyAddition, toast],
  );

  const expandWithClaude = useCallback(
    async (nodeId: string) => {
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
        toast.error(err instanceof Error ? err.message : "Le développement a échoué.");
      } finally {
        setLoading(false);
      }
    },
    [rf, setNodes, applyAddition, toast],
  );

  // ---------- Glisser-déposer depuis la boîte à outils ----------
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

  // ---------- Raccourcis clavier ----------
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
      } else if (!mod && (e.key === "Tab" || e.key === "Enter" || e.key === "F2")) {
        if (e.target instanceof HTMLButtonElement && e.key !== "Tab") return;
        const sel = rf.getNodes().filter((n) => n.selected);
        if (sel.length !== 1) return;
        e.preventDefault();
        if (e.key === "Tab") addChild(sel[0].id);
        else setEditingId(sel[0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, addChild, rf]);

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
      toast.success(`« ${content.name} » importée dans cette carte. Ctrl + Z pour annuler.`);
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

  // ---------- Menu contextuel ----------
  const menuItems = (m: MenuState): MenuItem[] => {
    if (m.kind === "pane") {
      return [
        {
          label: "Ajouter une idée ici",
          icon: <PlusIcon size={16} />,
          onSelect: () => createFreeNode({ x: m.flowX, y: m.flowY }, {}),
        },
        { label: "Réorganiser la carte", icon: <LayoutIcon size={16} />, onSelect: () => relayoutAll() },
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
      { label: "Ajouter un enfant", icon: <PlusIcon size={16} />, onSelect: () => addChild(m.nodeId) },
      { label: "Modifier le texte", icon: <PencilIcon size={16} />, onSelect: () => setEditingId(m.nodeId) },
      { label: "Supprimer", icon: <TrashIcon size={16} />, danger: true, onSelect: () => deleteNode(m.nodeId) },
    ];
  };

  const ctx = useMemo<EditorContextValue>(
    () => ({ addChild, commitLabel, editingId, setEditingId, rootCenterX }),
    [addChild, commitLabel, editingId, rootCenterX],
  );

  const selectedIds = useMemo(() => new Set(selectedNodes.map((n) => n.id)), [selectedNodes]);

  return (
    <EditorContext.Provider value={ctx}>
      <div className="flex h-full flex-col">
        {/* ---------- En-tête ---------- */}
        <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/80 px-3 backdrop-blur dark:border-slate-800 dark:bg-[#0f1320]/80">
          <button className={btn.icon} onClick={goHome} title="Retour à mes cartes" aria-label="Retour à mes cartes">
            <ArrowLeftIcon />
          </button>
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
            aria-label="Nom de la carte"
            className="min-w-0 max-w-xs flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-base font-semibold outline-none hover:border-slate-200 focus:border-indigo-400 dark:hover:border-slate-700"
          />
          <span
            key={savedAt ?? 0}
            className="hidden items-center gap-1 text-xs text-slate-400 sm:inline-flex animate-fade-in"
            title="Chaque modification est enregistrée automatiquement dans ce navigateur"
          >
            <CheckIcon size={13} /> Enregistré
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button className={btn.icon} onClick={undo} disabled={!canUndo} title="Annuler (Ctrl + Z)" aria-label="Annuler">
              <UndoIcon />
            </button>
            <button className={btn.icon} onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl + Y)" aria-label="Rétablir">
              <RedoIcon />
            </button>
            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-800" />
            <button className={btn.icon} onClick={() => relayoutAll()} title="Réorganiser automatiquement" aria-label="Réorganiser">
              <LayoutIcon />
            </button>
            <div className="relative">
              <button
                className={`${btn.icon} w-auto gap-1.5 px-2.5 text-sm`}
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
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* ---------- Canevas ---------- */}
          <main className="relative min-w-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
              <PromptBar
                loading={generating}
                onGenerate={onGenerate}
                onCancel={() => abortRef.current?.abort()}
                warning={warning}
              />
            </div>
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
              deleteKeyCode={["Delete", "Backspace"]}
              zoomOnDoubleClick={false}
              minZoom={0.1}
              maxZoom={2.5}
              defaultViewport={initial.viewport}
              fitView={!initial.viewport}
              fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
              onBeforeDelete={async () => {
                takeSnapshot();
                return true;
              }}
              onNodeDragStart={() => takeSnapshot()}
              onSelectionDragStart={() => takeSnapshot()}
              onMoveEnd={onMoveEnd}
              onNodeContextMenu={(e, node) => {
                e.preventDefault();
                setMenu({ kind: "node", nodeId: node.id, x: e.clientX, y: e.clientY });
              }}
              onPaneContextMenu={(e) => {
                e.preventDefault();
                const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
                setMenu({ kind: "pane", x: e.clientX, y: e.clientY, flowX: p.x, flowY: p.y });
              }}
              onPaneClick={() => setMenu(null)}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                nodeColor={(n) => (n as MindNode).data.bgColor}
                nodeBorderRadius={6}
                ariaLabel="Mini-carte"
              />
            </ReactFlow>
          </main>

          {/* ---------- Boîte à outils ---------- */}
          <aside
            className={`shrink-0 overflow-hidden border-l border-slate-200 bg-white/70 transition-[width] duration-300 dark:border-slate-800 dark:bg-[#0f1320]/70 ${
              panelOpen ? "w-72" : "w-0 border-l-0"
            }`}
            aria-hidden={!panelOpen}
          >
            <div className="h-full w-72">
              <Toolbox
                selection={selectedNodes[0]?.data ?? null}
                selectedNodeCount={selectedNodes.length}
                selectedEdgeCount={selectedEdges.length}
                edgeStyle={edgeStyleShown}
                onNodeStyle={(patch, key) => updateNodes(selectedIds, patch, key)}
                onEdgeStyle={applyEdgeStyle}
                onAddShape={(shape: Shape) => createFreeNode(viewportCenter(), { shape })}
                onNeedSelection={() => toast.info("Sélectionne d'abord un nœud (ou glisse l'élément sur le canevas).")}
              />
            </div>
          </aside>
        </div>
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={() => setMenu(null)} />}
    </EditorContext.Provider>
  );
}
