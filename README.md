# 🧠 Cartes mentales

Une application web personnelle pour créer des cartes mentales, à la main ou avec l'aide de Claude.

- **Canevas infini** : zoom, déplacement à la souris, mini-carte en bas à droite.
- **Édition directe** : double-clic pour modifier un texte, bouton **+** (ou `Tab`) pour ajouter une idée enfant, glisser-déposer des nœuds, liens tirés à la main entre deux nœuds, `Suppr` pour effacer.
- **Annuler / Rétablir** (`Ctrl + Z` / `Ctrl + Y`) et **sauvegarde automatique** à chaque modification.
- **Boîte à outils** : 6 formes (rond, rectangle, arrondi, losange, nuage, post-it), couleurs de fond et de texte (palette + couleur libre), emojis, taille du texte, gras, italique, style des liens (droit, courbe, en angle, pointillé, flèche). Chaque élément peut être **glissé** sur le canevas (nouveau nœud) ou sur un nœud (pour le modifier).
- **Génération avec Claude** : décris ta carte (« fais-moi une carte mentale sur mes objectifs pour devenir footballeur pro ») et Claude la construit, disposée automatiquement en arbre autour du centre. Tu peux **remplacer** la carte ou **ajouter** des branches à la carte actuelle. Clic droit sur un nœud → **Développer avec Claude** pour obtenir 3 à 6 sous-idées.
- **Export** en PNG (haute définition, toute la carte) et **export / import** en JSON.
- Thème **sombre** par défaut, avec un bouton pour passer en mode clair.

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

## Utilisation

### Raccourcis

| Action | Raccourci |
|---|---|
| Modifier le texte d'un nœud | Double-clic, ou `Entrée` / `F2` sur le nœud sélectionné |
| Valider / annuler la saisie | `Entrée` / `Échap` (`Maj + Entrée` pour un retour à la ligne) |
| Ajouter une idée enfant | Bouton **+** ou `Tab` |
| Supprimer la sélection (nœuds ou liens) | `Suppr` |
| Annuler / Rétablir | `Ctrl + Z` / `Ctrl + Y` (ou `Ctrl + Maj + Z`) |
| Sélection multiple | `Ctrl + clic`, ou `Maj + glisser` pour une zone |
| Relier deux nœuds | Tirer depuis un point de bord d'un nœud vers un autre |
| Menu contextuel | Clic droit sur un nœud ou sur le canevas |

### Boîte à outils

- Les réglages s'appliquent aux **nœuds sélectionnés**. Sans sélection, un clic sur une forme crée un nouveau nœud au centre de l'écran.
- Le **style des liens** s'applique aux liens sélectionnés ; si aucun lien n'est sélectionné, il s'applique à tous les liens et devient le style des prochains.
- Le bouton **Réorganiser** (en haut) refait la disposition automatique de toute la carte.

### Génération avec Claude

- **Remplacer la carte** : Claude crée une carte complète. Ton ancienne carte n'est pas perdue : `Ctrl + Z` la ramène.
- **Ajouter à la carte** : Claude reçoit ta carte actuelle en contexte et ajoute de nouvelles branches, sans déplacer ce que tu as déjà organisé.
- **Développer avec Claude** (clic droit sur un nœud) : 3 à 6 sous-idées pour ce nœud.
- Pendant la génération, le bouton « Claude réfléchit… » permet d'annuler.
- Tout ce que Claude produit reste modifiable à la main.

### Sauvegarde, export et import

- Les cartes sont enregistrées automatiquement dans le **localStorage** du navigateur. Elles sont donc propres à ce navigateur et à ce profil : vider les données du site les efface. **Exporte en JSON** les cartes auxquelles tu tiens.
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
Barre « Décris ta carte… »  ──►  POST /api/generate  ──(clé API)──►  claude-sonnet-5-5
Clic droit « Développer »   ──►  POST /api/expand                     (sortie JSON structurée)
                            ◄──  { titre, noeuds } nettoyé       ◄──
Disposition en arbre (dagre), nœuds et liens React Flow
```

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
  claude.ts       appel à l'API Claude (modèle, consignes, schéma JSON)
netlify/
  functions/api.ts  la même API, sous forme de fonction Netlify (en ligne)
shared/
  aiMap.ts        format JSON de Claude et nettoyage (utilisé par le serveur et le front)
src/
  pages/          Home.tsx (accueil), Editor.tsx (éditeur)
  components/     nœud personnalisé, lien « flottant », boîte à outils, barre Claude, menus, toasts
  hooks/          historique annuler/rétablir, thème, navigation
  lib/            disposition (dagre), conversions, stockage, export PNG/JSON, client API
```

## Dépannage

| Message | Solution |
|---|---|
| « Clé API absente » / « Clé API manquante » | En local : crée `.env` avec `ANTHROPIC_API_KEY=...`, puis relance `npm run dev`. Sur Netlify : ajoute la variable, puis redéploie |
| La fenêtre « Code d'accès » s'affiche | C'est la valeur de `CODE_ACCES` choisie dans tes variables d'environnement |
| « Le serveur n'a pas répondu à temps » (en ligne) | La génération a dépassé la limite de Netlify : réessaie, ou fais une demande plus courte |
| « Clé API invalide » | Vérifie la clé (pas d'espace ni de guillemets en trop) |
| « Serveur local injoignable » | Le serveur Express n'est pas lancé : utilise `npm run dev` (et non `npx vite` seul) |
| « Trop de demandes » | Limite de débit de l'API atteinte : patiente quelques secondes |
| Port 5173 ou 3001 déjà utilisé | Ferme l'autre programme, ou change `PORT` (et le proxy de `vite.config.ts`) |
