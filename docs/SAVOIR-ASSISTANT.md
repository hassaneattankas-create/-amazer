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
- Clients : page « Où trouver de l'essence » et page « Pharmacies » : la carte est en haut de la page, tout de suite (« Près de moi » la centre sur le client). Pharmacies de garde de la semaine en vert (celles de l'affiche officielle comprises) ; stations colorées selon le carburant, cercle = de garde, et stations approvisionnées du communiqué. Une pastille entourée de pointillés = position approximative (centre du quartier) : appeler avant de se déplacer. Petits points gris : toutes les autres pharmacies du Niger (Niamey, Zinder, Maradi, Tahoua, Agadez, Dosso… pas de garde cette semaine, horaires habituels). Sur la carte des stations, seules les stations inscrites sur AMAZER apparaissent (elles seules donnent leurs disponibilités). Au-dessus de la carte, un champ « Chercher une pharmacie / une station, un quartier, une ville » : on tape un nom (ex. Gobi, Total), un quartier (ex. Koira Kano) ou une ville (ex. Zinder), on touche le résultat et la carte s'y centre et ouvre sa fiche (appel, itinéraire). Dans chaque fiche de la carte, « Vue satellite » ouvre Google Maps en satellite sur l'établissement (pour repérer le bâtiment).
- Pharmacies de garde : la page « Pharmacies » affiche la liste officielle de la semaine (affiche du ministère, du samedi 8 h au samedi 8 h) : recherche par nom ou quartier, filtre par commune, appel en un geste, itinéraire, semaine prochaine si publiée, partage WhatsApp. Une pharmacie inscrite qui figure sur la liste est de garde automatiquement ; sinon elle se met de garde en un geste (« Cette nuit », « Ce week-end », « Toute la semaine »).
- Stations : chaque gérant peut relever le soir les compteurs de ses pompes (section « Ventes (compteurs) ») ; AMAZER calcule les litres de super et de gasoil vendus par jour ; le propriétaire voit les totaux (section « Ventes de carburant »).
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
- 14 nov. : la caisse de l'admin ne compte plus les commandes annulées ni les faux paiements.
- 14 nov. : page « Pharmacies » refaite autour de la liste officielle de garde de la semaine ; l'admin la publie en envoyant la photo de l'affiche (Admin → Gardes).
- 14 nov. : ventes de carburant par compteurs des pompes pour les stations.
- 15 nov. : la comparaison de prix est retirée de la fiche produit (plus de liste d'offres « du moins cher au plus cher » ni de courbe d'évolution du prix).
- 15 nov. : la carte des pharmacies et des stations s'affiche en haut de la page ; les pharmacies de garde de l'affiche officielle y apparaissent (adresse retrouvée sur OpenStreetMap, sinon centre du quartier).
- 15 nov. : recherche sur la carte des pharmacies et des stations (nom ou quartier) ; toutes les pharmacies et stations de Niamey apparaissent (petits points gris pour celles pas de garde ou pas encore inscrites).
- 15 nov. : abonnement Boutique : produits vraiment illimités (la limite du catalogue ne vise plus que la formule gratuite) ; nombreuses petites corrections sur téléphone (bandeau d'installation, espaces pharmacie et stations, page Vendre).
- 15 nov. : « À la une » : AMAZER peut mettre un établissement (boutique, restaurant, hôtel, pharmacie, station…) en visibilité prioritaire pour 7, 30 ou 90 jours : il passe en tête des listes (après la garde ou la disponibilité pour pharmacies et stations), dans « Boutiques à la une » de l'accueil, avec un badge « À la une ». C'est AMAZER qui choisit (Admin › Vendeurs et tarifs).
- 15 nov. : annuaire des pharmacies : toutes les pharmacies connues restent sur la carte avec leur position et leur numéro, même quand elles ne sont pas de garde ; AMAZER corrige les positions approximatives (Admin › Gardes › Annuaire des pharmacies).
- 15 nov. : livraison : dans le panier et la commande de repas, le bouton « Utiliser ma position » enregistre la position GPS exacte (en plus de l'adresse et du repère) ; le livreur et le restaurant ont l'itinéraire exact.
- 15 nov. : stations : « Vous y êtes ? » (il y en a / plus rien / longue file, en un geste, sans compte) affiché « selon des clients » pendant 2 heures ; « Me prévenir quand il y en a » (une station, ou toutes les stations de la ville) : notification dès que la station indique le carburant ou qu'un communiqué d'approvisionnement est publié, au plus une toutes les 2 heures (compte nécessaire).
- 15 nov. : la carte des pharmacies montre toutes les pharmacies connues du Niger (pas seulement Niamey) ; on peut chercher une ville sur la carte. La carte des stations ne montre plus que les stations inscrites sur AMAZER (plus de points gris pour les stations inconnues).
