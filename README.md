# ecoleduc — outil d'étude

Une application web personnelle pour apprendre et réviser ses cours, avec l'aide de l'IA (Gemini gratuit, ou Claude) : cartes mentales, fiches, fiches de révision, quiz, flashcards, résumés, frises chronologiques, aide à la rédaction, exercices corrigés pas à pas, interrogations orales, jeux de révision, analyse de copies corrigées, agenda des devoirs et mode classe. Elle marche aussi bien sur ordinateur que sur téléphone, et s'installe comme une vraie appli (PWA), utilisable même sans connexion.

- **Accueil** : une tuile par mode (Général, Carte mentale, Fiches, Révision, Quiz, Flashcards, Exercices, Oral, Jeux, Frise, Rédaction, Ma copie, Agenda, Ma classe), la **série** 🔥 en haut, ce qui est prévu **aujourd'hui** (cartes à revoir, séances du planning, devoirs à rendre, nouveaux documents dans tes classes) et **Mes documents récents** (tous les modes), avec recherche et filtre par type.
- **Général** : ajoute ton cours une seule fois (le coller, écrire un sujet, ou importer un **PDF**, un **fichier texte** ou une **photo**), puis demande à Claude une carte mentale, une fiche, une fiche de révision, un quiz, des flashcards ou un résumé. Tout est rangé dans un **classeur**, avec une **discussion** pour poser tes questions sur le cours.
- **Carte mentale** : l'éditeur de cartes, inchangé (canevas infini, boîte à outils, génération avec Claude, export PNG / JSON…).
- **Fiches** : fiche structurée (notions clés, définitions, dates, formules, exemples, pièges, à retenir) avec un **code couleur** par type d'information, **4 styles** (classique, colorée, minimaliste, cahier), entièrement **modifiable** (texte, couleurs, ajout, déplacement et suppression de blocs, annuler / rétablir), **impression A4** propre et **export PDF**.
- **Révision** : fiche ultra-condensée sur une page, « Les 10 choses à savoir absolument », pièges à éviter, et **planning de révision** jour par jour jusqu'à la date de l'examen (calculé sur l'appareil, sans Claude).
- **Quiz** : QCM avec nombre de questions et difficulté au choix, correction immédiate expliquée, score final, liste des questions ratées, « Refaire les ratées » et « Flashcards de mes erreurs ».
- **Flashcards** : cartes recto / verso qui se retournent d'un tap, « Je sais » / « À revoir », **répétition espacée** (boîtes de Leitner) et statistiques de progression par paquet.
- **Frise** : frise chronologique générée par l'IA à partir d'un thème ou d'un cours (événements datés et grandes périodes), avec une vue d'ensemble à l'échelle et la liste détaillée ; **modifiable** (ajouter, déplacer dans le temps, supprimer, annuler / rétablir), **imprimable** et exportable en PDF.
- **Rédaction** : aide pour une dissertation, un commentaire, un exposé ou une rédaction. L'IA propose des **problématiques** et un **plan détaillé** (introduction, parties, sous-parties avec idées et exemples, conclusion, conseils), puis **relit ton texte** : points forts, ce qui peut être amélioré (avec l'extrait concerné et un conseil), remarques de langue, prochaine étape. Elle **n'écrit jamais le devoir à ta place**.
- **Exercices** : exercices d'entraînement générés à partir d'un cours ou d'un sujet (nombre et difficulté au choix). Pour chacun : zone de réponse (écrite ou dictée), **indices** dévoilés un par un, puis **correction pas à pas** (étape par étape, ou tout d'un coup) et résultat ; « J'avais juste » / « À revoir » pour suivre ta progression. Imprimables (énoncés puis corrigés).
- **Oral** : une interrogation comme au tableau. L'IA prépare des **questions ouvertes** sur ton cours (ou tu écris les tiennes, ou tu pars d'un paquet de flashcards). Le site **lit chaque question à voix haute**, tu **réponds au micro** (ou au clavier), puis l'IA **corrige ta réponse** : juste, en partie juste ou pas encore, ce qu'il manquait, et la réponse attendue, lue à voix haute elle aussi. À la fin : une note (½ point pour une réponse en partie juste), et « Refaire les questions ratées ». Si l'IA ne répond pas, tu peux te corriger toi-même.
- **Jeux** : trois jeux de révision créés par l'IA sur ton cours : **paires** (associer chaque mot à sa définition, chronométré), **texte à trous** (toucher un trou puis le bon mot) et **mots croisés** (grille construite sur l'appareil, définitions horizontales et verticales, « Vérifier », « Solution », « Nouvelle grille »). Tes records sont gardés.
- **Ma copie** : prends en photo une copie corrigée par ton professeur (jusqu'à 4 pages). L'IA lit la note et les annotations, puis donne un **bilan**, ce que tu as **bien fait**, chaque **erreur expliquée** (l'extrait, pourquoi c'est faux, la correction, un conseil), les **notions à revoir** et des **exercices** pour t'entraîner. « Flashcards de mes erreurs » en fait un paquet à réviser.
- **Agenda** : devoirs, contrôles, exposés et oraux avec date, heure, matière et **rappel** (la veille, le jour même ou deux jours avant). Les rappels s'affichent à l'ouverture du site et en **notification** si tu les autorises ; **Dans mon agenda** les ajoute au calendrier du téléphone (fichier `.ics`, avec alarme) pour être prévenu même site fermé. Les devoirs du jour apparaissent sur l'accueil.
- **Lecture à voix haute** : bouton **Écouter** sur chaque document (fiche, révision, résumé, quiz, flashcards, exercices, frise, plan de rédaction, copie, « Plus simple », messages du classeur). Une barre en bas permet pause, phrase précédente / suivante et vitesse (0,8× à 1,5×). C'est la voix française du navigateur, gratuite et sans internet.
- **Ma classe** (avec les comptes) : crée une classe (ta classe, ou un groupe de révision entre amis) et donne son **code** (par exemple `K2DE-XFTK`) ou le **lien d'invitation** ; les autres la rejoignent depuis « Ma classe ». Les membres apparaissent par leur **prénom** (jamais leur email). Tout document, carte mentale ou classeur ajouté à la classe (bouton **Ajouter un document**, ou **Partager → Envoyer à ma classe**) arrive chez **chaque membre**, qui l'ouvre d'un tap : une copie est ajoutée à ses documents, avec ses propres réponses et scores. L'accueil signale les **nouveaux documents**. Le créateur choisit qui peut ajouter des documents (tout le monde, ou lui seulement, pratique pour un prof), peut fermer les inscriptions, retirer un membre, renommer ou supprimer la classe ; les autres peuvent la quitter.
- **Partage** (avec les comptes) : bouton **Partager** sur chaque document, carte mentale et classeur. Il crée un **lien** à envoyer à un ami (copier ou « Envoyer… ») ; en l'ouvrant, ton ami (connecté à son compte) ajoute **une copie** à ses propres documents. Un classeur est partagé avec ses documents et ses cartes. Tes réponses, scores, records, brouillons et questions au classeur ne sont **jamais** partagés.
- **Série** 🔥 : chaque jour où tu révises (quiz, flashcards, exercice, réponse à l'oral, jeu, copie analysée, devoir coché, séance de planning, génération, question, rédaction, modification d'un document) compte ; série en cours, **record**, **calendrier** des jours révisés et **badges** (1, 3, 7, 14, 30, 60, 100 et 365 jours).
- **Saisie vocale** : bouton **micro** à côté des zones de texte (cours, sujet, consigne, question, devoir, réponse d'exercice ou d'oral, agenda, demande de carte mentale), en français, avec la reconnaissance vocale gratuite du navigateur (Chrome, Edge, Safari, téléphone compris). Dis « virgule », « point d'interrogation » ou « à la ligne » pour ponctuer.
- **Comptes** (facultatif, gratuit avec Firebase) : inscription et connexion par email et mot de passe, sans vérification d'email. Une fois activés, la connexion est **obligatoire**, toutes les données sont **sauvegardées dans le compte** et retrouvées sur tous les appareils, et à la première connexion le site propose d'**importer** ce qui était déjà enregistré dans le navigateur.
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
- Pour l'IA, au choix (le reste de l'application fonctionne sans) :
  - **gratuit** : une clé **Google Gemini** (voir « IA gratuite avec Gemini » ci-dessous) ;
  - **payant** : une clé API Anthropic, à créer sur <https://platform.claude.com/settings/keys>.

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Créer le fichier de configuration à partir du modèle
cp .env.example .env        # sous Windows : copy .env.example .env
```

Ouvre ensuite `.env` et colle ta clé, gratuite (Gemini) ou payante (Anthropic) :

```env
CLE_GEMINI=AIza...
# ou
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

