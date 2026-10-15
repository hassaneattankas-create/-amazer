# Pub « Affiliation AMAZER » — 30 s

Moteur : Canvas déterministe (même contrat que `jde-motion/`, sans licence).
Rendu : 1920×1080 · 60 fps · 1800 images · H.264 yuv420p · voix off WAV.

## BRIEF
| Champ | Choix |
|---|---|
| Objectif | acquisition d'affiliés |
| Audience | Nigériens 18–45 ans, très actifs sur WhatsApp, sur téléphone |
| Message unique | **Partagez votre lien AMAZER, gagnez de l'argent.** |
| Preuves | 20 % de l'abonnement des vendeurs parrainés pendant 12 mois · 250 F par nouveau client (1re commande livrée) · gratuit · paiement Nita/Amana |
| Ton | énergique et chaleureux, premium |
| Durée / format | 30 s · 16:9 (PowerPoint, YouTube, Facebook) |
| Contraintes | montants = réglages actuels (mention « octobre 2026 ») ; logo jamais déformé |

## CONCEPT
On montre un lien qui part d'un téléphone et revient en argent, pour faire ressentir que **partager = gagner**.

## LOOK
- Palette : nuit `#0B1220` · orange AMAZER `#FF4D00` · pêche `#FDBA74` · crème `#FFF7F2`.
- Typo : Segoe UI (Black 900 titres, Bold 700, Semibold 600) ; jamais < 34 px pour un texte clé.
- Mouvement : mots qui montent depuis un masque (stagger 0,06 s), Pop à 8 % d'élan pour les gains, filet orange qui se trace.
- Fin sur fond crème : visuel réutilisable pour les réseaux sociaux.

## KIT
Bulles de discussion → pièces · téléphone (page Affiliation) · puce de lien · nœuds « Vous » / « Vendeur » · compteur 20 % · 12 pastilles-mois · suivi de commande 3 étapes · « +250 F » · cartes « Gratuit » / « Nita ou Amana » · logo + CTA.

## SCÈNES & CLOCK (secondes)
| # | Image | Voix off (début) |
|---|---|---|
| 1 | 0,0–2,5 · Accroche « Vous partagez déjà sur WhatsApp ? », bulles autour | 0,40 V1 |
| 2 | 2,45–5,6 · « Et si chaque partage vous rapportait ? » ; les bulles deviennent des pièces ; poussée caméra | 2,60 V2 |
| 3 | 5,4–9,0 · Téléphone, 3 étapes, appui sur « Copier mon lien », la puce s'envole | 5,80 V3 |
| 4 | 8,85–14,3 · Le lien va au vendeur → « 20 % » + 12 mois | 9,00 V4 |
| 5 | 13,9–19,2 · Panoramique ; commande → livrée → « +250 F » | 14,20 V5 |
| 6 | 19,1–22,3 · « Gratuit. » + cartes Nita / Amana ; volet diagonal orange | 19,30 V6 |
| 7 | 22,2–30,0 · Logo, « Partagez. Gagnez. », CTA amazer.store/affiliation (maintien 4 s) | 22,20 V7 |

Voix provisoire : Windows « Hortense » (`tts.ps1`). Pour une voix humaine : enregistrer
`voice.wav` d'une seule prise en suivant ces repères, puis `node compile.js`.
