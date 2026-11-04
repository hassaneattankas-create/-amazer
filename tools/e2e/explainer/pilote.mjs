// Essai court : vérifie l'enregistrement, la souris, les sous-titres et la voix.
import { Film } from "./lib.mjs";

const film = new Film("pilote");
await film.make(
  [
    { say: "Voici la page Vendre sur AMAZER.", before: (f) => f.goto("/vendre"), do: (f) => f.point("Choisir Boutique") },
    { say: "Touchez ce bouton pour commencer.", do: (f) => f.click("Choisir Boutique") },
  ],
  "explainer/.work/pilote.mp4",
);