Pour tester les comptes **sans projet Firebase réel**, les émulateurs de Firebase (Java 21 nécessaire) tournent en local : `npx firebase-tools emulators:start --only auth,firestore --project demo-ecoleduc`, puis lance le front avec `VITE_FIREBASE_CONFIG='{"apiKey":"demo","projectId":"demo-ecoleduc","appId":"1:1:web:1"}' VITE_FIREBASE_EMULATOR=127.0.0.1` et le serveur avec `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` et la même `VITE_FIREBASE_CONFIG`.

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
- Sans comptes, les données sont enregistrées **dans le navigateur, séparément pour chaque adresse** : celles créées sur `localhost` n'apparaissent pas sur `netlify.app`. Pour les transférer, utilise la sauvegarde complète (*Accueil → Mes données*), ou active les comptes (voir « Comptes élèves »).
- Netlify coupe une fonction au bout d'environ 30 secondes : une génération est donc limitée à 25 secondes en ligne. Pour les gros quiz ou les longs cours, demande moins de questions ou découpe le cours.

## Ou bien : héberger gratuitement sur Vercel (sans crédits)

Le même code se publie aussi sur **Vercel**, gratuit pour un usage personnel, sans système de crédits : pratique quand ceux de Netlify sont épuisés. Le front est servi tel quel et l'API devient une fonction Vercel (`server/vercel.ts`, mêmes routes que Netlify). `vercel.json` demande la commande `npm run build:vercel`, qui prépare tout dans `.vercel/output`.

