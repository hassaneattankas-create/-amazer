// Les vidéos explicatives AMAZER. Usage : node explainer/films.mjs [stations|vendeurs|revendeurs]
// Serveur attendu sur http://localhost:3100 (frontend construit). Les stations utilisent une marque fictive.
import path from "path";

import { Film, assemble, wait } from "./lib.mjs";
import { scenarios } from "./stations-data.mjs";

const OUT = process.env.EXPLAINER_OUT || "C:/Users/User/Desktop/Videos AMAZER";
const FORM = { selector: "button[type=submit]" };

async function attempt(run) {
  for (let i = 1; ; i += 1) {
    try {
      return await run();
    } catch (err) {
      if (i >= 3) throw err;
      console.log(`  nouvel essai (${String(err.message).slice(0, 60)})`);
    }
  }
}

async function part(name, opts, scenes) {
  const out = path.resolve("explainer/.work", `${name}.mp4`);
  await attempt(() => new Film(name, opts).make(scenes, out));
  return out;
}

const card = (route, big, small) => async (f) => {
  await f.goto(route);
  await f.title(big, small);
  await wait(300);
};

/** Le gérant de la démo : les changements restent à l'écran comme sur le vrai site. */
function gerantMocks() {
  const mocks = scenarios.gerant.mocks;
  const entry = mocks.find(([pattern]) => pattern.source.includes("station-manager"));
  const outlets = typeof entry[1] === "function" ? entry[1]("") : entry[1];
  entry[1] = outlets;
  return {
    mocks,
    onWrite(url, body, method) {
      const outlet = outlets.find((o) => url.includes(o.id));
      if (method === "PUT" && outlet) {
        if (body.fuel) Object.assign(outlet.fuel, body.fuel);
        outlet.fuel_updated_at = new Date().toISOString();
        outlet.fuel_fresh = true;
        return outlet;
      }
      if (url.endsWith("/deliveries")) return { id: "d-new", outlet_id: outlet?.id, outlet_name: outlet?.name, fuel: body.fuel, liters: body.liters, reference: body.reference ?? null, delivered_at: new Date().toISOString(), recorded_by: "Vous" };
      return {};
    },
  };
}

