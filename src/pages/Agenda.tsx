import { useState } from "react";
import { BellIcon, CalendarIcon, CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "../components/Icons";
import { MODE_INFO } from "../components/looks";
import { MicButton } from "../components/MicButton";
import { Modal, btn } from "../components/Modal";
import { useToast } from "../components/Toasts";
import { AutoTextarea, EmptyState, Page, PageHeader, Segmented, card, input } from "../components/ui";
import { goHome } from "../hooks/useHashRoute";
import {
  GENRES,
  RAPPELS,
  dayLabel,
  downloadICS,
  genreOf,
  groupAgenda,
  newAgendaItem,
  readAgenda,
  removeAgenda,
  sortAgenda,
  upsertAgenda,
  type AgendaItem,
  type Genre,
  type Rappel,
} from "../lib/agenda";
import { addDays, today } from "../lib/planning";
import { recordActivity } from "../lib/serie";

const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

function ItemForm({ initial, onCancel, onSave }: { initial: AgendaItem | null; onCancel: () => void; onSave: (item: AgendaItem) => void }) {
  const [titre, setTitre] = useState(initial?.titre ?? "");
  const [matiere, setMatiere] = useState(initial?.matiere ?? "");
  const [genre, setGenre] = useState<Genre>(initial?.genre ?? "devoir");
  const [date, setDate] = useState(initial?.date ?? addDays(today(), 1));
  const [heure, setHeure] = useState(initial?.heure ?? "");
  const [rappel, setRappel] = useState<Rappel>(initial?.rappel ?? "veille");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!titre.trim()) return setError("Écris ce qu'il y a à faire.");
    if (!date) return setError("Choisis une date.");
    const base = initial ?? newAgendaItem({ titre: titre.trim(), date });
    onSave({ ...base, titre: titre.trim(), matiere: matiere.trim(), genre, date, heure, rappel, notes: notes.trim() });
  };

  return (
    <Modal
      title={initial ? "Modifier" : "Ajouter à l'agenda"}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className={btn.primary} onClick={save}>
            <CheckIcon size={16} /> Enregistrer
          </button>
        </>
      }
    >
      <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
        <Segmented
          label="Type"
          value={genre}
          onChange={setGenre}
          oneLine
          options={GENRES.map((g) => ({ value: g.value, label: `${g.emoji} ${g.label}` }))}
        />
        <div>
          <label className="text-sm font-semibold" htmlFor="agenda-titre">
            À faire
          </label>
          <div className="mt-1.5 flex items-center gap-1">
            <input
              id="agenda-titre"
              autoFocus={!initial}
              value={titre}
              onChange={(e) => setTitre(e.target.value.slice(0, 140))}
              placeholder="Ex. Exercices 3 et 4 page 52"
              className={`${input} h-12`}
            />
            <MicButton value={titre} max={140} onChange={setTitre} label="Dicter" />
          </div>
        </div>
        <label className="block text-sm font-semibold">
          Matière <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
          <input
            value={matiere}
            onChange={(e) => setMatiere(e.target.value.slice(0, 60))}
            placeholder="Ex. Maths"
            className={`${input} mt-1.5 h-12 font-normal`}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">
            Pour le
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${input} mt-1.5 h-12 font-normal`} />
          </label>
          <label className="block text-sm font-semibold">
            Heure <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
            <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={`${input} mt-1.5 h-12 font-normal`} />
          </label>
        </div>
        <div>
          <p className="text-sm font-semibold">Rappel</p>
          <Segmented label="Rappel" value={rappel} onChange={setRappel} oneLine options={RAPPELS} className="mt-1.5" />
        </div>
        <label className="block text-sm font-semibold">
          Notes <span className="font-normal text-slate-500 dark:text-slate-400">(facultatif)</span>
          <AutoTextarea value={notes} onChange={(v) => setNotes(v.slice(0, 1000))} minRows={2} className={`${input} mt-1.5 py-2.5 font-normal`} />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export default function AgendaPage() {
  const info = MODE_INFO.agenda;
  const toast = useToast();
  const [items, setItems] = useState(() => sortAgenda(readAgenda()));
  const [editing, setEditing] = useState<AgendaItem | "new" | null>(null);
  const [permission, setPermission] = useState(() => (notificationsSupported() ? Notification.permission : "denied"));
  const now = today();
  const groups = groupAgenda(items, now);
  const upcoming = items.filter((i) => !i.fait && i.date >= now);

  const save = (item: AgendaItem) => {
    try {
      setItems(upsertAgenda(item));
      setEditing(null);
      toast.success(editing === "new" ? "Ajouté à ton agenda." : "Enregistré.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  };

  const toggle = (item: AgendaItem) => {
    setItems(upsertAgenda({ ...item, fait: !item.fait }));
    if (!item.fait) recordActivity("devoir");
  };

  const remove = (item: AgendaItem) => {
    setItems(removeAgenda(item.id));
    toast.success(`Supprimé : « ${item.titre} ».`, { label: "Annuler", onClick: () => setItems(upsertAgenda(item)) });
  };

  const askNotifications = async () => {
    if (!notificationsSupported())
      return toast.info("Ce navigateur ne propose pas les notifications : ajoute plutôt tes devoirs à l'agenda de ton téléphone.");
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Rappels activés : tu seras prévenu en ouvrant le site.");
    else toast.info("Notifications refusées : les rappels s'afficheront quand même dans le site.");
  };

  return (
    <div className="min-h-dvh">
      <PageHeader title={info.label} onBack={goHome} backLabel="Retour à l'accueil" />
      <Page width="max-w-3xl">
        <section className="flex items-center gap-4">
          <span
            className={`flex h-14 w-14 shrink-0 animate-pop items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-lg ${info.gradient} ${info.shadow}`}
          >
            {info.icon(28)}
          </span>
          <p className="text-balance text-slate-600 dark:text-slate-300">
            Note tes devoirs et tes contrôles : le site te les rappelle la veille ou le jour même.
          </p>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r px-5 font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] sm:flex-none ${info.gradient} ${info.shadow}`}
          >
            <PlusIcon size={18} /> Ajouter un devoir
          </button>
          {permission !== "granted" && notificationsSupported() && (
            <button type="button" className={btn.secondary} onClick={() => void askNotifications()}>
              <BellIcon size={16} /> Activer les rappels
            </button>
          )}
          {upcoming.length > 0 && (
            <button
              type="button"
              className={btn.secondary}
              onClick={() => downloadICS(upcoming)}
              title="Ajouter à l'agenda du téléphone (rappels même site fermé)"
            >
              <CalendarIcon size={16} /> Dans mon agenda
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${info.soft}`}>{info.icon(24)}</span>}
              title="Rien de prévu"
            >
              Ajoute ton prochain devoir ou contrôle : il apparaîtra aussi sur l'accueil quand il approche.
            </EmptyState>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`g-${g.key}`}>
                <h2
                  id={`g-${g.key}`}
                  className={`mb-2 text-sm font-semibold tracking-wider uppercase ${g.key === "retard" ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
                >
                  {g.label} <span className="ml-1 text-slate-400">({g.items.length})</span>
                </h2>
                <ul className="space-y-2">
                  {g.items.map((i) => {
                    const genre = genreOf(i.genre);
                    return (
                      <li key={i.id} className={`${card} flex items-center gap-2 p-2 pl-3 ${i.fait ? "opacity-60" : ""}`}>
                        <button
                          type="button"
                          onClick={() => toggle(i)}
                          role="checkbox"
                          aria-checked={i.fait}
                          aria-label={i.fait ? `Marquer « ${i.titre} » comme à faire` : `Marquer « ${i.titre} » comme fait`}
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-95 ${
                            i.fait ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-cyan-500 dark:border-slate-600"
                          }`}
                        >
                          {i.fait && <CheckIcon size={18} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-medium ${i.fait ? "line-through" : ""}`}>{i.titre}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {genre.emoji} {genre.label}
                            {i.matiere && ` · ${i.matiere}`} · {dayLabel(i.date, now)}
                            {i.heure && ` à ${i.heure.replace(":", "h")}`}
                            {i.rappel !== "aucun" && !i.fait && " · 🔔"}
                          </p>
                        </div>
                        <button
                          type="button"
                          className={btn.icon}
                          onClick={() => downloadICS([i], `devoir-${i.date}`)}
                          aria-label={`Ajouter « ${i.titre} » à l'agenda du téléphone`}
                          title="Ajouter à l'agenda du téléphone"
                        >
                          <CalendarIcon size={16} />
                        </button>
                        <button type="button" className={btn.icon} onClick={() => setEditing(i)} aria-label={`Modifier « ${i.titre} »`}>
                          <PencilIcon size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${btn.icon} hover:text-red-600`}
                          onClick={() => remove(i)}
                          aria-label={`Supprimer « ${i.titre} »`}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
          🔔 Les rappels s'affichent quand tu ouvres le site (et en notification si tu les as activés). Pour être prévenu même site fermé, touche 📅 «
          Dans mon agenda » : tes devoirs sont ajoutés à l'agenda de ton téléphone, avec leur rappel.
        </p>
      </Page>
      {editing && <ItemForm initial={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