1. Va sur <https://vercel.com/signup>, choisis **Hobby**, et connecte-toi avec **GitHub**.
2. **Add New… → Project**, puis **Import** à côté du dépôt **vinted** (autorise Vercel à voir le dépôt si on te le demande).
3. Donne un nom au projet (par exemple `ecoleduc`) : ce sera l'adresse `https://ecoleduc.vercel.app`. Ne touche pas aux réglages de build.
4. Ouvre **Environment Variables** et ajoute les mêmes variables que sur Netlify : `CLE_GEMINI` (ou `GEMINIE`) avec ta clé Gemini, et `VITE_FIREBASE_CONFIG` si tu utilises les comptes.
5. Clique sur **Deploy**. Ensuite, chaque modification envoyée sur GitHub est publiée automatiquement.
6. Comptes : dans Firebase, ajoute l'adresse Vercel dans **Authentication → Paramètres → Domaines autorisés**.

Bon à savoir :

- Les données enregistrées dans le navigateur sont propres à chaque adresse : pour retrouver sur Vercel ce que tu avais sur Netlify, fais **Accueil → Mes données → Sauvegarder tout** sur l'ancienne adresse, puis **Restaurer une sauvegarde** sur la nouvelle (une fois connecté, tout part dans ton compte).
- Sur Vercel, une génération peut durer jusqu'à 55 secondes (au lieu de 25 sur Netlify).

## IA gratuite avec Gemini

Le site sait utiliser **Google Gemini** à la place de Claude, avec l'offre gratuite de Google (sans carte bancaire). Mêmes fonctions : cartes mentales, fiches, révision, quiz, flashcards, résumés, questions sur le cours, « Plus simple » et lecture des photos.

1. Va sur <https://aistudio.google.com/apikey> et connecte-toi avec un compte Google. Les conditions de Google demandent d'être **majeur** : si tu ne l'es pas, demande à un parent de créer la clé.
2. Clique sur **Create API key** et copie la clé (elle commence par `AIza`).
3. Sur Netlify : *Project configuration → Environment variables → Add a variable*, nom **`CLE_GEMINI`**, valeur : ta clé (le nom `GEMINIE` est aussi accepté). En local : `CLE_GEMINI=...` dans `.env`.
4. Relance un déploiement (*Deploys → Trigger deploy → Deploy site*), ou attends la prochaine mise à jour du site.

Bon à savoir :

