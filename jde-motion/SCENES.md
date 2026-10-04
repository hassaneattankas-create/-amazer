# SCENES.md — Storyboard

Format : **1920×1080 · 60 fps · 30 s**. Les bornes temporelles sont celles de `CLOCK.md`.
Chaque scène décrit : intention narrative · composition · mouvement de caméra · texte ·
transition de sortie.

---

## SCÈNE 1 — ACCROCHE · 0.00 → 4.80

**Intention.** Faire se reconnaître le spectateur en moins de deux secondes : l'entrepreneur
seul face à la complexité.

**Composition.** Plan rapproché, légèrement en contre-plongée. Au centre, un **poste de
travail** : plan de table en perspective (2.5D), lampe à lumière chaude côté droit, écran
bleuté côté gauche, carnet, pile de dossiers. Derrière, une silhouette d'entrepreneur assise,
de trois quarts, traitée en forme pleine `BLUE` sur fond `INK`. Deux sources lumineuses
contradictoires (bleu froid / orange chaud) modèlent la scène.

**Mouvement.** Le décor se construit par strates (plan de table, objets, silhouette). Puis
**cinq cartes-problématiques** flottent en orbite autour de la tête du personnage, en
profondeur variable (parallax), avec un stagger de 0.05 s : `GESTION`, `FISCALITÉ`,
`FINANCEMENT`, `MARKETING`, `DÉVELOPPEMENT`. Elles se resserrent, le halo orange pulse :
sensation de pression. La caméra fait alors un **push-in sec** (zoom 1 → 2.15) pendant que les
cartes sont propulsées hors cadre en `backIn`.

**Texte.** `VOUS ÊTES ENTREPRENEUR ?` — 132 px, capitales, blanc, lettres montant sous un
masque horizontal avec stagger 0.05 s, filet orange qui se trace dessous.

**Transition de sortie.** **Wipe orange diagonal** (lame de 18° qui balaie l'écran de gauche
à droite) — pas de fondu.

---

## SCÈNE 2 — RÉVÉLATION DU JDE · 4.80 → 9.60

**Intention.** Répondre immédiatement : vous n'êtes pas seul, il existe un rendez-vous.

**Composition.** La caméra **recule** (zoom 2.15 → 0.92) et révèle une **salle de
conférence professionnelle** en quatre plans de profondeur :
1. *fond* — mur et grand écran de scène allumé (halo de vidéoprojecteur) ;
2. *plan intervenant* — silhouette debout, bras en geste de présentation, pupitre ;
3. *rangées de participants* — trois rangs de silhouettes décalées, certaines penchées sur
   des carnets (micro-oscillation sinusoïdale déphasée = prise de notes) ;
4. *premier plan flou* — dossiers de chaises et épaules, dessinés en strates d'alpha.

**Mouvement.** Pull-back + léger travelling latéral. Le halo du projecteur s'intensifie
progressivement. Deux participants se tournent l'un vers l'autre (échange).

**Texte.**
- `JEUDI DE L'ENTREPRENEUR` — titre majeur, lettres sous masque, stagger 0.05 s ;
- `Le rendez-vous des entrepreneurs` — 46 px, blanc à 85 %, précédé d'un filet orange animé.

**Transition de sortie.** **Zoom-into-screen** : la caméra plonge dans l'écran de scène, dont
le cadre devient le cadre de la scène 3 (continuité spatiale, aucune coupure).

---

## SCÈNE 3 — QU'EST-CE QUE LE JDE ? · 9.60 → 15.60

**Intention.** Montrer ce qu'on y fait concrètement, avec du rythme.

**Composition & mouvement.** **Travelling latéral continu** à travers quatre tableaux
juxtaposés dans un même espace horizontal (on ne coupe pas, on se déplace) :

| Tableau | Contenu visuel |
|---|---|
| A — *Expertise* | L'expert présente devant un panneau de données : barres et courbe qui se tracent, pointeur. |
| B — *Question* | Un participant lève la main ; un cercle d'attention orange s'ouvre autour de lui. |
| C — *Notes* | Gros plan sur deux carnets, stylos, lignes d'écriture qui apparaissent trait par trait. |
| D — *Networking* | Poignée de main, deux bulles de dialogue qui se répondent, cartes de visite échangées. |

**Texte cinétique.** Trois verbes, un par tableau, en très gros, intégrés dans la
composition (pas posés par-dessus) : `APPRENEZ` (10.15) · `ÉCHANGEZ` (11.35) ·
`AGISSEZ` (12.55). Chacun entre en clip-up avec stagger de lettres et ressort en `backIn`.

Puis la phrase de synthèse en trois segments décalés de 0.22 s :
`Des connaissances pratiques.` / `Des échanges.` / `Des opportunités.`