async function stations() {
  const owner = { mocks: scenarios.owner.mocks, user: true };
  const city = { mocks: scenarios.city.mocks, user: true };
  const gerant = { ...gerantMocks(), user: true };
  gerant.onWriteHandler = gerant.onWrite;
  const parts = [];
  parts.push(await part("st-intro", owner, [
    { say: "Cette vidéo vous montre comment gérer vos stations sur AMAZER. Il y a trois rôles : le propriétaire de la marque, le responsable de ville, et le gérant de station. Voyons ce que fait chacun.", caption: false, before: card("/seller/dashboard", "Gérer ses stations", "Propriétaire · Responsable de ville · Gérant") },
  ]));
  await attempt(() => { const ownerPart = new Film("st-owner", owner); ownerPart.onWrite = () => []; return ownerPart.make([
    { say: "Le propriétaire se connecte à son compte. Il voit tout de suite l'état de ses stations.", before: (f) => f.goto("/seller/dashboard"), do: (f) => f.point("Stations à jour", { selector: "dt,p,span" }) },
    { say: "Son rôle est simple : nommer un responsable par ville. Il ouvre cette catégorie.", do: (f) => f.click("Responsables par ville") },
    { say: "Il écrit l'e-mail du responsable, puis il l'ajoute. Cette personne doit d'abord créer un compte AMAZER gratuit.", do: async (f) => { await f.type("responsable@exemple.com", "ibrahim@exemple.com"); await f.point("Ajouter un responsable", FORM); } },
    { say: "Ensuite, il suit tout. Dans Activité, il voit qui a fait quoi, et quand, dans toutes ses stations.", do: async (f) => { await f.click("Activité"); await f.scroll(160); } },
    { say: "Dans Stations par ville, il retrouve chaque station, ville par ville.", do: (f) => f.click("Stations par ville") },
    { say: "Et dans Abonnement, il voit son prix. Tous les outils sont compris : seul l'ajout de stations est facturé, selon les paliers.", do: (f) => f.click("Abonnement et export") },
  ], path.resolve("explainer/.work/st-owner.mp4")); });
  parts.push(path.resolve("explainer/.work/st-owner.mp4"));
  parts.push(await part("st-city", city, [
    { say: "Voici maintenant le responsable de ville. Il se connecte avec son compte, et son Espace station s'ouvre directement.", before: (f) => f.goto("/gerant-station"), do: (f) => f.point("Mes villes", { selector: "h2" }) },
    { say: "Il ouvre sa ville et voit toutes ses stations.", do: async (f) => { await f.click("Niamey"); await f.click("Stations"); } },
    { say: "Pour créer une station, il touche ce bouton, puis il donne son nom.", do: async (f) => { await f.click("Ajouter une station à Niamey"); await f.type("Ex. Station Plateau", "Station du Marché"); await wait(500); await f.click("Fermer"); } },
    { say: "Pour nommer un gérant, il ouvre la station, puis l'onglet Gérants, et il ajoute l'e-mail de la personne.", do: async (f) => { await f.click("Sahel Énergie Plateau"); await f.click("Gérants"); await f.click("Ajouter un gérant"); await f.type("gerant@exemple.com", "awa@exemple.com"); } },
    { say: "Dans Activité des gérants, il suit ce que fait chacun. Le propriétaire voit tout cela lui aussi.", do: async (f) => { await f.click("Activité des gérants"); } },
  ]));
  parts.push(await part("st-gerant", gerant, [
    { say: "Enfin, le gérant. Dès qu'il se connecte, il arrive sur sa station.", before: (f) => f.goto("/gerant-station"), do: (f) => f.point("Mes stations", { selector: "h2" }) },
    { say: "Le plus important : les disponibilités. Un seul geste suffit. Ici, plus de gasoil : il touche Rupture. Les clients le voient aussitôt.", do: async (f) => { await f.click("Rupture", { nth: 1 }); } },
    { say: "Dans Informations et horaires, il indique l'adresse, le téléphone, les horaires et les services.", do: (f) => f.click("Informations et horaires") },
    { say: "Dans Position Google Maps, il se place à la station et touche ce bouton. Les clients auront le bon itinéraire.", do: async (f) => { await f.click("Position Google Maps"); await f.point("Je suis à la station"); } },
    { say: "Quand un camion arrive, il note la livraison : le carburant, la quantité, et le numéro du bon.", do: async (f) => { await f.click("Livraisons"); await f.type("Ex. 15000", "15000"); await f.click("Enregistrer la livraison", FORM); } },
    { say: "Et dans Retours clients, il traite les erreurs signalées par les clients.", do: (f) => f.click("Retours clients") },
  ]));
  parts.push(await part("st-outro", owner, [
    { say: "Voilà. Le propriétaire nomme, le responsable organise, le gérant met à jour. Rendez-vous sur amazer.store.", caption: false, before: card("/seller/dashboard", "amazer.store", "Essence, gasoil, gaz : vos clients savent où aller") },
  ]));
  assemble(parts, `${OUT}/AMAZER_guide6_stations.mp4`);
}

async function vendeurs() {
  const parts = [];
  parts.push(await part("ve-intro", {}, [
    { say: "Vous avez des produits à vendre ? Sur AMAZER, vous n'êtes pas seul à les vendre. Des revendeurs et des affiliés travaillent pour vous. Voici comment.", caption: false, before: card("/vendre", "Vendez plus, sans effort de plus", "Votre boutique, vos revendeurs, vos affiliés") },
  ]));
  parts.push(await part("ve-page", {}, [
    { say: "Tout commence ici. Vous créez votre boutique, vous publiez vos produits avec vos prix.", before: (f) => f.goto("/vendre"), do: (f) => f.point("Vendez sur AMAZER", { selector: "h1" }) },
    { say: "Vous recevez le prix entier de vos articles. La commission et les frais AMAZER sont payés par le client.", do: (f) => f.scroll(260) },
  ]));
  parts.push(await part("ve-revendeurs", {}, [
    { say: "Première opportunité : les revendeurs. Ce sont des personnes qui veulent revendre vos produits à votre place.", before: (f) => f.goto("/revendre"), do: (f) => f.point("Revendez sans stock", { selector: "h1" }) },
    { say: "Le revendeur choisit votre produit et ajoute sa marge. Vous gardez votre prix, et lui gagne la différence.", do: (f) => f.point("Choisissez des produits", { selector: "li,p,span" }) },
    { say: "Puis il partage le produit sur WhatsApp, Facebook et TikTok. Sans rien payer, vous avez de la publicité pour vos produits.", do: (f) => f.point("Partagez votre lien", { selector: "li,p,span" }) },
    { say: "Quand il vend, vous préparez la commande et AMAZER livre. C'est gagnant pour tout le monde.", do: (f) => f.point("Encaissez votre marge", { selector: "li,p,span" }) },
  ]));
  parts.push(await part("ve-affilies", {}, [
    { say: "Deuxième opportunité : les affiliés. Ils font connaître AMAZER autour d'eux.", before: (f) => f.goto("/affiliation"), do: (f) => f.point("Programme d'affiliation", { selector: "h1" }) },
    { say: "Les clients qu'ils amènent sur la plateforme peuvent voir vos produits et les acheter.", do: (f) => f.point("Vous amenez un client", { selector: "h2,h3,p,span" }) },
  ]));
  parts.push(await part("ve-outro", {}, [
    { say: "Votre boutique, vos revendeurs, vos affiliés : plus de monde vend pour vous. Créez votre boutique sur amazer.store.", caption: false, before: card("/vendre", "Créez votre boutique", "amazer.store") },
  ]));
  assemble(parts, `${OUT}/AMAZER_guide7_vendeurs-revendeurs-affilies.mp4`);
}

