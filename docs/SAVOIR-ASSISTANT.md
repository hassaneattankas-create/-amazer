# Savoir de l'Assistant AMAZER

Source unique de ce que l'Assistant (et ses agents) doit savoir en plus des guides.
**À mettre à jour à chaque changement visible du site**, puis lancer
`node tools/e2e/explainer/savoir.mjs` : la base de l'Assistant est régénérée et relue
automatiquement (pas de redémarrage).

Format : `## Titre` = une fiche ; les lignes `- …` = son contenu. La section
« Faits » devient la liste des faits vérifiés donnée à tous les agents.

## Faits
- AMAZER (amazer.store, application Android) est une plateforme de commerce en ligne au Niger, qui vise l'Afrique puis l'international.
- Acteurs : clients, boutiques, restaurants, formule Premium (hôtels, transport, entreprises), pharmacies de garde, stations-essence (propriétaire, responsables de ville, gérants), revendeurs sans stock, affiliés, livreurs.
- Paiement par mobile money (Nita et Amana ; Wave et Airtel Money s'ajoutent quand l'admin les active) ; AMAZER vérifie chaque paiement avant que la boutique prépare la commande.
- Livraison par les livreurs AMAZER (standard et express à Niamey) ; le client confirme la réception, le livreur scanne son reçu.
- Les clients des boutiques paient sur le compte AMAZER ; AMAZER reverse ensuite à la boutique sa part de chaque commande livrée.
- Boutique : 14 jours d'essai avec tout ; ensuite formule gratuite (la boutique reste en ligne, 5 produits visibles, AMAZER garde 5 % de chaque vente) ou abonnement Boutique 2 000 F/mois (produits illimités, 0 % de commission).
- Restaurant (5 000 F/mois) et Premium (10 000 F/mois : hôtels, transport, entreprises, pharmacies, stations) : 14 jours d'essai puis abonnement obligatoire ; sans paiement, l'établissement n'est plus visible des clients jusqu'au paiement (données gardées).
- Chaque vendeur voit sa formule dans son espace (section « Ma formule ») : essai, date de fin, prix, et ce qui l'attend ensuite.
- Clients : page « Où trouver de l'essence » et page « Pharmacies » avec bouton « Voir la carte » (autour de soi ; stations colorées selon le carburant, cercle = de garde ; pharmacies de garde en vert).
- Affiliés : part des abonnements des vendeurs amenés et bonus sur la 1re commande livrée des clients amenés. Revendeurs : ils fixent leur prix et gardent la marge.
- Chaque nouveau compte reçoit un message de bienvenue (réglé par l'admin) avec les liens du groupe et de la chaîne WhatsApp d'AMAZER.
- Contact public : amazer.niger2@gmail.com.

## Formules et prix
- Essai gratuit de 14 jours pour tout nouveau vendeur, tout inclus.
- Boutique sans abonnement (formule gratuite) : boutique toujours en ligne, 5 produits visibles au maximum (les autres sont mis de côté, jamais supprimés, le vendeur choisit lesquels montrer), AMAZER garde 5 % de chaque vente avant de reverser.
- Abonnement Boutique : 2 000 F par mois, produits illimités, 0 % de commission. À l'échéance sans renouvellement : retour en formule gratuite, la boutique ne disparaît pas.
- Restaurant : 5 000 F par mois. Premium : 10 000 F par mois. Sans paiement : plus visible des clients et plus de commandes ni réservations jusqu'au paiement ; menu, chambres, trajets et données gardés.
- Paiement de l'abonnement : dans « Profil et abonnement », choisir la durée et le moyen (Nita, Amana…), envoyer la référence ; AMAZER valide.
- Reversements : l'admin voit pour chaque boutique ce qui est à reverser (commandes livrées et payées, commission déduite) et clique « Reversé » ; la boutique est prévenue et voit « L'argent de mes ventes ».

## Nouveautés de novembre 2026
- 13 nov. : nouvelle formule gratuite pour les boutiques (5 produits visibles, 5 % par vente) ; les boutiques ne disparaissent plus à la fin de l'essai.
- 13 nov. : écran admin « Boutiques » (argent à reverser) et section « L'argent de mes ventes » pour les vendeurs.
- 13 nov. : carte « Voir la carte » pour les stations-essence et les pharmacies, autour du client.
- 13 nov. : les stations peuvent se mettre « de garde » (jusqu'à nouvel ordre ou jusqu'à une date) ; filtre « De garde » pour les clients.
- 13 nov. : l'espace de tous les vendeurs est rangé en sections déroulantes (Accueil, Commandes, Produits ou Mon menu ou Mes chambres, Ajouter, Réglages).
- 13 nov. : chaque vendeur voit un message clair sur sa formule (section « Ma formule » et page « Profil et abonnement »).
- 13 nov. : le bouton du haut s'appelle « Menu » aussi sur téléphone ; Pharmacies et Stations-essence sont dans la section « Premium » du menu, Affiliation et Revendre dans « Gagner avec AMAZER ».
- 13 nov. : AMAZER est hébergé sur un nouveau compte Vercel ; le site se met à jour automatiquement à chaque modification.
- 14 nov. : à chaque inscription, message de bienvenue réglable par l'admin (Admin → Messages → « Message de bienvenue ») avec les liens du groupe et de la chaîne WhatsApp d'AMAZER ; il ouvre la page « Bienvenue ».
