import { useState } from "react";
import { ArrowLeftIcon } from "../components/Icons";
import { MODE_OF_KIND } from "../components/looks";
import { btn } from "../components/Modal";
import { goHome, openClasseur, openMode } from "../hooks/useHashRoute";
import { loadClasseur, loadDoc, type StudyDoc } from "../lib/docs";
import { CopieView } from "./docs/CopieView";
import { ExercicesView } from "./docs/ExercicesView";
import { FicheView } from "./docs/FicheView";
import { FlashcardsView } from "./docs/FlashcardsView";
import { FriseView } from "./docs/FriseView";
import { JeuView } from "./docs/JeuView";
import { OralView } from "./docs/OralView";
import { PlanningView } from "./docs/PlanningView";
import { QuizView } from "./docs/QuizView";
import { RedactionView } from "./docs/RedactionView";
import { ResumeView } from "./docs/ResumeView";
import { RevisionView } from "./docs/RevisionView";

/** Retour : vers le classeur du document s'il en a un, sinon vers son mode. */
export function leaveDoc(doc: Pick<StudyDoc, "type" | "classeurId">) {
  if (doc.classeurId && loadClasseur(doc.classeurId)) openClasseur(doc.classeurId);
  else openMode(MODE_OF_KIND[doc.type]);
}

export default function DocPage({ id }: { id: string }) {
  const [doc] = useState(() => loadDoc(id));
  if (!doc) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-medium">Ce document est introuvable.</p>
        <p className="text-sm text-slate-500">Il a peut-être été supprimé, ou créé dans un autre navigateur.</p>
        <button className={btn.primary} onClick={goHome}>
          <ArrowLeftIcon size={16} /> Retour à l'accueil
        </button>
      </div>
    );
  }
  const back = () => leaveDoc(doc);
  switch (doc.type) {
    case "fiche":
      return <FicheView initial={doc} onBack={back} />;
    case "revision":
      return <RevisionView initial={doc} onBack={back} />;
    case "planning":
      return <PlanningView initial={doc} onBack={back} />;
    case "quiz":
      return <QuizView initial={doc} onBack={back} />;
    case "flashcards":
      return <FlashcardsView initial={doc} onBack={back} />;
    case "resume":
      return <ResumeView initial={doc} onBack={back} />;
    case "frise":
      return <FriseView initial={doc} onBack={back} />;
    case "redaction":
      return <RedactionView initial={doc} onBack={back} />;
    case "exercices":
      return <ExercicesView initial={doc} onBack={back} />;
    case "jeu":
      return <JeuView initial={doc} onBack={back} />;
    case "copie":
      return <CopieView initial={doc} onBack={back} />;
    case "oral":
      return <OralView initial={doc} onBack={back} />;
  }
}
