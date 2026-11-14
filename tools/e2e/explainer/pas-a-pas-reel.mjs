// Guides « en vrai » : tournés sur le SITE DE TEST (copie locale du site, données fictives), sans aucune simulation.
// Chaque clic enregistre vraiment : on voit le résultat réel à l'écran (nomination, garde, position, livraison…).
// Usage : remettre la base de démonstration (restore_demo.py), puis
//   EXPLAINER_BASE=http://localhost:3200 DEMO_PASSWORD=… GUIDES_SET=reel node explainer/guides.mjs station
import { g } from "./guides-data.mjs";
import { wait } from "./lib.mjs";

export const GUIDES = {};

const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) throw new Error("DEMO_PASSWORD manquant (mot de passe des comptes fictifs du site de test)");

/** Compte fictif du site de test, connecté hors caméra. */
const as = (email) => () => ({ real: true, login: { email, password: PASSWORD } });
const visitor = () => ({ real: true });

const MENU = { selector: "button" };
const LINK = { selector: "a" };
const BTN = { selector: "button" };
const TEXT = { selector: "li,p,span,dd,dt,strong" };

/** Ouvre une section déroulante (sans la refermer si elle est déjà ouverte). */
const open = (f, title) => f.click(title, BTN);

/** Remplace le contenu d'un champ, lettre par lettre. */
async function fill(f, field, value, opts = {}) {
  f.typing = true;
  const ok = await f.click(field, { selector: "input,textarea", ...opts });
  f.typing = false;
  if (!ok) return;
  await f.page.keyboard.down("Control");
  await f.page.keyboard.press("KeyA");
  await f.page.keyboard.up("Control");
  await f.keys(value);
  await wait(300);
}

/** Choisit une valeur dans une liste (select) désignée par son libellé. */
async function choose(f, label, value) {
  if (!(await f.point(label, { selector: "select" }))) return;
  await f.page.select("[data-xp-last]", value).catch(() => {});
  await wait(500);
}

/** Position du téléphone (GPS) : Niamey, quartier du Plateau. */
async function gps(f, latitude = 13.5205, longitude = 2.1046) {
  await f.page.browserContext().overridePermissions(new URL(f.page.url()).origin, ["geolocation"]);
  await f.page.setGeolocation({ latitude, longitude });
}

const intro = (who) => `Cette vidéo est tournée sur une copie du vrai site AMAZER : chaque clic que vous voyez fonctionne vraiment. ${who}`;

