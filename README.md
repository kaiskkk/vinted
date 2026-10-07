# ecoleduc — outil d'étude

Une application web personnelle pour apprendre et réviser ses cours, avec l'aide de Claude : cartes mentales, fiches, fiches de révision, quiz, flashcards et résumés. Elle marche aussi bien sur ordinateur que sur téléphone, et s'installe comme une vraie appli (PWA), utilisable même sans connexion.

- **Accueil** : une tuile par mode (Général, Carte mentale, Fiches, Révision, Quiz, Flashcards), ce qui est prévu **aujourd'hui** (cartes à revoir, séances du planning) et **Mes documents récents** (tous les modes), avec recherche et filtre par type.
- **Général** : ajoute ton cours une seule fois (le coller, écrire un sujet, ou importer un **PDF**, un **fichier texte** ou une **photo**), puis demande à Claude une carte mentale, une fiche, une fiche de révision, un quiz, des flashcards ou un résumé. Tout est rangé dans un **classeur**, avec une **discussion** pour poser tes questions sur le cours.
- **Carte mentale** : l'éditeur de cartes, inchangé (canevas infini, boîte à outils, génération avec Claude, export PNG / JSON…).
- **Fiches** : fiche structurée (notions clés, définitions, dates, formules, exemples, pièges, à retenir) avec un **code couleur** par type d'information, **4 styles** (classique, colorée, minimaliste, cahier), entièrement **modifiable** (texte, couleurs, ajout, déplacement et suppression de blocs, annuler / rétablir), **impression A4** propre et **export PDF**.
- **Révision** : fiche ultra-condensée sur une page, « Les 10 choses à savoir absolument », pièges à éviter, et **planning de révision** jour par jour jusqu'à la date de l'examen (calculé sur l'appareil, sans Claude).
- **Quiz** : QCM avec nombre de questions et difficulté au choix, correction immédiate expliquée, score final, liste des questions ratées, « Refaire les ratées » et « Flashcards de mes erreurs ».
- **Flashcards** : cartes recto / verso qui se retournent d'un tap, « Je sais » / « À revoir », **répétition espacée** (boîtes de Leitner) et statistiques de progression par paquet.
- **Partout** : niveau scolaire (collège, lycée, études supérieures) pour adapter le vocabulaire de Claude, bouton **« Plus simple »** (« Explique-moi plus simplement ») sur chaque bloc, sauvegarde automatique, **sauvegarde complète** de toutes les données en un fichier JSON (et restauration), thème **sombre / clair**, interface pensée pour le téléphone.
- **Erreurs** : chaque génération affiche un chargement, puis, en cas de problème, un message clair en français avec **Réessayer**.

### L'éditeur de cartes mentales

- **Canevas infini** : zoom (molette ou pincement à deux doigts), déplacement (souris ou un doigt), mini-carte sur ordinateur, boutons « Recentrer la carte » et « Organiser automatiquement ».
- **Édition directe** : double-clic (ou appui long sur téléphone) pour modifier, bouton **+** / `Tab` pour un enfant, `Entrée` pour un frère, glisser-déposer des nœuds, liens tirés à la main, `Suppr` pour effacer.
- **Annuler / Rétablir** (`Ctrl + Z` / `Ctrl + Y`, ou ↶ ↷ en haut) et **sauvegarde automatique**.
- **Boîte à outils** : 6 formes, couleurs de fond et de texte, emojis, taille du texte, gras, italique, style des liens. Sur ordinateur, chaque élément peut être **glissé** sur le canevas ou sur un nœud.
- **Génération avec Claude** : décris ta carte et Claude la construit ; tu peux **remplacer** la carte ou **ajouter** des branches, et **développer** un nœud (clic droit ou appui long).
- **Export** en PNG et **export / import** en JSON.

## Prérequis

- [Node.js](https://nodejs.org/) **22.12 ou plus récent** (`node -v` pour vérifier)
- Une clé API Anthropic, à créer sur <https://platform.claude.com/settings/keys> (uniquement pour la génération avec Claude ; le reste de l'application fonctionne sans)

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier de configuration à partir du modèle
cp .env.example .env        # sous Windows : copy .env.example .env
```

Ouvre ensuite `.env` et colle ta clé :

```env
ANTHROPIC_API_KEY=sk-ant-...
```

## Lancement

```bash
npm run dev
```

Puis ouvre **<http://localhost:5173>** dans ton navigateur.

Cette commande démarre deux programmes en parallèle :

| Programme | Adresse | Rôle |
|---|---|---|
| Vite (front React) | `http://localhost:5173` | L'interface, avec rechargement à chaud |
| Express (serveur) | `http://localhost:3001` | Appelle l'API Claude avec ta clé |

> Si tu modifies `.env`, relance `npm run dev` pour que le serveur relise la clé.

### Autres commandes

| Commande | Effet |
|---|---|
| `npm run build` | Vérifie les types puis compile le front dans `dist/` |
| `npm start` | Sert la version compilée et l'API sur <http://localhost:3001> (après `npm run build`) |
| `npm test` | Lance les tests unitaires (Vitest) |
| `npm run typecheck` | Vérifie les types TypeScript |

## Mettre le site en ligne (Netlify)

Une fois en ligne, plus besoin du terminal : tu ouvres simplement l'adresse de ton site. Le front est servi par Netlify, et la partie qui appelle Claude tourne dans une **fonction Netlify** (`netlify/functions/api.ts`). La clé API reste stockée chez Netlify, jamais dans le navigateur.

1. Va sur <https://app.netlify.com> et connecte-toi avec ton compte GitHub.
2. Clique sur **Add new project** (ou **Add new site**), puis **Import an existing project**, choisis **GitHub** et sélectionne le dépôt **vinted**.
3. Choisis la branche à publier (celle qui contient ce code). Ne touche pas aux réglages de build : ils sont lus automatiquement dans `netlify.toml` (commande `npm run build`, dossier `dist`, Node 22).
4. Ajoute deux **variables d'environnement** (bouton *Add environment variables* sur cet écran, ou plus tard dans *Project configuration → Environment variables*) :

   | Clé | Valeur |
   |---|---|
   | `ANTHROPIC_API_KEY` | ta clé API Anthropic |
   | `CODE_ACCES` | un mot de passe de ton choix |

   > ⚠️ **Mets un `CODE_ACCES`.** Sans lui, n'importe qui trouvant l'adresse de ton site pourrait utiliser ta clé et dépenser tes crédits. Le site te demandera ce code une seule fois par navigateur.
5. Clique sur **Deploy**. Une à deux minutes plus tard, ton site est disponible à une adresse du type `https://ton-site.netlify.app`.

Bon à savoir :

- Si tu ajoutes ou modifies une variable après coup, relance un déploiement (*Deploys → Trigger deploy → Deploy site*) pour qu'elle soit prise en compte.
- À chaque modification du code sur GitHub, Netlify republie le site automatiquement.
- Les cartes sont enregistrées **dans le navigateur, séparément pour chaque adresse** : celles créées sur `localhost` n'apparaissent pas sur `netlify.app`. Pour les transférer, utilise *Exporter → Fichier JSON* sur l'une, puis *Importer un fichier JSON* sur l'autre.
- Netlify coupe une fonction au bout de 60 secondes : une génération est donc limitée à environ 50 secondes en ligne. C'est largement suffisant avec `CLAUDE_EFFORT=low` (valeur par défaut).

## Installer l'appli sur ton téléphone (PWA)

Ouvre l'adresse de ton site (par exemple `https://ecoleduc.netlify.app`) sur ton téléphone, puis :

- **iPhone (Safari)** : bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**.
- **Android (Chrome)** : bouton **Installer l'appli** en haut de l'accueil, ou menu **⋮** → **Installer l'application**.

L'icône ecoleduc apparaît sur l'écran d'accueil et s'ouvre en plein écran, sans barre de navigateur. Après une première visite en ligne, l'appli et tes cartes restent consultables et modifiables **sans connexion** ; seule la génération avec Claude a besoin d'internet. Les mises à jour du site arrivent toutes seules à l'ouverture suivante.

## Utilisation

### Le parcours conseillé

1. Choisis ton **niveau** en haut de l'accueil (Collège, Lycée ou Études sup).
2. Ouvre **Général → Nouveau classeur**, colle ton cours (ou importe un PDF, une photo de ton cahier, ou écris juste un sujet), puis **Créer le classeur**.
3. Dans le classeur, touche ce que tu veux préparer : **Carte mentale**, **Fiche de cours**, **Fiche de révision**, **Quiz**, **Flashcards** ou **Résumé**. Pour le quiz et les flashcards, choisis le nombre (et la difficulté).
4. Pose tes questions dans **Questions sur le cours** : Claude répond à partir de ton cours.
5. Prévois un **planning de révision** depuis le classeur ou le mode Révision.

Les modes Fiches, Révision, Quiz et Flashcards marchent aussi seuls : **Créer avec Claude** demande un cours ou un sujet (ou un classeur existant). **Fiche vierge** et **Paquet vide** permettent d'écrire soi-même, sans Claude.

### Fiches

- **Style** : Classique, Colorée, Minimaliste ou Cahier (le choix est gardé pour chaque fiche).
- **Modifier** : titre, type et couleur de chaque bloc (pastille ronde), ↑ ↓ pour déplacer, corbeille pour supprimer (« Annuler » juste après, ou `Ctrl + Z`), **Ajouter un bloc**. Dans le texte : `- ` en début de ligne pour une liste, `**gras**`, `==surligné==`.
- **Imprimer** / **PDF** : la fiche sort sur une feuille A4 blanche, sans boutons ni menus, couleurs conservées, et aucun bloc n'est coupé entre deux pages. Pour le PDF, choisis « Enregistrer au format PDF » comme imprimante.
- 💡 **Plus simple** sur un bloc : Claude le réexplique avec des mots de tous les jours.

### Quiz et flashcards

- **Quiz** : touche une réponse (ou `1`–`4` / `A`–`D` au clavier) ; la correction et l'explication s'affichent aussitôt. À la fin : score, questions ratées, « Refaire les ratées », « Flashcards de mes erreurs ». Le crayon en haut permet de corriger ou d'ajouter des questions.
- **Flashcards** : « Réviser maintenant » propose les cartes du jour ; touche la carte pour la retourner (`Espace` au clavier), puis **Je sais** (`→`) ou **À revoir** (`←`). Une carte sue revient plus tard (1, 3, 7, 14 puis 30 jours) ; une carte à revoir repasse en fin de séance et revient dès le lendemain.

### Sur téléphone (cartes mentales)

| Action | Geste |
|---|---|
| Se déplacer / zoomer | Glisser un doigt / pincer à deux doigts |
| Sélectionner un nœud | Le toucher : une barre apparaît en bas avec **＋ Enfant**, **Texte**, **Style** et **Plus** |
| Menu d'actions d'un nœud | **Appui long** : modifier, ajouter un enfant ou un frère, développer avec Claude, couleur, supprimer |
| Ajouter une idée ailleurs | Appui long sur un espace vide du canevas |
| Boîte à outils | Bouton rond 🎨 en bas à droite ; elle se referme avec ×, en la glissant vers le bas, ou en touchant le canevas |
| Annuler / Rétablir | Boutons ↶ ↷ en haut |
| Exporter, importer, thème, organiser | Menu **⋯** en haut à droite |

Pendant que tu écris dans un nœud, la carte se décale pour que le texte reste visible au-dessus du clavier.

### Raccourcis (ordinateur)

| Action | Raccourci |
|---|---|
| Ajouter une idée enfant | `Tab` (ou bouton **+** sur le nœud) |
| Ajouter une idée sœur (même parent) | `Entrée` |
| Modifier le texte d'un nœud | Double-clic ou `F2` |
| Valider / annuler la saisie | `Entrée` / `Échap` (`Maj + Entrée` pour un retour à la ligne) |
| Supprimer la sélection (nœuds ou liens) | `Suppr` |
| Annuler / Rétablir | `Ctrl + Z` / `Ctrl + Y` (ou `Ctrl + Maj + Z`) |
| Tout désélectionner | `Échap` |
| Sélection multiple | `Ctrl + clic`, ou `Maj + glisser` pour une zone |
| Relier deux nœuds | Tirer depuis un point de bord d'un nœud vers un autre |
| Menu contextuel | Clic droit sur un nœud ou sur le canevas |

### Boîte à outils

- Les réglages s'appliquent aux **nœuds sélectionnés**. Sans sélection, un clic sur une forme crée un nouveau nœud au centre de l'écran.
- Le **style des liens** s'applique aux liens sélectionnés ; si aucun lien n'est sélectionné, il s'applique à tous les liens et devient le style des prochains.
- En bas à gauche du canevas : zoom, **Recentrer la carte** et **Organiser automatiquement** (disposition propre en arbre).

### Génération avec Claude

- **Remplacer la carte** : Claude crée une carte complète. Ton ancienne carte n'est pas perdue : `Ctrl + Z` (ou ↶) la ramène.
- **Ajouter à la carte** : Claude reçoit ta carte actuelle en contexte et ajoute de nouvelles branches, sans déplacer ce que tu as déjà organisé.
- **Développer avec Claude** (clic droit ou appui long sur un nœud) : 3 à 6 sous-idées pour ce nœud.
- Pendant la génération, le bouton « Claude réfléchit… » (« Annuler » sur téléphone) permet d'arrêter.
- Si la génération échoue (connexion, surcharge, délai dépassé…), un message en français s'affiche avec un bouton **Réessayer**.
- Tout ce que Claude produit reste modifiable à la main.

### Sauvegarde, export et import

- Tout est enregistré automatiquement dans le **localStorage** du navigateur : c'est propre à ce navigateur et à ce profil, et vider les données du site efface tout.
- **Accueil → Mes données → Sauvegarder tout (JSON)** télécharge un fichier avec toutes tes cartes, tous tes documents et classeurs. **Restaurer une sauvegarde** les remet (sur le même appareil ou un autre) : rien n'est supprimé, et pour un même document la version la plus récente est gardée.
- **Exporter → Image PNG** : toute la carte (pas seulement la partie visible), en haute définition, sur le fond du thème courant.
- **Exporter → Fichier JSON** : la carte complète, réimportable.
- **Import JSON** : depuis l'accueil (crée une nouvelle carte) ou depuis l'éditeur (remplace le contenu de la carte, annulable avec `Ctrl + Z`). Les fichiers au format Claude `{ "titre": "...", "noeuds": [...] }` sont aussi acceptés et disposés automatiquement.

## Configuration (`.env` en local, variables d'environnement sur Netlify)

| Variable | Obligatoire | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Oui (pour Claude) | Ta clé API Anthropic |
| `PORT` | Non | Port du serveur Express (3001 par défaut ; si tu le changes, adapte le proxy dans `vite.config.ts`) |
| `CLAUDE_EFFORT` | Non | `low` (par défaut, le plus rapide), `medium` ou `high` (plus réfléchi, plus lent et plus coûteux) |
| `CODE_ACCES` | Non (conseillé en ligne) | Si défini, le site demande ce code avant d'utiliser Claude |

## Comment ça marche

```
Navigateur (React)                Serveur Express (local)            API Claude
                                  ou fonction Netlify (en ligne)
──────────────────                ──────────────────────────────     ──────────
Carte mentale               ──►  POST /api/generate, /api/expand ──(clé API)──►  claude-sonnet-5-5
Fiche, révision, quiz…      ──►  POST /api/etude                          (sortie JSON structurée)
Questions sur le cours      ──►  POST /api/chat
« Plus simple »             ──►  POST /api/simplifier
Photo / PDF scanné          ──►  POST /api/lire
                            ◄──  réponse vérifiée et nettoyée        ◄──
```

- Chaque mode demande à Claude un **JSON structuré** (schéma Zod), puis le serveur le **vérifie et le nettoie** (`shared/study.ts`) avant de l'envoyer au navigateur : blocs vides retirés, types inconnus corrigés, réponses de QCM en double retirées en suivant la bonne réponse, nombre de questions plafonné… Une réponse inutilisable donne un message clair, jamais un écran cassé.
- Les **PDF avec du texte** sont lus directement dans le navigateur (pdf.js, téléchargé seulement au premier import). Les **photos** et les **PDF scannés** sont réduits puis envoyés à Claude, page par page, pour être transcrits.
- Le cours est envoyé tel quel (jusqu'à 60 000 caractères, environ 15 000 mots) et marqué pour le **cache de prompt** d'Anthropic : plusieurs demandes sur le même cours coûtent moins cher.
- Le **planning de révision** est calculé sur l'appareil : chaque chapitre est appris un jour, puis revu à J+1, J+3 et J+7, la veille de l'examen est réservée au bilan.

- **La clé API ne quitte jamais le serveur.** Le front appelle `/api/...` ; en développement, Vite relaie ces appels vers Express (voir `vite.config.ts`) ; en ligne, Netlify les envoie à la fonction `netlify/functions/api.ts`. Le fichier `.env` est ignoré par Git.
- Claude répond via une **sortie structurée** (schéma Zod) au format `{ "titre": "...", "noeuds": [{ "id", "texte", "parentId", "couleur", "emoji" }] }`. Le serveur nettoie ensuite la réponse : ids en double, parents inconnus, cycles, couleurs invalides, nœuds déjà existants recopiés.
- Le **repli serveur** d'Anthropic (`fallbacks: "default"`) est activé : si le modèle décline une demande pour raison de politique d'usage, l'API la réessaie automatiquement sur le modèle de repli prévu.
- La disposition automatique place les branches principales à droite puis à gauche du nœud central. En mode ajout ou développement, seuls les nouveaux nœuds sont placés, en évitant les chevauchements.

### Structure du projet

```
server/
  index.ts        démarrage du serveur local (lit .env)
  app.ts          serveur Express (local)
  api.ts          logique de l'API : validation, code d'accès, messages d'erreur en français
  claude.ts       cartes mentales : appel à Claude (modèle, consignes, schéma JSON)
  study.ts        fiches, révision, quiz, flashcards, résumé, discussion, « plus simple », lecture de photos
netlify/
  functions/api.ts  la même API, sous forme de fonction Netlify (en ligne)
shared/
  aiMap.ts        format des cartes de Claude et nettoyage
  study.ts        formats des documents d'étude et nettoyage (serveur et front)
src/
  pages/          Home (accueil), MindMaps (mode Carte mentale), Editor (éditeur de cartes),
                  General et Classeur (mode Général), ModePage (Fiches, Révision, Quiz, Flashcards),
                  DocPage + docs/ (fiche, révision, planning, quiz, flashcards, résumé)
  components/     éditeur de cartes (nœuds, liens, boîte à outils…), import du cours, listes, « Plus simple »,
                  chargement / erreur Claude, en-têtes, panneaux du bas, notifications
  hooks/          navigation, thème, document avec annuler/rétablir et sauvegarde, historique des cartes
  lib/            stockage (cartes, documents, classeurs), sauvegarde complète, planning, répétition espacée,
                  lecture des PDF et photos, génération, disposition des cartes, export, client API
public/
  manifest.webmanifest, icons/   appli installable (nom, couleurs, icônes)
pwa/
  sw.js           modèle du service worker (vite.config.ts y ajoute la liste des fichiers au build)
  *.svg           sources des icônes « maskable » et iPhone
```

- **Stockage** : chaque carte reste enregistrée au même format qu'avant (`mm-map:<id>`, index `mm-index`) : les cartes déjà créées s'ouvrent telles quelles. Les nouveaux documents sont dans `ed-doc:<id>` (index `ed-docs`), les classeurs dans `ed-classeur:<id>` (index `ed-classeurs`), le classeur de chaque carte dans `ed-liens-cartes` et le niveau dans `ed-niveau`.
- **Netlify** : pas de redirection nécessaire, car l'appli utilise des adresses en `#/…`. `netlify.toml` règle seulement le cache (service worker toujours vérifié, fichiers versionnés gardés longtemps).

## Dépannage

| Message | Solution |
|---|---|
| « Clé API absente » / « Clé API manquante » | En local : crée `.env` avec `ANTHROPIC_API_KEY=...`, puis relance `npm run dev`. Sur Netlify : ajoute la variable, puis redéploie |
| La fenêtre « Code d'accès » s'affiche | C'est la valeur de `CODE_ACCES` choisie dans tes variables d'environnement |
| « Le serveur n'a pas répondu à temps » (en ligne) | La génération a dépassé la limite de Netlify : réessaie, ou fais une demande plus courte |
| « Clé API invalide » | Vérifie la clé (pas d'espace ni de guillemets en trop) |
| « Serveur injoignable » | En local, le serveur Express n'est pas lancé : utilise `npm run dev` (et non `npx vite` seul) |
| « Hors connexion » | Normal sans internet : tes cartes restent utilisables, Claude reviendra avec la connexion |
| L'appli installée n'affiche pas la dernière version | Ferme-la complètement puis rouvre-la : la mise à jour se fait à l'ouverture |
| « Trop de demandes » | Limite de débit de l'API atteinte : patiente quelques secondes |
| « La réponse de Claude a été coupée » | Demande moins de questions ou de cartes, ou découpe ton cours par chapitre |
| « Aucun texte lisible » sur une photo | Reprends la photo bien à plat, nette et éclairée |
| Un PDF scanné n'est lu qu'en partie | Seules les 15 premières pages sont lues : importe-le par morceaux ou en photos |
| L'impression montre les boutons ou un fond sombre | Utilise les boutons **Imprimer** / **PDF** de la fiche (ou `Ctrl + P`) : la mise en page A4 s'applique automatiquement |
| Port 5173 ou 3001 déjà utilisé | Ferme l'autre programme, ou change `PORT` (et le proxy de `vite.config.ts`) |
