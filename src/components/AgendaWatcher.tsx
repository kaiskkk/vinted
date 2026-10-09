import { useEffect } from "react";
import { dueReminders, markNotified, reminderText } from "../lib/agenda";
import { useToast } from "./Toasts";

/** Rappels de l'agenda : à l'ouverture du site et au retour sur l'onglet, une fois par jour et par devoir. */
export function AgendaWatcher() {
  const toast = useToast();
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "hidden") return;
      const due = dueReminders();
      if (!due.length) return;
      markNotified(due.map((i) => i.id));
      for (const i of due) {
        const text = reminderText(i);
        toast.info(text);
        if ("Notification" in window && Notification.permission === "granted") {
          // Par le service worker quand il existe (obligatoire sur Android), sinon directement.
          const sw = "serviceWorker" in navigator ? navigator.serviceWorker.getRegistration() : Promise.resolve(undefined);
          void sw
            .then((reg) => {
              if (reg) return reg.showNotification("ecoleduc", { body: text, icon: "/icons/icon-192.png", tag: `agenda-${i.id}` });
              new Notification("ecoleduc", { body: text });
            })
            .catch(() => {});
        }
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [toast]);
  return null;
}