**Transition de sortie.** **Zoom-cut** avec flash blanc de 5 frames : on passe de la nuit
institutionnelle à un univers clair.

---

## SCÈNE 4 — LES THÉMATIQUES · 15.60 → 21.60

**Intention.** Prouver la richesse et l'utilité concrète des contenus.

**Composition.** Univers clair (`PAPER`), ligne d'horizon basse, **sept stations** disposées
le long d'un axe horizontal de 5600 px, à des profondeurs différentes (certaines hautes,
certaines basses — la caméra serpente légèrement en `y`).

| Station | Objet graphique construit | Mot intégré |
|---|---|---|
| 1 | liasse de formulaires + tampon qui frappe | `FISCALITÉ` |
| 2 | piles de pièces + courbe ascendante | `FINANCEMENT` |
| 3 | tableau de bord à jauges + aiguilles | `GESTION` |
| 4 | cible + ondes de diffusion concentriques | `MARKETING` |
| 5 | devanture de boutique + panier | `COMMERCE` |
| 6 | écran + nœuds de réseau reliés | `DIGITAL` |
| 7 | escalier + flèche montante | `DÉVELOPPEMENT` |

**Mouvement.** Travelling continu, jamais d'arrêt net : chaque objet s'assemble à l'approche
de la caméra (`elasticOut`, stagger interne 0.05 s) et le mot se pose **dans** la scène
(ancré à l'objet, soumis au parallax), jamais comme une puce de liste.

**Transition de sortie.** **Pull-back** vertical : la caméra s'élève, les sept mots se
réorganisent en grille vue de dessus, puis l'image s'assombrit vers `INK`.

---

## SCÈNE 5 — LA COMMUNAUTÉ · 21.60 → 26.00

**Intention.** Faire ressentir l'appartenance : ce n'est pas un cours, c'est un réseau.

**Composition.** Fond `INK` avec halo bleu central. **Quatorze silhouettes** stylisées,
tailles et teintes variées (`BLUE`, `BLUE_LT`, `SAND` discret), entrent depuis les quatre
bords avec un stagger de 0.05 s et convergent vers un **anneau central** orange.

**Mouvement.** Des **lignes de connexion** orange se tracent progressivement entre les
silhouettes (graphe de réseau) ; l'anneau tourne lentement. À 25.05 tout s'aspire vers le
centre et se condense en un point lumineux qui éclate en halo doux.

**Texte.**
- `ENTREPRENEURS • PORTEURS DE PROJETS • PROFESSIONNELS` — 42 px, tracking large, blanc ;
- `APPRENEZ • ÉCHANGEZ • AGISSEZ` — 86 px, trois blocs en `elasticOut`, stagger 0.18 s,
  les puces en orange.

**Transition de sortie.** Le point lumineux devient la source du halo de l'end card
(continuité lumineuse).

---

## SCÈNE 6 — END CARD · 26.00 → 30.00

**Intention.** Mémoriser : qui organise, quoi, quand, et l'appel à venir.

**Composition.** Plan fixe, centré, très respirant. Du haut vers le bas :
1. **logo officiel de la Maison de l'Entreprise du Niger** (asset `assets/logo-men.*`,
   jamais redessiné ni déformé ; lockup typographique de substitution si absent) ;
2. titre `JEUDI DE L'ENTREPRENEUR` — 132 px, capitales, blanc ;
3. filet orange de 6 px (scaleX depuis le centre) ;
4. `Chaque dernier jeudi du mois` — 46 px ;
5. `Rejoignez-nous.` — 52 px, orange.

Un filet d'encadrement fin se trace sur les bords (cadre institutionnel). Quelques
particules d'accent se posent puis s'immobilisent.

**Mouvement.** Entrées séquencées (logo → titre → filet → date → appel), chacune en
`elasticOut` amorti ou `easeOutQuint`. **À partir de t = 29.70 l'image est totalement gelée**
afin que la dernière frame soit exploitable telle quelle comme visuel réseau social.

---

## Logique de progression

| Scène | Question du spectateur | Réponse apportée |
|---|---|---|
| 1 | « Est-ce que ça me concerne ? » | Oui : voilà vos problèmes quotidiens. |
| 2 | « Qu'est-ce que c'est ? » | Le Jeudi de l'Entrepreneur, le rendez-vous des entrepreneurs. |
| 3 | « Qu'est-ce qu'on y fait ? » | On apprend, on échange, on agit. |
| 4 | « On y parle de quoi ? » | Fiscalité, financement, gestion, marketing, commerce, digital, développement. |
| 5 | « Qui y va ? » | Entrepreneurs, porteurs de projets, professionnels — une communauté. |
| 6 | « Quand, et qui l'organise ? » | Chaque dernier jeudi du mois · Maison de l'Entreprise du Niger. |