// ================================================================ Stations-essence : les trois rôles, en vrai
GUIDES.station = {
  who: "Stations-essence", title: "Mes stations, en vrai", subtitle: "Propriétaire · Responsable de ville · Gérant",
  video: "AMAZER_pas-a-pas-station.mp4", pdf: "AMAZER-Pas-a-pas-station.pdf",
  lead: "Le **propriétaire** nomme un responsable par ville, le **responsable de ville** nomme les gérants, le **gérant** tient sa station à jour : **carburants**, **horaires**, **garde**, **position**, **livraisons**, **retours clients**.",
  points: [["Le propriétaire", "Nomme et suit tout."], ["Le responsable", "Nomme les gérants de sa ville."], ["Le gérant", "Met sa station à jour."]],
  intro: intro("Aujourd'hui : la marque Sahel Énergie et sa station du Plateau, à Niamey."),
  outro: "Le propriétaire nomme, le responsable organise, le gérant met à jour : vos clients savent où trouver du carburant. Rendez-vous sur amazer.store.",
  end: ["Vos stations, à jour", "amazer.store · Stations-essence"],
  chapters: [
    {
      title: "Le propriétaire nomme un responsable de ville",
      intro: "Le propriétaire de la marque se connecte : son espace s'ouvre sur ses stations.",
      persona: as("sahel.energie@exemple.com"), route: "/seller/dashboard",
      scenes: [
        { say: "Hamidou, propriétaire de Sahel Énergie, se connecte. Son espace montre l'état de toutes ses stations.",
          do: (f) => f.point("Vue d'ensemble", BTN), guide: g("Votre espace", "Connecté, le propriétaire voit l'**état de ses stations** (section **Vue d'ensemble**).") },
        { say: "Il ouvre Responsables par ville, choisit Niamey, et écrit l'e-mail d'Ibrahim. Puis il touche Ajouter un responsable.",
          do: async (f) => {
            await open(f, "Responsables par ville");
            await choose(f, "Ville", "Niamey");
            await fill(f, "responsable@exemple.com", "ibrahim@exemple.com");
            await f.click("Ajouter un responsable", BTN);
            await wait(1500);
          },
          guide: g("Nommez un responsable", "**Responsables par ville** : choisissez la **ville**, écrivez l'**e-mail** du compte AMAZER de la personne, puis **Ajouter un responsable**.") },
        { say: "C'est fait : Ibrahim est responsable de Niamey. Il lui suffisait d'avoir un compte AMAZER gratuit, avec cet e-mail.",
          do: (f) => f.point("Ibrahim Moussa", TEXT), guide: g("Responsable nommé", "La personne apparaît sous sa ville. Elle doit d'abord avoir créé son **compte AMAZER gratuit**.") },
      ],
    },
    {
      title: "Le responsable de ville nomme le gérant",
      intro: "Le responsable se connecte avec son compte : **Menu** → **Espace station**.",
      persona: as("ibrahim@exemple.com"), route: "/",
      scenes: [
        { say: "Ibrahim se connecte avec son compte. Il touche Menu, puis Espace station.",
          do: async (f) => { await f.click("Menu", MENU); await f.click("Espace station", LINK); }, guide: g("Espace station", "**Menu** → **Espace station**.") },
        { say: "Il ouvre sa ville, Niamey, puis Stations : voici toutes les stations Sahel Énergie de la ville.",
          do: async (f) => { await open(f, "Niamey"); await open(f, "Stations"); }, guide: g("Sa ville", "Il ouvre **Niamey**, puis **Stations**.") },
        { say: "Il ouvre la station du Plateau, puis Gérants, et touche Ajouter un gérant. Il écrit l'e-mail d'Awa, puis touche Ajouter.",
          do: async (f) => {
            await open(f, "Plateau");
            await f.click("Gérants", BTN);
            await f.click("Ajouter un gérant", BTN);
            await fill(f, "gerant@exemple.com", "awa@exemple.com");
            await f.click("Ajouter", BTN);
            await wait(1500);
          },
          guide: g("Nommez le gérant", "Station → **Gérants** → **Ajouter un gérant** : écrivez l'**e-mail** du compte de la personne, puis **Ajouter**.") },
        { say: "Awa est gérante de la station. Dans Activité des gérants, Ibrahim verra tout ce qu'elle fait.",
          do: async (f) => { await f.point("Awa Issoufou", TEXT); await open(f, "Activité des gérants"); }, guide: g("Le suivi", "**Activité des gérants** : qui a fait quoi, et quand.") },
      ],
    },
    {
      title: "La gérante tient sa station à jour",
      intro: "La gérante se connecte : **Menu** → **Espace station**, sa station s'affiche.",
      persona: as("awa@exemple.com"), route: "/gerant-station",
      scenes: [
        { say: "Awa se connecte, et ouvre son Espace station. Sa station du Plateau s'affiche.",
          do: async (f) => { await open(f, "Plateau"); await open(f, "Disponibilités"); }, guide: g("Sa station", "**Espace station** : la station s'affiche avec ses sections.") },
        { say: "Pour chaque carburant, un seul geste. Ce matin, plus de gasoil : elle touche Rupture. Les clients le voient aussitôt.",
          do: async (f) => { await f.click("Rupture", { ...BTN, nth: 1 }); await wait(1200); }, guide: g("Les disponibilités", "Pour chaque carburant : **Disponible**, **Stock faible** ou **Rupture**. Les clients le voient aussitôt.") },
        { say: "Dans Informations et horaires, elle écrit l'adresse et les horaires, puis touche Enregistrer.",
          do: async (f) => {
            await open(f, "Informations et horaires");
            await fill(f, "Ex. Avenue de la Mairie", "Avenue de la Mairie, Plateau");
            await fill(f, "Ex. 6 h – 23 h ou 24 h/24", "24 h/24");
            await f.click("Enregistrer", BTN);
            await wait(1200);
          },
          guide: g("Informations", "**Informations et horaires** : adresse, téléphone, horaires, services, puis **Enregistrer**.") },
        { say: "Cette nuit, la station est de garde. Dans Garde, elle choisit Jusqu'à nouvel ordre, puis touche Mettre de garde.",
          do: async (f) => {
            await open(f, "Garde");
            await f.click("Jusqu'à nouvel ordre", BTN);
            await f.click("Mettre de garde", BTN);
            await wait(1500);
          },
          guide: g("La garde", "Section **Garde** : **Jusqu'à nouvel ordre** ou **Jusqu'à une date**, puis **Mettre de garde**.") },
        { say: "Dans Position Google Maps, debout à la station, elle touche Je suis à la station. La position est enregistrée : les clients auront le bon itinéraire.",
          do: async (f) => {
            await gps(f);
            await open(f, "Position Google Maps");
            await f.click("Je suis à la station", BTN);
            await wait(2500);
            await f.point("Position enregistrée", TEXT);
          },
          guide: g("La position", "**Position Google Maps** → **Je suis à la station**, une seule fois, **à la station**.") },
        { say: "Un camion arrive. Dans Livraisons, elle choisit le carburant, écrit la quantité, puis touche Enregistrer la livraison.",
          do: async (f) => {
            await open(f, "Livraisons");
            await fill(f, "Ex. 15000", "15000");
            await f.click("Enregistrer la livraison", BTN);
            await wait(1500);
          },
          guide: g("Les livraisons", "**Livraisons** : carburant, **litres**, numéro du bon, puis **Enregistrer la livraison**.") },
        { say: "Dans Retours clients, un client a signalé un problème. Elle touche Marquer traité, explique ce qu'elle a fait, puis Confirmer.",
          do: async (f) => {
            await open(f, "Retours clients");
            await f.click("Marquer traité", BTN);
            await fill(f, "Ex. Gaz livré ce matin, statut corrigé.", "Statut corrigé : rupture de gasoil.");
            await f.click("Confirmer", BTN);
            await wait(1500);
          },
          guide: g("Retours clients", "**Retours clients** : **Marquer traité**, expliquez en une phrase, puis **Confirmer**.") },
      ],
    },
    {
      title: "Le propriétaire suit tout",
      persona: as("sahel.energie@exemple.com"), route: "/seller/dashboard",
      scenes: [
        { say: "De son côté, le propriétaire voit tout dans Activité : qui a fait quoi, dans quelle station, et quand.",
          do: async (f) => { await open(f, "Activité"); await f.scroll(140); }, guide: g("L'activité", "**Activité** : chaque mise à jour, avec son auteur et l'heure.") },
      ],
    },
    {
      title: "Ce que voient les clients",
      intro: "**Menu** → **Premium** → **Stations-essence** : la liste et la **carte**.",
      persona: visitor, route: "/",
      scenes: [
        { say: "Les clients touchent Menu, puis Premium, puis Stations-essence.",
          do: async (f) => { await f.click("Menu", MENU); await f.click("Premium", MENU); await f.click("Stations-essence", LINK); }, guide: g("La page Stations", "**Menu** → **Premium** → **Stations-essence**.") },
        { say: "Chaque station montre ses carburants, à jour. Le filtre De garde montre les stations ouvertes cette nuit : voici le Plateau.",
          do: async (f) => { await f.click("De garde", BTN); await wait(1200); await f.point("Plateau", TEXT); }, guide: g("De garde", "Le filtre **De garde** montre les stations de garde.") },
        { say: "Avec Voir la carte, les stations autour du client : vert, disponible ; orange, stock faible ; rouge, rupture. Le cercle, c'est la station de garde.",
          do: async (f) => {
            await gps(f, 13.5137, 2.1098);
            await f.click("Toutes", BTN);
            await f.click("Voir la carte", BTN);
            await wait(3500);
            await f.point("Cerclé : de garde", { selector: "li" });
          },
          guide: g("La carte", "**Voir la carte** : vert = disponible, orange = stock faible, rouge = rupture, **cercle = de garde**.") },
      ],
    },
  ],
  tips: ["Mettez à jour **dès qu'un carburant change**.", "Enregistrez la position **une seule fois, à la station**.", "Notez **chaque livraison** de camion."],
  faq: [["Je ne vois pas Espace station ?", "Votre responsable de ville doit vous ajouter avec **le même e-mail** que votre compte."], ["Qui peut nommer qui ?", "Le **propriétaire** nomme les responsables de ville ; chaque **responsable** nomme les gérants de ses stations."]],
};