- **Dès que `CLE_GEMINI` existe, le site utilise Gemini** ; sans elle, il utilise Claude. Pour revenir à Claude, supprime simplement la variable.
- L'offre gratuite est **limitée** (un nombre de demandes par minute et par jour, qui change selon Google) : en cas de dépassement, le site affiche « Limite gratuite de l'IA atteinte » et ça repart un peu plus tard.
- Sur l'offre gratuite, **Google peut utiliser tes demandes pour améliorer ses produits** : n'y mets pas d'informations personnelles.
- Par défaut, le site utilise `gemini-flash-lite-latest`, le modèle gratuit le plus rapide, avec la réflexion réduite au minimum. S'il est surchargé ou à sa limite, il essaie automatiquement d'autres modèles gratuits (chacun a son propre quota). `MODELE_GEMINI` (facultatif) choisit un autre modèle à essayer en premier, par exemple `gemini-flash-latest` (plus réfléchi, plus lent).
- Sans aucune clé, Netlify fournit lui-même Claude grâce à son **AI Gateway**, payé avec les **crédits** de ton compte Netlify : sur l'offre gratuite, quand les crédits sont épuisés, tous tes sites sont mis en pause jusqu'au mois suivant (sans rien te facturer). Avec `CLE_GEMINI`, l'IA ne consomme plus ces crédits.

## Comptes élèves (Firebase, gratuit)

Sans configuration, le site marche comme avant : sans compte, avec les données enregistrées dans le navigateur. Pour activer les comptes (connexion obligatoire, données sauvegardées en ligne et retrouvées partout), il faut un projet **Firebase**, gratuit (offre *Spark*, sans carte bancaire) :

