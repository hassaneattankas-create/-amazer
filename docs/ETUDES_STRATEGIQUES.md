# AMAZER — Études : livraison, international, WhatsApp, paiements, coûts

Rédigé le 2026-10-13. Ce document sépare **ce qui existe**, **ce qui est recommandé**
et **ce qui reste à vérifier auprès des partenaires**. Aucune intégration externe n'est
présentée comme disponible tant qu'elle n'a pas été vérifiée.

---

## 1. Livraison (Partie 9)

### Ce qui existe
| Élément | État |
|---|---|
| Modes | Standard et Express Niamey |
| Frais | Comptés **par boutique** dans une commande. Calculés côté serveur et affichés avant la confirmation. |
| Frais par quartier | Réglables par l'admin (Finance → quartiers). **Appliqués au panier et à la commande depuis le 2026-10-13** (avant, ils étaient ignorés). |
| Suivi | Manuel : le vendeur fait avancer sa préparation, l'admin passe la commande « en livraison » puis « livrée », et le client confirme la réception. |
| Gratuité | Aucune : les frais sont payés par le client, comme prévu. |

### Partenaires (Amana, Niger Poste…)
- **Aucune API publique de suivi de colis n'a été identifiée.** Ne rien promettre aux clients tant qu'un accord technique n'existe pas.
- Démarche recommandée :
  1. obtenir des grilles tarifaires écrites ;
  2. demander s'il existe une API, ou au minimum un export des statuts ;
  3. tester sur quelques envois en saisissant les statuts manuellement (le système actuel le permet déjà).
- Le modèle de données le permet déjà : le statut « en livraison » est posé par l'admin. Un futur partenaire alimenterait ce même statut.

### Recommandation
Garder la livraison **gérée par le vendeur ou par AMAZER en manuel** au lancement. Remplir les
tarifs par quartier de Niamey dans l'admin. Ne passer à un partenaire qu'après un volume
de commandes qui le justifie.

---

## 2. Fournisseurs internationaux (Partie 7)

| Scénario | Besoin | Recommandation |
|---|---|---|
| A — produit en stock | Déjà couvert (stock et prix par vendeur) | Lancement |
| C — commande spéciale | Afficher « sur commande » et un délai réaliste | **Prochaine étape utile**, peu coûteuse |
| B — revente depuis l'étranger | Prix fournisseur, devise, taux, marge, délai, frais d'import | Après validation commerciale |
| D — catalogue international | Accords, droits d'utilisation des catalogues, douane, retours | Long terme |

### Évolution technique minimale proposée (non développée)
Sur chaque offre (`prices`) :
- `availability` : `in_stock` | `on_order` ;
- `lead_time_days` : délai annoncé ;
- `origin_country` : pays d'origine (optionnel).

Affichage client : « Disponible » ou « Sur commande — environ N jours ». Une offre sur
commande ne doit jamais apparaître comme livrable immédiatement.

### Points juridiques et commerciaux à clarifier avant le scénario B
- Qui est le vendeur légal (la boutique ou AMAZER) ?
- Qui paie la douane et les frais d'import ?
- Que se passe-t-il en cas de retard ou de rupture ?
- Quelle politique de retour ?
- Avez-vous le droit de reprendre les photos et descriptions du fournisseur ?

---

## 3. Notifications WhatsApp (Partie 10)

### Ce qui existe
- Le code d'envoi des **codes de vérification** par l'API WhatsApp Cloud de Meta est en place (`verification_delivery_service.py`). Il est **inactif** : `WHATSAPP_ACCESS_TOKEN` et `WHATSAPP_PHONE_NUMBER_ID` sont absents sur Render.
- Les notifications de commandes et de messages sont envoyées **dans l'application** (et en push mobile si c'est configuré). Rien n'est envoyé par WhatsApp aujourd'hui.

### Pour activer WhatsApp (action du propriétaire)
1. Créer un compte **Meta Business** et le faire vérifier.
2. Dans Meta for Developers, créer une application WhatsApp et y ajouter un **numéro dédié**. Un numéro WhatsApp personnel déjà utilisé ne convient pas.
3. Faire approuver un **modèle de message** pour les codes (catégorie « authentification »).
4. Ajouter `WHATSAPP_ACCESS_TOKEN` (jeton permanent) et `WHATSAPP_PHONE_NUMBER_ID` sur Render.
5. **Coût** : Meta facture les messages à l'unité, selon le pays et la catégorie. Le tarif pour le Niger est **à vérifier** sur la grille officielle de Meta au moment de l'activation.

Un numéro WhatsApp ordinaire ne permet pas d'envoyer des messages automatiques en volume.

---

## 4. Paiements (Partie 8)

**Décision du propriétaire (2026-10-13)** : on garde **Nita**, avec une confirmation
manuelle par l'admin. Un autre moyen de paiement sera ajouté plus tard.

Pistes à étudier le moment venu (Wave, Moov Money, Zamani Cash, Coris Money, Ecobank).
Pour chacune, vérifier :
- la disponibilité au Niger ;
- l'existence d'une API marchande ;
- les frais et le contrat ;
- les notifications de paiement envoyées au serveur ;
- les remboursements.

**Aucune de ces API n'a été vérifiée** : ce sont des pistes, pas des partenaires.
L'architecture est prête : un paiement n'est confirmé qu'après vérification côté serveur
(voir le flux Amana). Un nouveau prestataire suivrait le même principe.

---

## 5. Coûts et dépendances (Partie 17)

| Service | Rôle | Offre actuelle | Limite à surveiller | Risque |
|---|---|---|---|---|
| Vercel | Site web | Hobby (gratuit) | **L'offre Hobby est réservée à un usage non commercial** selon les conditions de Vercel | ⚠️ À régler avant le lancement commercial : Vercel Pro (payant) ou un autre hébergeur |
| Render | API | Gratuit | Mise en veille après 15 min (compensée par le ping GitHub), ports SMTP bloqués | Démarrage lent si le ping est désactivé |
| Neon | Base PostgreSQL | Gratuit | 0,5 Go, 100 h de calcul par mois, restauration sur 6 h | Saturation ; base aux États-Unis, ce qui ajoute de la latence |
| Backblaze B2 | Images | Gratuit jusqu'à 10 Go (1 $ crédité versé) | Au-delà : facturation au Go | Faible |
| Brevo | E-mails | Gratuit, 300 par jour | Clé SMTP à renouveler (13/10/2027 ou après 90 jours sans envoi) | Faible |
| GitHub | Code, CI, sauvegardes | Gratuit (dépôt public) | Tâches planifiées coupées après 60 jours sans commit | Ping et sauvegardes interrompus |
| Contabo | Passerelle de paiement (IP fixe) | Payant | — | Indispensable pour Amana |

**Prix non revérifiés dans ce document** : les consulter sur les pages officielles avant toute décision.

### Recommandations par priorité
1. **Vercel en usage commercial** : choisir avant le lancement entre Vercel Pro et une alternative. C'est une décision avec un coût.
2. **Base en Europe** : recréer la base Neon dans la région de Francfort, à côté de l'API. C'est un gain de latence notable, mais il faut une migration des données. À faire **après** l'activation de la sauvegarde quotidienne.
3. **Surveiller la taille de la base** (0,5 Go). Les nouvelles images vont déjà sur Backblaze, il reste à y migrer les anciennes.