async function revendeurs() {
  const parts = [];
  parts.push(await part("re-intro", {}, [
    { say: "Vous êtes revendeur ou affilié sur AMAZER ? Voici comment vous y prendre, et comment mieux vendre.", caption: false, before: card("/revendre", "Comment mieux vendre", "Conseils pour revendeurs et affiliés") },
  ]));
  parts.push(await part("re-revendeur", {}, [
    { say: "Le revendeur vend sans stock. La boutique prépare, AMAZER livre, et vous gardez la marge.", before: (f) => f.goto("/revendre"), do: (f) => f.point("Revendez sans stock", { selector: "h1" }) },
    { say: "Votre abonnement revendeur s'active quand vous le payez. Il n'y a pas de jours d'essai, mais vous payez quand vous êtes prêt.", do: (f) => f.scroll(120) },
    { say: "Premier conseil : choisissez des produits que vous aimez et que vos proches achètent déjà. Touchez ici pour les voir.", do: (f) => f.click("Choisir des produits à revendre") },
    { say: "Deuxième conseil : gardez une petite marge. Un prix juste se vend plus vite et plus souvent.", do: (f) => f.point("Fixez votre prix", { selector: "li,p,span" }) },
    { say: "Troisième conseil : montrez le produit. Publiez une vraie photo, le prix, et votre lien sur votre statut WhatsApp, chaque jour.", do: (f) => f.point("Partagez votre lien", { selector: "li,p,span" }) },
    { say: "Quatrième conseil : répondez vite. Le client qui attend, achète ailleurs.", do: (f) => f.scroll(-120) },
  ]));
  parts.push(await part("re-affilie", {}, [
    { say: "Passons à l'affilié. L'inscription est gratuite, sans stock et sans abonnement.", before: (f) => f.goto("/affiliation"), do: (f) => f.point("Programme d'affiliation", { selector: "h1" }) },
    { say: "Vous gagnez de deux façons : une part de l'abonnement du vendeur que vous amenez, et un bonus sur la première commande livrée du client que vous amenez.", do: (f) => f.point("Vous amenez un vendeur", { selector: "h2,h3,p,span" }) },
    { say: "La page vous donne les arguments et des messages prêts à envoyer. Vous n'avez qu'à les copier.", do: async (f) => { await f.point("Quoi dire aux vendeurs", { selector: "h2,h3,p,span" }); await f.scroll(420); } },
    { say: "Le conseil qui marche : passez voir le commerçant, aidez-le à publier ses cinq premiers produits avec de belles photos, puis partagez sa boutique.", do: (f) => f.point("Le conseil qui marche", { selector: "p,span,strong" }) },
  ]));
  parts.push(await part("re-outro", {}, [
    { say: "Commencez aujourd'hui sur amazer.store. Les formations gratuites vous attendent.", caption: false, before: card("/revendre", "À vous de jouer", "amazer.store") },
  ]));
  assemble(parts, `${OUT}/AMAZER_guide8_revendeurs-affilies-mieux-vendre.mp4`);
}

const wanted = process.argv[2];
for (const [name, run] of Object.entries({ stations, vendeurs, revendeurs })) {
  if (!wanted || wanted === name) await run();
}