1. Va sur <https://console.firebase.google.com>, connecte-toi avec un compte Google et **crée un projet** (par exemple `ecoleduc`). Google Analytics n'est pas utile : tu peux le désactiver.
2. **Authentication** (menu *Créer* / *Build*) → **Commencer** → onglet **Méthode de connexion** → **Adresse e-mail/Mot de passe** → active-le (laisse « Lien envoyé par e-mail » désactivé) → **Enregistrer**.
3. **Firestore Database** → **Créer une base de données** → un emplacement en Europe (par exemple `europe-west9`, Paris) → **mode production** → **Créer**. Ouvre ensuite l'onglet **Règles**, remplace tout par le contenu du fichier [`firestore.rules`](firestore.rules) de ce dépôt, puis **Publier**. Ces règles font que chaque élève ne peut lire et modifier **que ses propres données**, qu'un document partagé ne peut être ouvert qu'avec son lien (par un élève connecté) et modifié que par celui qui l'a partagé, et qu'une classe n'est visible que par ses membres.
4. ⚙️ **Paramètres du projet** → **Général** → *Vos applications* → icône **Web** (`</>`) → un nom (par exemple `ecoleduc`), sans Firebase Hosting → **Enregistrer l'application**. Copie le bloc `const firebaseConfig = { … };` affiché.
5. **Authentication → Paramètres → Domaines autorisés** : ajoute l'adresse de ton site (par exemple `ecoleduc.netlify.app`).
6. Sur Netlify : *Project configuration → Environment variables → Add a variable*, nom **`VITE_FIREBASE_CONFIG`**, valeur : **colle le bloc copié tel quel** (ou seulement ce qu'il y a entre les accolades). **Ne coche pas** « Contains secret values ». En local : `VITE_FIREBASE_CONFIG='{ "apiKey": "…", "authDomain": "…", "projectId": "…", "appId": "…" }'` dans `.env`.
7. Redéploie le site (*Deploys → Trigger deploy → Deploy site*). À la première visite, crée ton compte : si le navigateur contient déjà des cartes ou des fiches, le site propose de les importer dans ton compte. Fais-le sur chaque appareil où tu as déjà des données.

Bon à savoir :

- **Tu avais déjà collé les règles avant l'arrivée du partage ou du mode classe ?** Recolle tout le contenu de [`firestore.rules`](firestore.rules) (Firestore → *Règles* → *Publier*) : les blocs `partages` et `classes` sont nécessaires.
- Les valeurs de `firebaseConfig` ne sont **pas secrètes** (Google les prévoit pour être dans le site) : la sécurité vient des règles Firestore de l'étape 3. Les clés d'IA (`CLE_GEMINI`, `ANTHROPIC_API_KEY`), elles, restent uniquement sur le serveur.
- Avec les comptes, l'IA n'est utilisable **que connecté** : le serveur vérifie le jeton de connexion de l'élève (signé par Google) avant chaque demande. Personne d'autre ne peut épuiser ton quota gratuit.
- Si le déploiement échoue avec un message de **« secrets scanning »**, ajoute la variable `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` avec pour valeur le texte de `apiKey` (celui qui commence par `AIza`), puis redéploie.
- Le site marche **hors connexion** une fois connecté : les modifications partent dans le compte dès le retour d'internet. **Se déconnecter** retire les données du navigateur (elles restent dans le compte) ; si des modifications n'ont pas encore pu partir, le site prévient avant.
- **Mot de passe oublié ?** sur l'écran de connexion envoie un email pour en choisir un nouveau (pense à regarder dans les spams).
- L'offre gratuite de Firebase (des dizaines de milliers de lectures et d'écritures par jour) suffit très largement pour toi et ta classe.

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
| `CLE_GEMINI` | Non | Clé Google Gemini **gratuite** : si elle est définie, l'IA utilise Gemini au lieu de Claude |
| `MODELE_GEMINI` | Non | Modèle Gemini essayé en premier (`gemini-flash-lite-latest` par défaut) |
| `ANTHROPIC_API_KEY` | Non | Ta clé API Anthropic (payante), utilisée quand `CLE_GEMINI` est vide |
| `PORT` | Non | Port du serveur Express (3001 par défaut ; si tu le changes, adapte le proxy dans `vite.config.ts`) |
| `CLAUDE_EFFORT` | Non | `low` (par défaut, le plus rapide), `medium` ou `high` (plus réfléchi, plus lent et plus coûteux) |
| `CODE_ACCES` | Non | Si défini, le site demande ce code avant d'utiliser l'IA (inutile avec les comptes, qui protègent déjà l'IA) |
| `VITE_FIREBASE_CONFIG` | Non | Configuration Firebase (bloc `firebaseConfig` collé tel quel) : active les comptes obligatoires et la sauvegarde en ligne. Lue au **build** (front) et par la fonction (vérification des connexions) |

## Comment ça marche

```
Navigateur (React)                Serveur Express (local)            API Claude
                                  ou fonction Netlify (en ligne)
──────────────────                ──────────────────────────────     ──────────
Carte mentale               ──►  POST /api/generate, /api/expand ──(clé API)──►  claude-sonnet-5-5
Fiche, révision, quiz, frise ──►  POST /api/etude                          (sortie JSON structurée)
Exercices, jeux, oral       ──►  POST /api/etude
Correction d'une réponse orale ──► POST /api/oral
Plan et relecture d'un devoir ──► POST /api/redaction
Photo d'une copie corrigée  ──►  POST /api/copie
Questions sur le cours      ──►  POST /api/chat
« Plus simple »             ──►  POST /api/simplifier
Photo / PDF scanné          ──►  POST /api/lire
                            ◄──  réponse vérifiée et nettoyée        ◄──
```

- Chaque mode demande à Claude un **JSON structuré** (schéma Zod), puis le serveur le **vérifie et le nettoie** (`shared/study.ts`) avant de l'envoyer au navigateur : blocs vides retirés, types inconnus corrigés, réponses de QCM en double retirées en suivant la bonne réponse, nombre de questions plafonné… Une réponse inutilisable donne un message clair, jamais un écran cassé.
- Les **PDF avec du texte** sont lus directement dans le navigateur (pdf.js, téléchargé seulement au premier import). Les **photos** et les **PDF scannés** sont réduits puis envoyés à Claude, page par page, pour être transcrits.
- Le cours est envoyé tel quel (jusqu'à 60 000 caractères, environ 15 000 mots) et marqué pour le **cache de prompt** d'Anthropic : plusieurs demandes sur le même cours coûtent moins cher.
- **Comptes** : l'appli continue de lire et d'écrire dans le `localStorage` ; quand un compte est connecté, chaque écriture d'une donnée (carte, document, classeur, série, niveau) est repérée et envoyée dans Firestore (`utilisateurs/{uid}/donnees/{clé}`) quelques secondes plus tard, par lots. Au démarrage et au retour sur l'onglet, seules les modifications faites ailleurs depuis la dernière fois sont récupérées ; les listes (index) sont reconstruites sur l'appareil. Une modification locale pas encore envoyée n'est jamais écrasée, et une suppression est transmise aux autres appareils.
- La **saisie vocale** utilise la reconnaissance vocale du navigateur (`SpeechRecognition`, en `fr-FR`) : rien ne passe par le serveur du site. Le bouton micro n'apparaît pas sur les navigateurs qui ne la proposent pas (Firefox).
- La **lecture à voix haute** utilise la synthèse vocale du navigateur (`speechSynthesis`, voix française de l'appareil) : rien ne passe par le serveur. Le texte est lu phrase par phrase, ce qui permet pause, retour et changement de vitesse.
- Les **mots croisés** sont construits sur l'appareil à partir des mots et définitions donnés par l'IA (croisements, sans mots collés) ; une « Nouvelle grille » mélange autrement.
- L'**analyse de copie** envoie les photos réduites (JPEG, 1600 px) au serveur, qui les transmet à l'IA avec un schéma JSON (bilan, erreurs, notions, exercices) ; la réponse est vérifiée comme les autres.
- Les **rappels de l'agenda** sont vérifiés à l'ouverture du site et au retour sur l'onglet (un seul rappel par devoir et par jour). Un site web ne peut pas réveiller le téléphone à heure fixe : pour une alarme fiable même site fermé, utilise **Dans mon agenda** (fichier `.ics` avec alarme, ouvert par l'agenda du téléphone).
- Le **partage** enregistre une copie figée du document dans Firestore (`partages/{id}`, identifiant aléatoire de 20 caractères impossible à deviner) ; les règles n'autorisent que la lecture d'un partage dont on a le lien (pas de liste), par un élève connecté. Ouvrir le lien crée de nouveaux documents chez celui qui le reçoit : les deux copies vivent ensuite séparément.
- L'**interrogation orale** réutilise la voix du navigateur pour lire les questions et la dictée (`SpeechRecognition`) pour la réponse ; seule la correction passe par le serveur (`/api/oral`), qui reçoit la question, la réponse attendue, ses mots clés et la réponse de l'élève (en tenant compte des mots mal reconnus par la dictée).
- Le **mode classe** enregistre chaque classe dans Firestore : `classes/{code}` (nom, créateur, réglages), `classes/{code}/membres/{uid}` (prénom) et `classes/{code}/documents/{id}` (copies figées, comme les liens de partage). Le code (8 caractères sans lettres ambiguës) est l'identifiant de la classe ; les règles n'autorisent à la voir que ses membres, à s'inscrire que soi-même (et seulement si les inscriptions sont ouvertes), et à la régler que son créateur. La liste de tes classes est rangée avec tes données (`ed-groupe:{code}`), donc retrouvée sur tous tes appareils.
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
  api.ts          logique de l'API : validation, code d'accès, comptes, messages d'erreur en français
  auth.ts         vérification des jetons de connexion Firebase (clés publiques de Google)
  ai.ts           choix de l'IA : Gemini si CLE_GEMINI existe, sinon Claude
  claude.ts       cartes mentales : appel à Claude (modèle, consignes, schéma JSON)
  study.ts        fiches, révision, quiz, flashcards, résumé, discussion, « plus simple », lecture de photos
  gemini.ts       les mêmes fonctions avec Google Gemini (offre gratuite)
netlify/
  functions/api.ts  la même API, sous forme de fonction Netlify (en ligne)
server/vercel.ts  la même API, sous forme de fonction Vercel (scripts/build-vercel.mjs l'assemble ; vercel.json)
shared/
  aiMap.ts        format des cartes de Claude et nettoyage
  study.ts        formats des documents d'étude et nettoyage (serveur et front)
  firebaseConfig.ts  lecture de VITE_FIREBASE_CONFIG (front et serveur)
src/
  pages/          Home (accueil), MindMaps (mode Carte mentale), Editor (éditeur de cartes),
                  General et Classeur (mode Général), ModePage (Fiches, Révision, Quiz, Flashcards),
                  Redaction (aide à la rédaction), Copie (photo d'une copie), Agenda (devoirs et rappels),
                  Partage (lien reçu), Classes et ClassePage (mode classe), Serie (série de révision), Login (connexion),
                  DocPage + docs/ (fiche, révision, planning, quiz, flashcards, résumé, frise, devoir,
                  exercices, jeux, copie, oral)
  components/     éditeur de cartes (nœuds, liens, boîte à outils…), import du cours, listes, « Plus simple »,
                  chargement / erreur Claude, en-têtes, panneaux du bas, notifications, lecture à voix haute,
                  bouton Partager, rappels de l'agenda
  hooks/          navigation, thème, document avec annuler/rétablir et sauvegarde, historique des cartes
  lib/            stockage (cartes, documents, classeurs), sauvegarde complète, planning, répétition espacée,
                  série, saisie vocale, lecture à voix haute (speech), agenda, mots croisés (crossword),
                  partage (share), mode classe (classes), comptes (account, cloud) et synchronisation (sync),
                  lecture des PDF et photos, génération, disposition des cartes, export, client API
public/
  manifest.webmanifest, icons/   appli installable (nom, couleurs, icônes)
pwa/
  sw.js           modèle du service worker (vite.config.ts y ajoute la liste des fichiers au build)
  *.svg           sources des icônes « maskable » et iPhone
firestore.rules   règles de sécurité de Firestore, à coller dans la console Firebase
firebase.json     configuration des émulateurs Firebase (tests en local)
```

- **Stockage** : chaque carte reste enregistrée au même format qu'avant (`mm-map:<id>`, index `mm-index`) : les cartes déjà créées s'ouvrent telles quelles. Les nouveaux documents sont dans `ed-doc:<id>` (index `ed-docs`), les classeurs dans `ed-classeur:<id>` (index `ed-classeurs`), le classeur de chaque carte dans `ed-liens-cartes`, le niveau dans `ed-niveau`, la série dans `ed-serie`, l'agenda dans `ed-agenda`, tes classes dans `ed-groupe:<code>` et ton prénom (pour les classes) dans `ed-prenom`. Avec les comptes, ce sont exactement ces données qui sont envoyées en ligne ; `sync-proprietaire`, `sync-attente` et `sync-curseur` (propres à l'appareil) suivent la synchronisation.
- **Netlify** : pas de redirection nécessaire, car l'appli utilise des adresses en `#/…`. `netlify.toml` règle seulement le cache (service worker toujours vérifié, fichiers versionnés gardés longtemps).

## Dépannage

| Message | Solution |
|---|---|
| « Clé Gemini invalide » | Recopie la clé depuis Google AI Studio (sans espace ni guillemets) dans `CLE_GEMINI`, puis redéploie |
| « Limite gratuite de l'IA atteinte » | Limite de l'offre gratuite de Gemini : patiente une minute, ou jusqu'au lendemain si c'est la limite du jour |
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
| « Connecte-toi à ton compte pour utiliser l'IA » | Les comptes sont activés : reconnecte-toi (ou recharge la page) |
| « La connexion par email n'est pas activée dans Firebase » | Étape 2 de « Comptes élèves » : active *Adresse e-mail/Mot de passe* dans Authentication |
| « La sauvegarde en ligne est refusée » | Les règles Firestore ne sont pas les bonnes : recolle `firestore.rules` dans l'onglet *Règles*, puis *Publier* |
| « Le partage n'est pas encore autorisé dans Firebase » | Recolle `firestore.rules` (avec le bloc `partages`) dans Firestore → *Règles*, puis *Publier* |
| « Code inconnu, ou cette classe n'accepte plus de nouveaux membres » | Vérifie le code avec le créateur de la classe ; il a peut-être fermé les inscriptions (Réglages de la classe) |
| Le mode classe dit « Action refusée » ou rien ne s'affiche | Recolle `firestore.rules` (avec le bloc `classes`) dans Firestore → *Règles*, puis *Publier* |
| Le micro ne s'allume pas pendant l'oral | Autorise le micro pour le site ; sans dictée (Firefox), écris ta réponse dans la zone de texte |
| Pas de bouton **Partager** | Le partage passe par les comptes : configure `VITE_FIREBASE_CONFIG` (voir « Comptes élèves ») |
| Pas de bouton **Écouter**, ou voix étrange | Le navigateur n'a pas de voix française : sur téléphone, installe-la dans les réglages de synthèse vocale ; sur ordinateur, essaie Chrome ou Edge |
| Les rappels n'arrivent pas en notification | Touche **Activer les rappels** dans l'Agenda et autorise les notifications ; pour une alarme même site fermé, utilise **Dans mon agenda** |
| « L'IA n'a pas su lire cette copie » | Reprends les photos bien à plat, nettes, avec la note et les annotations visibles |
| « La base Firestore n'est pas encore créée » | Étape 3 de « Comptes élèves » : crée la base Firestore |
| Le déploiement échoue (« secrets scanning ») | Ajoute `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` avec la valeur de `apiKey`, puis redéploie |
| « Le micro est bloqué » | Autorise le micro pour le site (icône à gauche de l'adresse, ou réglages du téléphone → navigateur → micro) |
| Pas de bouton micro | Le navigateur ne propose pas la dictée (Firefox) : utilise Chrome, Edge ou Safari |
| Port 5173 ou 3001 déjà utilisé | Ferme l'autre programme, ou change `PORT` (et le proxy de `vite.config.ts`) |
