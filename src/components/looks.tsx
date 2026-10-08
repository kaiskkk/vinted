// Identité visuelle de chaque mode et de chaque type de document : nom, icône, couleurs.
import type { ReactNode } from "react";
import type { Mode } from "../hooks/useHashRoute";
import type { ItemKind } from "../lib/library";
import {
  AlignLeftIcon,
  CalendarIcon,
  CardsIcon,
  FileTextIcon,
  FolderIcon,
  NetworkIcon,
  NotebookPenIcon,
  QuizIcon,
  TargetIcon,
  TimelineIcon,
} from "./Icons";

export interface Look {
  label: string;
  /** Icône à la taille demandée. */
  icon: (size?: number) => ReactNode;
  /** Dégradé du badge (classes Tailwind complètes). */
  gradient: string;
  /** Fond doux et texte accentué, pour les pastilles. */
  soft: string;
  /** Couleur d'accent du texte. */
  text: string;
  /** Ombre colorée des boutons principaux. */
  shadow: string;
}

const LOOKS = {
  general: {
    gradient: "from-indigo-500 to-violet-600",
    soft: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    text: "text-indigo-600 dark:text-indigo-300",
    shadow: "shadow-indigo-500/30",
  },
  cartes: {
    gradient: "from-sky-500 to-cyan-500",
    soft: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    text: "text-sky-600 dark:text-sky-300",
    shadow: "shadow-sky-500/30",
  },
  fiches: {
    gradient: "from-amber-500 to-orange-500",
    soft: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    text: "text-amber-600 dark:text-amber-300",
    shadow: "shadow-amber-500/30",
  },
  revision: {
    gradient: "from-rose-500 to-pink-500",
    soft: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    text: "text-rose-600 dark:text-rose-300",
    shadow: "shadow-rose-500/30",
  },
  quiz: {
    gradient: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    text: "text-emerald-600 dark:text-emerald-300",
    shadow: "shadow-emerald-500/30",
  },
  flashcards: {
    gradient: "from-violet-500 to-fuchsia-500",
    soft: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    text: "text-violet-600 dark:text-violet-300",
    shadow: "shadow-violet-500/30",
  },
  frise: {
    gradient: "from-teal-500 to-cyan-600",
    soft: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    text: "text-teal-600 dark:text-teal-300",
    shadow: "shadow-teal-500/30",
  },
  redaction: {
    gradient: "from-red-500 to-orange-500",
    soft: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    text: "text-red-600 dark:text-red-300",
    shadow: "shadow-red-500/30",
  },
  resume: {
    gradient: "from-blue-500 to-indigo-500",
    soft: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    text: "text-blue-600 dark:text-blue-300",
    shadow: "shadow-blue-500/30",
  },
} as const;

export interface ModeInfo extends Look {
  description: string;
}

export const MODE_INFO: Record<Mode, ModeInfo> = {
  general: {
    ...LOOKS.general,
    label: "Général",
    icon: (s = 22) => <FolderIcon size={s} />,
    description: "Ajoute ton cours, l'IA prépare tout le reste",
  },
  cartes: {
    ...LOOKS.cartes,
    label: "Carte mentale",
    icon: (s = 22) => <NetworkIcon size={s} />,
    description: "Organise tes idées en branches",
  },
  fiches: {
    ...LOOKS.fiches,
    label: "Fiches",
    icon: (s = 22) => <FileTextIcon size={s} />,
    description: "Des fiches de cours claires, à imprimer",
  },
  revision: {
    ...LOOKS.revision,
    label: "Révision",
    icon: (s = 22) => <TargetIcon size={s} />,
    description: "L'essentiel sur une page et ton planning",
  },
  quiz: {
    ...LOOKS.quiz,
    label: "Quiz",
    icon: (s = 22) => <QuizIcon size={s} />,
    description: "Teste-toi avec des QCM corrigés",
  },
  flashcards: {
    ...LOOKS.flashcards,
    label: "Flashcards",
    icon: (s = 22) => <CardsIcon size={s} />,
    description: "Mémorise avec la répétition espacée",
  },
  frise: {
    ...LOOKS.frise,
    label: "Frise",
    icon: (s = 22) => <TimelineIcon size={s} />,
    description: "Les dates clés dans l'ordre, à imprimer",
  },
  redaction: {
    ...LOOKS.redaction,
    label: "Rédaction",
    icon: (s = 22) => <NotebookPenIcon size={s} />,
    description: "Problématique, plan et relecture de ton devoir",
  },
};

export const KIND_LOOK: Record<ItemKind, Look> = {
  classeur: { ...LOOKS.general, label: "Classeur", icon: (s = 18) => <FolderIcon size={s} /> },
  carte: { ...LOOKS.cartes, label: "Carte mentale", icon: (s = 18) => <NetworkIcon size={s} /> },
  fiche: { ...LOOKS.fiches, label: "Fiche", icon: (s = 18) => <FileTextIcon size={s} /> },
  revision: { ...LOOKS.revision, label: "Fiche de révision", icon: (s = 18) => <TargetIcon size={s} /> },
  planning: { ...LOOKS.revision, label: "Planning", icon: (s = 18) => <CalendarIcon size={s} /> },
  quiz: { ...LOOKS.quiz, label: "Quiz", icon: (s = 18) => <QuizIcon size={s} /> },
  flashcards: { ...LOOKS.flashcards, label: "Flashcards", icon: (s = 18) => <CardsIcon size={s} /> },
  resume: { ...LOOKS.resume, label: "Résumé", icon: (s = 18) => <AlignLeftIcon size={s} /> },
  frise: { ...LOOKS.frise, label: "Frise", icon: (s = 18) => <TimelineIcon size={s} /> },
  redaction: { ...LOOKS.redaction, label: "Devoir", icon: (s = 18) => <NotebookPenIcon size={s} /> },
};

/** Mode où l'on retombe en quittant un document qui n'est pas dans un classeur. */
export const MODE_OF_KIND: Record<ItemKind, Mode> = {
  classeur: "general",
  carte: "cartes",
  fiche: "fiches",
  revision: "revision",
  planning: "revision",
  quiz: "quiz",
  flashcards: "flashcards",
  resume: "general",
  frise: "frise",
  redaction: "redaction",
};

/** Pastille colorée avec l'icône d'un type. */
export function KindBadge({ kind, size = "md" }: { kind: ItemKind; size?: "sm" | "md" | "lg" }) {
  const look = KIND_LOOK[kind];
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  return (
    <span className={`flex shrink-0 items-center justify-center bg-linear-to-br text-white shadow-sm ${look.gradient} ${box}`} aria-hidden="true">
      {look.icon(size === "sm" ? 16 : size === "lg" ? 22 : 18)}
    </span>
  );
}
