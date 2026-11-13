// Base de savoir de l'Assistant AMAZER, toujours à jour : régénérée depuis les guides du site et docs/SAVOIR-ASSISTANT.md.
// Usage (depuis tools/e2e) : node explainer/savoir.mjs
//   ASSISTANT_SAVOIR=<dossier savoir de l'Assistant>  (par défaut : le dossier de l'Assistant sur ce PC)
// Écrit guides-amazer.json (fiches : une par type d'utilisateur + formules + nouveautés) et faits-amazer.json.
// L'Assistant relit ces fichiers dès qu'ils changent : aucun redémarrage nécessaire.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { GUIDES as PRESENTATION } from "./guides-all.mjs";
import { GUIDES as PAS } from "./pas-a-pas.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(HERE, "../../../docs/SAVOIR-ASSISTANT.md");
const OUT = process.env.ASSISTANT_SAVOIR || "C:/Users/User/Desktop/Amarketing AI/amarketing-ai-v2-1 (1)/amarketing-ai-v2/backend/company/savoir";

const clean = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const steps = (guide) =>
  (guide?.chapters ?? []).flatMap((c) =>
    c.scenes.filter((s) => s.guide).map((s) => ({ titre: clean(s.guide.title), texte: clean([s.guide.text, s.guide.tip].filter(Boolean).join(" ")) }))
  );

/** Une fiche par type d'utilisateur : présentation + étapes exactes du pas à pas (écrans actuels). */
function guideFiche(id, pres, pas) {
  const base = pres ?? pas;
  return {
    id,
    pour: clean(base.who),
    titre: clean(base.title),
    resume: clean(base.lead),
    points: (base.points ?? []).map(([t, txt]) => `${clean(t)} : ${clean(txt)}`),
    etapes: [...steps(pas), ...(pas ? [] : steps(pres))],
    conseils: (pres?.tips ?? pas?.tips ?? []).map(clean),
    faq: [...(pres?.faq ?? []), ...(pas?.faq ?? [])].map(([q, r]) => ({ q: clean(q), r: clean(r) })),
    video: [pres?.video, pas?.video].filter(Boolean).join(" et "),
    pdf: [pres?.pdf, pas?.pdf].filter(Boolean).join(" et "),
  };
}

/** docs/SAVOIR-ASSISTANT.md : « ## Titre » = une fiche, « - … » = son contenu ; « Faits » = faits vérifiés. */
function docSections() {
  const sections = [];
  let current = null;
  for (const line of fs.readFileSync(DOC, "utf-8").split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+)/);
    if (h) {
      current = { titre: h[1].trim(), lignes: [] };
      sections.push(current);
    } else if (current && /^\s*-\s+/.test(line)) {
      current.lignes.push(clean(line.replace(/^\s*-\s+/, "")));
    }
  }
  return sections;
}

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Fiches déjà présentes (ex. stations : propriétaire, responsables de ville, gérants) : gardées et complétées.
const previousFile = path.join(OUT, "guides-amazer.json");
const previous = fs.existsSync(previousFile) ? JSON.parse(fs.readFileSync(previousFile, "utf-8")) : [];
const generatedIds = new Set();
const join = (a, b) => [...new Set([a, b].flatMap((x) => String(x || "").split(" et ")).filter(Boolean))].join(" et ");

const ids = [...new Set([...Object.keys(PRESENTATION), ...Object.keys(PAS)])];
const fiches = ids.map((key) => {
  const id = key === "station" ? "stations" : key;
  generatedIds.add(id);
  const fresh = guideFiche(id, PRESENTATION[key], PAS[key]);
  const old = previous.find((f) => f.id === id);
  if (PRESENTATION[key] || !old) return fresh;
  const seen = new Set(old.etapes.map((e) => e.titre));
  return { ...old, etapes: [...old.etapes, ...fresh.etapes.filter((e) => !seen.has(e.titre))], video: join(old.video, fresh.video), pdf: join(old.pdf, fresh.pdf) };
});
const sections = docSections();
const docIds = new Set(sections.filter((x) => x.titre !== "Faits").map((x) => slug(x.titre)));
// Les autres fiches existantes (ajoutées à la main) restent.
for (const f of previous) if (!generatedIds.has(f.id) && !docIds.has(f.id) && !fiches.some((x) => x.id === f.id)) fiches.push(f);
const faits = sections.find((s) => s.titre === "Faits")?.lignes ?? [];
for (const s of sections.filter((x) => x.titre !== "Faits")) {
  fiches.push({
    id: slug(s.titre),
    pour: "Tout le monde",
    titre: s.titre,
    resume: s.lignes[0] ?? "",
    points: [],
    etapes: s.lignes.map((l) => {
      const [t, ...rest] = l.split(" : ");
      return rest.length ? { titre: t, texte: rest.join(" : ") } : { titre: s.titre, texte: l };
    }),
    conseils: [],
    faq: [],
    video: "",
    pdf: "",
  });
}

fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => {
  const file = path.join(OUT, name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1), "utf-8");
  fs.renameSync(tmp, file); // remplacement d'un coup : l'Assistant ne lit jamais un fichier à moitié écrit
};
write("guides-amazer.json", fiches);
write("faits-amazer.json", { maj: new Date().toISOString(), faits });
console.log(`Savoir de l'Assistant : ${fiches.length} fiches, ${faits.length} faits → ${OUT}`);
