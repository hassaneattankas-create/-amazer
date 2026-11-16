# Pubs à personnages AMAZER — notice

Dessin animé 2D (personnages nigériens) + **vraies scènes de la plateforme** (écrans réels du site, filmés sur le
site de test avec des données fictives), voix off française, bruitages, vertical 1080×1920.

## Fabriquer un film

```bash
cd motion/amazer-pro
node toon-make.mjs scripts/toon2.json --apercu   # ~1 min : voix + planche de 12 images (qa/toon2_apercu.png)
node toon-make.mjs scripts/toon2.json            # film complet : out/AMAZER_<nom>.mp4 + _leger.mp4 + planche
```

L'Assistant AMAZER fait la même chose avec son outil **pub_personnages** (Studio › file d'attente « personnages »).

## Script

```json
{ "id": "toon3", "nom": "pub-…", "titre": "…", "voix": "fr-FR-DeniseNeural", "vitesse": "+6%",
  "scenes": [ { "type": "rue_chaleur", "voix": "Phrase dite pendant la scène" }, … ] }
```

| Type | Ce qu'on voit | Paramètres |
|---|---|---|
| `rue_chaleur` | Aïcha porte 25 kg de riz sur la tête sous 42 °C, sue, pose le sac | `sous_titres`, `temperature` |
| `maison_ombre` | elle s'affale à l'ombre sous le ventilateur, sort son téléphone | `transition: "balayage"` |
| `ecrans` | **vrais écrans** dans un téléphone 3D tenu en main, le pouce touche les boutons | `ecrans: [{img, de, texte, taps:[{cible, at}], scroll:{vers, de, a, place}}]`, `succes`, `fin` |
| `boutique` | Moussa reçoit la commande (vrai écran vendeur), pose le sac, Ibrahim le prend | `ecran`, `tap:{cible}`, `enseigne` |
| `moto` | Ibrahim prend la course (vrai écran livreur) puis traverse Niamey | `ecran`, `tap:{cible}`, `scroll:{vers}` |
| `portail` | il frappe, Aïcha montre son vrai reçu (QR), scan, « Livraison confirmée » | `recu`, `recuScroll` (px) ou `recuVers`, `confirme` |
| `fin` | carte orange : logo, slogan, amazer.store, les trois personnages | `slogan`, `mention`, `sous_titres_voix` |

- `de`, `at` : secondes depuis le début de la scène. `texte` / `sous_titres` : autocollants, `*mot*` = en orange.
- `cible` : texte exact d'un bouton de l'écran (liste dans `assets/screens/positions.json`).
- Chaque scène dure au moins sa durée minimale ; une phrase plus longue allonge la scène.

## Écrans réels

`assets/screens/*.png` (390×844 à 2×) et `*-long.png` (page entière, pour défiler), tournés par
`scratchpad/e2e/capture_toon.cjs` sur le site de test : boutique fictive « Boutique Moussa » (marque « Sahel »),
cliente fictive « Aïcha Issoufou ». Jamais de vraies boutiques, jamais de numéro de paiement factice à l'écran
(l'étape 1 de la page de paiement est cachée par le défilement).

## Fichiers

`src/kit/toon.js` (personnages, moto) · `src/kit/toon-scenes.js` (scènes) · `src/kit/toon-film.js` (montage
depuis le script et la voix) · `toon.html` (scène 1080×1920) · `toon-make.mjs` (chaîne complète).
