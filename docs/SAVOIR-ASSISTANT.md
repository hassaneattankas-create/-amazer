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
- L'administration d'AMAZER est décrite fiche par fiche (outil connaissance_amazer) : accès et PIN, routine « À traiter », commandes et paiements, confirmer une livraison, reversements aux boutiques, remboursements, revendeurs, affiliés et ambassadeurs, vendeurs et tarifs, « À la une », prix négocié, abonnements (offrir un mois, activer 12 mois), tarifs et réglages, stations (paliers), moyens de paiement, utilisateurs et rôles, messages et bienvenue, catégories et sections de l'accueil, gardes des pharmacies et annuaire, communiqués des stations, modération ; plus le cycle d'une commande, le plan du site et la méthode pour démarcher une marque.

## Formules et prix
- Essai gratuit de 14 jours pour tout nouveau vendeur, tout inclus.
- Boutique sans abonnement (formule gratuite) : boutique toujours en ligne, 5 produits visibles au maximum (les autres sont mis de côté, jamais supprimés, le vendeur choisit lesquels montrer), AMAZER garde 5 % de chaque vente avant de reverser.
- Abonnement Boutique : 2 000 F par mois, produits illimités, 0 % de commission. À l'échéance sans renouvellement : retour en formule gratuite, la boutique ne disparaît pas.
- Restaurant : 5 000 F par mois. Premium : 10 000 F par mois. Sans paiement : plus visible des clients et plus de commandes ni réservations jusqu'au paiement ; menu, chambres, trajets et données gardés.
- Paiement de l'abonnement : dans « Profil et abonnement », choisir la durée et le moyen (Nita, Amana…), envoyer la référence ; AMAZER valide.
- Reversements : l'admin voit pour chaque boutique ce qui est à reverser (commandes livrées et payées, commission déduite) et clique « Reversé » ; la boutique est prévenue et voit « L'argent de mes ventes ».

## Espace vendeur : onglets, commandes et produits
- Où : Menu › « Ma Boutique » (espace vendeur ; « Activer vendeur » tant que l'abonnement d'un restaurant ou Premium n'est pas actif). Onglets : Accueil, Commandes, Produits, Ajouter, Réglages. En haut : « Voir ma boutique » et « Profil et abonnement ».
- Accueil : chiffres (À préparer, Ventes sur 30 jours, Produits en ligne, Stock faible), « Ma formule », « Mes chiffres », « L'argent de mes ventes », « Mes statistiques », « Avis de mes clients », « Partager ma boutique », « Guide du vendeur », « Formations gratuites ».
- Commandes : filtres À traiter, En cours, Terminées, Paiement en attente. États : Paiement en vérification (AMAZER vérifie, le vendeur est prévenu ensuite), À préparer, En préparation, En livraison, Livrée, Annulée. Boutons : « Préparer la commande », « Remise au livreur », « Marquer livrée ».
- Produits : recherche, filtres En ligne / Masqués / Stock faible ; « Modifier » (marque, prix normal, stock, description, photo), « Remettre en ligne », « Supprimer ».
- Promotion : dans « Modifier », mettre un prix promo plus bas et une durée : le produit apparaît dans « Promotions » avec le prix normal barré, puis revient seul à son prix normal ; « Arrêter la promo » pour la finir avant.
- Ajouter un produit : nom, marque (facultatif), catégorie, prix (XOF), stock, photo (prendre une photo ou galerie), description, puis « Ajouter au catalogue ». Case « Produit numérique (e-book, formation, code…) » : pas de frais de livraison, le vendeur l'envoie au client (WhatsApp ou e-mail) après le paiement.
- Outils Premium : « Importer des produits » (fichier CSV : nom, marque, prix, stock, description), « Import rapide par photos » (un produit brouillon, masqué, par photo : compléter ensuite le nom et le prix puis l'activer), « Exporter mes ventes ».
- Réglages : « Compléter mon profil » ; « Supprimer mon compte » (mot de passe actuel ; irréversible : boutique fermée et données anonymisées).

## Espace vendeur : statistiques, avis et argent des ventes
- Mes statistiques (7 derniers jours) : visites de la vitrine, contacts (appel, WhatsApp, message), commandes et réservations, et « sur 100 visiteurs, environ X commandent ou réservent ». Conseil : partager le lien de la vitrine (statut WhatsApp, Facebook) pour avoir des visites.
- Avis de mes clients : les clients notent après une commande livrée, un séjour ou un voyage ; « Répondre » puis « Publier la réponse ».
- L'argent de mes ventes (boutiques) : à recevoir, pas encore livré, commission AMAZER (5 % en formule gratuite, 0 % avec l'abonnement Boutique). Les clients paient AMAZER ; dès qu'une commande est livrée, AMAZER reverse la part de la boutique sur son numéro de reversement.
- Numéro de reversement : Profil et abonnement › « Argent de vos ventes » › « Numéro de reversement (Nita, Amana, Wave ou Airtel Money) ». Il n'est pas montré aux clients.

## Profil et abonnement (vendeur)
- Où : Espace vendeur › « Profil et abonnement ».
- Payer l'abonnement : prix par mois affiché ; choisir la durée et le moyen de paiement, payer, saisir la « Référence du paiement (reçue par SMS) », puis « J'ai payé, envoyer » : AMAZER vérifie et prévient. « Prolonger mon abonnement » pour payer d'avance. Après avoir changé de formule : enregistrer le profil avant de payer.
- Profil : logo, photo de couverture, contact client affiché sur la boutique (WhatsApp, téléphone, e-mail), horaires, ville, adresse / quartier, description ; boutiques : numéro de reversement.
- Type d'activité : Boutique (produits), Restaurant (menu), Premium (hôtel, transport, pharmacie, station, entreprise). Hôtel, transport, pharmacie ou station-essence : AMAZER active la fonction adaptée après vérification de l'établissement (écrire sur WhatsApp depuis la page d'aide).
- Restaurant et Premium : options du mini-site (boutique, restaurant, réservation de tables), « Numéro qui reçoit les paiements clients (Nita / Amana) » (affiché aux clients pour les réservations et acomptes), acompte de réservation (XOF) et moyen (Nita ou Amana), galerie photos, services (un par ligne : titre | description).
- Toujours finir par « Enregistrer le profil ».

## Espace restaurant : commandes, menu, réservations, horaires
- Chiffres : commandes aujourd'hui, ventes du jour, à accepter, plats épuisés. Un son prévient à chaque nouvelle commande.
- Commandes du restaurant : Nouvelles, En cuisine, En livraison, Terminées. « Accepter et préparer », « Refuser » (le client est prévenu et AMAZER le rembourse), « Prête : envoyer », « Marquer livrée », « Appeler », « Itinéraire exact » (quand le client a donné sa position). « Paiement en vérification » : attendre la confirmation d'AMAZER.
- Mon menu : « Ajouter un plat » : nom, prix, rubrique du menu, préparation (minutes), description, photo, « Plat du jour (mis en avant) », options et suppléments (ex. « Supplément viande » 500 F, « Sans piment » 0 F), puis « Publier au menu ». « Retirer du menu (temporaire) » / « Remettre au menu » ; Supprimer.
- Réservations de tables : À confirmer, Confirmée, Refusée ; « Confirmer », « Refuser », « Appeler ».
- Réglages : « Mettre en pause » (bloque les nouvelles commandes sans toucher au menu) / « Reprendre les commandes » ; horaires d'ouverture par jour (« Appliquer les horaires du lundi à toute la semaine » ; après minuit, ex. 18:00 → 02:00) ; « Fermer automatiquement en dehors de mes horaires ». Sans horaires, le restaurant est ouvert en permanence.

## Espace hôtel et transport : réservations, chambres, trajets
- Hôtel : chiffres (arrivées aujourd'hui, départs aujourd'hui, occupation cette nuit, à confirmer) ; onglets Arrivées, En séjour, À venir, Historique. Boutons : « Confirmer » (après avoir vérifié le paiement), « Refuser » (client prévenu), « Client arrivé », « Absent » (chambre libérée), « Annuler », « Client parti », « Appeler ».
- Chambres (dans Profil et abonnement) : nom, capacité, nombre de chambres de ce type, description, options (ex. Climatisée, TV, petit-déjeuner), photos, prix par nuit.
- Transport : « Départs et passagers » ; « Scanner un billet » (QR code du voyageur) ; « Confirmer », « Refuser », « Embarqué », « Absent », appeler le passager ; départs à venir ou passés.
- Trajets (dans Profil et abonnement) : nom (ex. Niamey - Maradi), nombre de places, options (ex. Climatisé, Wi-Fi, bagages), jours disponibles, heures de départ, prix par place.
- Paiement : le client paie directement l'établissement (Nita ou Amana) ; l'établissement vérifie la référence avant de confirmer. Le client retrouve sa réservation et son billet (QR code à montrer au chauffeur) dans « Mes réservations » du tableau de bord.

## Espace pharmacie : garde, position, livraison
- Mes disponibilités : « Je suis de garde maintenant » / « Terminer ma garde » ; garde rapide « Cette nuit », « Ce week-end », « Toute la semaine » ; « Programmer une garde » (dates de début et de fin : elle s'active et s'arrête toute seule).
- Liste officielle : si la pharmacie figure sur l'affiche de garde de la semaine, AMAZER l'affiche de garde automatiquement. De garde = en vert sur la carte et en premier dans la liste.
- Position : « Enregistrer ma position » depuis la pharmacie : le bouton « Itinéraire » mène les clients chez vous dans Google Maps.
- Livraison : dans les villes où AMAZER livre, les clients peuvent « Se faire livrer » depuis la pharmacie (numéro AMAZER).

## Stations : espace du propriétaire de la marque
- Où : l'espace vendeur du compte propriétaire de la marque. Sections : Vue d'ensemble, Responsables par ville, Stations par ville, Ventes de carburant, Activité, Retours clients, Livraisons, Abonnement et export, Vitrine, avis et parrainage.
- Vue d'ensemble : résumé du réseau (stations à jour, à renseigner, sans gérant, retours ouverts), trafic des 30 derniers jours (itinéraires, appels, commandes de gaz, livraisons) et alertes (ruptures depuis plus de 24 h, stations à renseigner).
- Responsables par ville : 1) désigner un ou plusieurs responsables par ville (e-mail de leur compte AMAZER, gratuit) ; 2) chaque responsable nomme les gérants de ses stations.
- Stations par ville : « Ajouter une station » (nom, ville, adresse ou repère, téléphone ; le supplément de prix éventuel est affiché) ; « Mise à jour groupée » (ex. gaz disponible ou en rupture dans toutes les stations d'une ville, ou « Rien n'a changé »). Chaque station : Disponibilités, Gérants, Informations et horaires, Garde, Position Google Maps, Nom et ville, Enregistrer une livraison, « Indiquer fermée » / « Rouvrir la station », Supprimer.
- Ventes de carburant : litres de super et de gasoil vendus (7 jours, par jour, par station), d'après les compteurs relevés par les gérants.
- Activité : tout ce que font responsables et gérants sur 90 jours (filtres ville, station, rôle). Retours clients et livraisons : 30 derniers jours.
- Abonnement et export : palier de la marque (Essentiel, Réseau, Entreprise selon le nombre de stations), prix mensuel ou prix négocié, historique et statistiques sur 12 mois.

## Stations : responsable de ville et gérant
- Accès : Menu › « Espace station » (amazer.store/gerant-station), avec le compte que le propriétaire ou le responsable a ajouté. Message « Aucune station ni ville ne vous est confiée » : demander à être ajouté avec l'e-mail de son compte.
- Responsable de ville (« Mes villes ») : résumé (à jour, à renseigner, en rupture, sans gérant, retours ouverts), stations de la ville (Disponibilités, Gérants, Infos et position, Ventes, Livraisons, Gestion : renommer, fermer, rouvrir, supprimer), « Ajouter la station » (le propriétaire est prévenu : elle compte dans son abonnement), activité des gérants, retours clients.
- Gérant (« Mes stations ») : Disponibilités (super, gasoil, gaz : Disponible, Stock faible ou Rupture ; « Rien n'a changé » pour confirmer), Informations et horaires (adresse, téléphone, horaires, services), Garde (jusqu'à nouvel ordre ou jusqu'à une date), Position Google Maps (« Je suis à la station : enregistrer la position », ou coller un lien Google Maps / des coordonnées), Ventes (compteurs), Livraisons (carburant, litres, n° de bon ou de camion, date), Retours clients (« Marquer traité » avec une note), Historique.
- Compteurs : ajouter d'abord les pompes (nom, carburant) ; chaque soir, recopier le chiffre du compteur de chaque pompe ; le premier relevé sert de point de départ ; AMAZER calcule les litres vendus. Cocher « Compteur remis à zéro ou changé » si c'est le cas.
- Mises à jour suspendues : la station est fermée ou l'abonnement de la marque a expiré ; prévenir le responsable.

## Compte client : tableau de bord, préférences, reçus
- Tableau de bord (Menu › Tableau de bord) : Mes commandes (suivi et reçu), Mes commandes restaurant (« Payer ou envoyer la référence », « Mon reçu »), Mes réservations (billet avec QR code), Préférences (pays et région, devise d'affichage, langue, son des notifications), Notifications (e-mail ; WhatsApp bientôt).
- Supprimer mon compte : tableau de bord › « Supprimer mon compte » avec le mot de passe ; les données personnelles sont effacées, l'historique des commandes est conservé.
- Notifications (page Notifications) : commandes, paiements, messages et livraisons, aussi envoyés par e-mail ; « Tout marquer comme lu », « Vider ».
- Reçu : chaque commande a un reçu sécurisé avec un QR code à montrer au livreur (valable une seule fois) ; « Télécharger le reçu (PDF) », « Enregistrer en image », « Partager le reçu ».
- Sécurité : AMAZER ne demande jamais le code secret Nita ou Amana, ni par SMS ni par appel.
- Installer l'application : bandeau « Installez l'application AMAZER » › « Installer » (Android) ; sur iPhone : Partager, puis « Sur l'écran d'accueil ». Gratuite, légère, sans passer par le Play Store.

## Messages, avis et aide
- Écrire à une boutique : sur sa page, « Écrire à la boutique » ; les échanges sont dans « Messages ». « Signaler » une conversation (avec le motif) : l'équipe AMAZER est prévenue.
- Avis sur un produit : seuls les clients qui l'ont reçu peuvent le noter (note, commentaire, lien de photo). Avis sur un établissement : après une commande livrée, un séjour ou un voyage ; l'établissement peut répondre.
- Avis sur AMAZER : page « Avis » (note et expérience) ; un problème avec une commande : bouton « Écrivez-nous » (WhatsApp).
- Aide : la bulle « Assistant AMAZER » en bas de l'écran répond aux questions ; « Besoin d'une personne ? » ouvre WhatsApp AMAZER. Page « Comment ça marche ? ».

## Admin · Accès et sécurité
- Ouvrir l'espace admin : se connecter avec le compte administrateur, puis Menu › « Espace Admin » (adresse : amazer.store/admin). Ce lien n'apparaît que pour un compte administrateur.
- Code PIN : à la première ouverture sur un appareil, saisir le PIN admin et la date secondaire (JJ/MM/AA), puis « Ouvrir l'espace admin ». Une seule saisie suffit : l'espace reste ouvert sur cet appareil.
- Message « Revalider le PIN » ou « Votre code PIN est peut-être à ressaisir » : ressaisir le PIN. Message « Me reconnecter » : la session a expiré, se reconnecter.
- Ne jamais donner le PIN ni la date secondaire à personne (ni par WhatsApp ni à l'Assistant). Pour les changer : réglages du serveur sur Render (variables ADMIN_FINANCE_PIN et ADMIN_BIRTH_DATE), puis redémarrage du serveur.
- Menu admin en 3 groupes : « Au quotidien » (À traiter, Commandes et paiements, Confirmer une livraison, Modération) ; « Argent à verser » (Affiliés, Boutiques, Revendeurs, Remboursements) ; « Gestion » (Vendeurs et tarifs, Moyens de paiement, Utilisateurs, Messages, Catégories, Sections de l'accueil, Gardes et approvisionnements).
- Traçabilité : chaque action sensible (paiement validé, tarif changé, compte supprimé, connexion admin…) est notée dans Vendeurs et tarifs › « Historique des modifications » (export CSV possible).

## Admin · Routine quotidienne (À traiter)
- Page « À traiter » (première page de l'admin) : une tuile par chose en attente avec son nombre ; toucher une tuile ouvre la bonne page. « Rien en attente pour le moment » = tout est fait.
- Tuiles : paiements de commandes à valider, commandes payées à livrer, inscriptions vendeurs à valider, abonnements vendeurs à valider, retraits d'affiliés demandés, abonnements revendeurs à valider, gains de revendeurs à verser, remboursements à faire, signalements des 7 derniers jours.
- Chaque jour : 1) valider les paiements de commandes ; 2) suivre les livraisons ; 3) valider les abonnements payés ; 4) verser l'argent dû (boutiques, revendeurs, affiliés, remboursements) ; 5) regarder la modération.
- Chaque samedi : publier l'affiche des pharmacies de garde de la semaine (Gardes et approvisionnements).

## Admin · Commandes et paiements
- Où : Admin › « Commandes et paiements ». Tout ce qui concerne l'argent qui entre : paiements des commandes, livraisons, abonnements des vendeurs, trésorerie.
- Valider le paiement d'une commande : filtre « Paiements à valider », comparer la référence envoyée par le client avec votre relevé Nita ou Amana, puis « Valider le paiement ». Le vendeur et les livreurs sont prévenus aussitôt.
- Amana : le paiement se valide tout seul dès que le client confirme dans AmanaTa ; le bouton « Vérifier maintenant » relance la vérification.
- « Le client n'a pas encore envoyé de référence » : attendre, ou le contacter. Ne jamais valider sans voir l'argent sur le compte AMAZER.
- Commandes à livrer : filtre « À livrer », puis « Envoyer en livraison » et « Marquer livrée » si besoin (normalement le livreur s'en charge en scannant le reçu).
- Annuler une commande : « Annuler ». Si elle était payée, enregistrer ensuite le remboursement dans « Remboursements ».
- Abonnements des vendeurs : section « Validations paiements vendeurs » : vérifier le paiement sur le compte AMAZER, puis « Valider » (l'abonnement démarre) ou « Refuser (note obligatoire) ».
- Chiffres : flux Nita, flux Amana, autres moyens, total encaissé, commission AMAZER, frais de service, part vendeurs et livraisons, vendeurs actifs, revenus des 30 derniers jours, historique des transactions (codes stockés chiffrés).
- Zone sensible : « Remettre les compteurs à zéro » efface les compteurs financiers et les clics publicitaires, sans supprimer l'historique des commandes. À ne faire que volontairement (ex. après des tests).

## Cycle d'une commande boutique
- Commander : le client remplit le panier, l'adresse avec un repère et son téléphone (« Utiliser ma position » enregistre la position GPS exacte pour le livreur), puis « Commander ».
- Payer : le client choisit le moyen (Nita, Amana…), paie au numéro indiqué, puis envoie la référence de la transaction.
- Vérification : AMAZER vérifie le paiement (Amana automatiquement, sinon l'admin dans Commandes et paiements). Ensuite seulement la boutique prépare.
- Étapes vues par le client : Commande → Préparation → En livraison → Reçue. Le client peut « Annuler la commande » tant que le paiement n'est pas confirmé.
- Livraison : le livreur « Prend en charge », va à la boutique (itinéraire boutique), puis chez le client (itinéraire client ; adresse exacte visible après la prise en charge). Si la commande est déjà payée : il n'encaisse rien.
- Remise : le livreur scanne le QR code du reçu du client (« Scanner le reçu du client ») ; sinon « Marquer livrée sans scan ». S'il ne peut pas livrer : « Je ne peux pas la livrer ».
- Réception : le client appuie sur « J'ai reçu ma commande ». Sans réponse, la commande passe « Reçue » automatiquement après le délai réglé dans Vendeurs et tarifs (« Livraisons : réception confirmée automatiquement après »).
- Argent : commande livrée et payée → la part de la boutique apparaît dans Admin › Boutiques (reversements), commission de la formule gratuite déduite.

## Admin · Confirmer une livraison
- Où : Admin › « Confirmer une livraison » (même écran que les vendeurs et les livreurs).
- Comment : « Scanner le QR code » du reçu du client au moment de la remise, ou coller le lien du reçu, puis « Confirmer la livraison ». Résultat : « Livraison confirmée » ou « Vérification refusée ».

## Admin · Reversements aux boutiques
- Où : Admin › Argent à verser › « Boutiques ».
- Principe : les clients des boutiques paient sur le compte AMAZER ; quand une commande est livrée et payée, sa part revient à la boutique, moins 5 % si la boutique est en formule gratuite (0 % avec l'abonnement Boutique).
- États d'une vente : à reverser, pas encore livrée, reversée, litige ou remboursement.
- Reverser : envoyer l'argent au numéro de reversement de la boutique (Nita, Amana, Wave, Airtel Money), puis « Reversé » et saisir la référence (facultatif). La boutique est prévenue et le voit dans « L'argent de mes ventes ».
- Numéro de reversement « non renseigné » : le demander à la boutique (bouton WhatsApp sur la ligne).

## Admin · Remboursements
- Où : Admin › « Remboursements ». Liste les commandes (boutique ou restaurant) payées puis annulées ou refusées, avec le total à rembourser.
- Rembourser : envoyer l'argent au client par Nita ou Amana, saisir la « Référence du virement », puis « Remboursé » : le client est prévenu.
- Pas de remboursement nécessaire (client remboursé autrement, doublon…) : « Pas nécessaire » avec le motif ; la ligne est classée.

## Admin · Revendeurs
- Où : Admin › « Revendeurs ». Revendeur = vend des produits AMAZER sans stock, à son prix, et garde la marge.
- Abonnements à valider : vérifier la référence sur le compte Nita / Amana, puis « Valider » ou « Refuser ». Le prix de l'abonnement revendeur se règle dans Vendeurs et tarifs (500 F par défaut).
- Gains à verser : verser la marge par Nita / Amana, puis « Enregistrer un versement » (montant, référence) : le reste à verser baisse et le revendeur est prévenu. AMAZER garde une commission sur chaque marge (10 % par défaut, réglable).
- Tous les revendeurs : recherche par nom, e-mail ou téléphone ; état (gratuit, expiré, jamais activé, a déjà payé) ; « Voir sa boutique » ; WhatsApp.

## Admin · Affiliés et ambassadeurs
- Où : Admin › « Affiliés ». Onglets : Paiements à faire, Affiliés, Candidatures (ambassadeurs).
- Affilié : touche une part des abonnements des vendeurs qu'il amène (20 % pendant 12 mois par défaut) et un bonus fixe à la 1re commande livrée d'un client amené (réglable, 0 = désactivé).
- Gains : « En délai » (délai de sécurité pour repérer annulations et fraudes), « À vérifier », « Disponible », « Demandé », « Payé ». L'affilié demande son paiement depuis sa page dès qu'il atteint le minimum.
- Payer : envoyer l'argent, saisir la référence, « Marquer comme payé ». Refuser : « Refuser (gains rendus) » avec motif, ou « Refuser et annuler (fraude) ».
- Fraude (faux comptes, auto-parrainage) : sur la fiche de l'affilié, « Fraude : tout annuler » suspend l'affilié et annule tous ses gains non payés.
- Ambassadeurs : « Nommer ambassadeur » / « Retirer ambassadeur ». Prime sur le 1er mois d'abonnement des boutiques recrutées, paliers Argent et Or selon le nombre de boutiques payantes, prime du n°1 du mois (« Verser une prime »). Conseil : nommer d'abord les meilleurs affiliés.
- Réglages (délai de sécurité, minimum de paiement, plafonds anti-fraude, parts et primes) : Vendeurs et tarifs › « Tarifs, frais et réglages ».

## Admin · Vendeurs et tarifs (fiche vendeur)
- Où : Admin › « Vendeurs et tarifs » › section « Vendeurs ». Rechercher par boutique, ville, téléphone ou e-mail ; filtrer (dont « À la une »).
- Sur chaque vendeur : activité (Boutique, Restaurant, Premium · Entreprise / Hôtel, Premium · Transport, Premium · Pharmacie, Premium · Station-essence), badge « Vérifié » (donner ou retirer), état de l'abonnement (date d'expiration, hors ligne).
- « Offrir 1 mois » : mois gratuit. « Activer 12 mois » : abonnement d'un an payé à part (espèces, virement), sans paiement en ligne.
- « À la une » (visibilité prioritaire) : 7, 30 ou 90 jours ; le vendeur passe en tête des listes, dans « À la une » de l'accueil, avec un badge. Une nouvelle durée repart d'aujourd'hui ; « Retirer » l'enlève. C'est AMAZER qui choisit (offre partenaire, service payant…).
- Tarif personnalisé (prix négocié) : « Prix négocié par mois (XOF) » remplace le tarif calculé (ex. stations : abonnement + stations) ; on peut aussi fixer une commission (%) et des frais propres au vendeur. « Enregistrer tarif boutique » ; « Revenir au tarif global » annule.
- Retirer, restaurer ou supprimer un compte : bouton « Gérer le compte » (page Utilisateurs).
- Historique des modifications : tout changement de tarif, d'abonnement, de badge ou de compte, avec export CSV.

## Admin · À la une (visibilité prioritaire d'un vendeur)
- Où : Admin › Vendeurs et tarifs › Vendeurs › trouver le vendeur › « Visibilité prioritaire (« À la une ») ».
- Mettre à la une : choisir 7 jours, 30 jours ou 90 jours. Le vendeur (boutique, restaurant, hôtel, pharmacie, station…) passe en tête des listes (après la garde ou la disponibilité pour pharmacies et stations), dans « À la une » de l'accueil, avec un badge « À la une ».
- Prolonger : une nouvelle durée repart d'aujourd'hui. Enlever : « Retirer ». Voir qui est à la une : filtre « À la une » de la liste des vendeurs.
- Usage : c'est AMAZER qui décide ; à offrir dans un pack partenaire ou à vendre comme service (prix libre, encaissé à part).

## Admin · Prix négocié d'un vendeur (tarif personnalisé)
- Où : Admin › Vendeurs et tarifs › Vendeurs › trouver le vendeur › tarif personnalisé.
- Prix négocié par mois (XOF) : remplace le prix normal de son abonnement (ex. une marque de stations : remplace « abonnement + prix par station »). Vide = tarif normal.
- On peut aussi fixer une commission (%) et des frais (XOF) propres à ce vendeur, par exemple « abonnement réduit + 3 % des ventes ».
- « Enregistrer tarif boutique » pour appliquer ; « Revenir au tarif global » pour annuler. Le changement est noté dans l'Historique des modifications.

## Admin · Abonnement d'un vendeur : offrir un mois, activer 12 mois, valider un paiement
- Offrir un mois gratuit : Vendeurs et tarifs › le vendeur › « Offrir 1 mois » (geste commercial, retard de paiement…).
- Activer 12 mois : « Activer 12 mois » quand le vendeur a payé l'année à part (espèces, virement), sans passer par le paiement en ligne.
- Paiement envoyé par le vendeur depuis « Profil et abonnement » (durée, moyen, référence) : à valider dans Commandes et paiements › « Validations paiements vendeurs » (« Valider » ou « Refuser » avec une note).
- Vendeur hors ligne (abonnement restaurant ou Premium expiré) : il redevient visible dès que le paiement est validé ou qu'un mois est offert. Une boutique sans abonnement reste en ligne en formule gratuite (5 produits, 5 %).

## Admin · Tarifs, frais et réglages généraux
- Où : Vendeurs et tarifs › « Tarifs, frais et réglages ». Penser à « Enregistrer ».
- Prix : abonnement Boutique, Restaurant, Premium (prix mensuels globaux) ; essai gratuit à l'inscription (jours) ; réduction de lancement ; abonnement revendeur ; plafond d'articles de la formule sans abonnement.
- Commission AMAZER et frais plateforme : réglables ; bouton « Activer / Désactiver 0 % Commission » (mode lancement).
- Livraison : prix par défaut, urbaine, périphérique, et frais par quartier (une ligne « Quartier:Montant », puis « Enregistrer quartiers »).
- Réception automatique : délai après lequel une commande « En livraison » passe « Reçue » si le client ne confirme pas (prévoir assez pour les livraisons hors de Niamey).
- Contacts : numéro général AMAZER (utilisé pour tout moyen de paiement sans numéro propre), e-mail, téléphone et WhatsApp du support.
- Pharmacies et stations : numéro AMAZER pour « Se faire livrer » depuis les pharmacies, numéro pour « Commander du gaz » depuis les stations (vide = bouton masqué), villes où AMAZER livre (ex. Niamey, Maradi, Zinder).
- Affiliés et revendeurs : part des abonnements, durée, bonus client, délai de sécurité, minimum de paiement, plafonds anti-fraude, primes ambassadeurs, commission sur la marge des revendeurs.

## Admin · Stations-essence : abonnement et paliers
- Où : Vendeurs et tarifs › carte « Stations-essence : abonnement et paliers ».
- Calcul : abonnement de base d'une marque (si vide : le prix Premium) avec quelques stations comprises (3 par défaut), puis un prix par station supplémentaire, dégressif : palier 1 jusqu'à la 10e station (2 000 F), palier 2 jusqu'à la 30e (1 500 F), palier 3 au-delà (1 000 F). Toutes ces valeurs sont réglables.
- Exemple avec une base de 10 000 F : 3 stations = 10 000 F, 5 = 14 000 F, 10 = 24 000 F, 20 = 39 000 F par mois. Un aperçu du prix s'affiche sur la carte.
- Prix négocié pour une marque : fiche vendeur › « Prix négocié par mois », qui remplace tout ce calcul.

## Admin · Moyens de paiement
- Où : Admin › « Moyens de paiement ». « Ajouter un moyen » : nom affiché aux clients (ex. Wave, Airtel Money), numéro qui reçoit l'argent, au nom de, ordre d'affichage, instructions « Comment payer » (ex. Composez *555#…).
- « Proposé aux clients » : le moyen apparaît aussitôt au paiement. « Validation automatique » (Amana) ou « Vérifié par AMAZER » (référence contrôlée par l'admin).
- Supprimer un moyen : les anciennes commandes restent lisibles.

## Admin · Utilisateurs (comptes et rôles)
- Où : Admin › « Utilisateurs ». Tous les comptes : clients, vendeurs, livreurs, admins ; chiffres (comptes, actifs, nouveaux sur 7 jours, vendeurs actifs) ; recherche par nom, e-mail ou téléphone.
- Retirer : le compte est désactivé, la personne ne peut plus se connecter (« Afficher les comptes retirés » pour les revoir). Restaurer : le compte revient ; un vendeur dont l'abonnement a expiré reste hors ligne jusqu'au paiement (ou « Offrir 1 mois »).
- Supprimer définitivement : irréversible.
- Rôles : « Nommer livreur » / « Retirer livreur » (un livreur se présente via le bouton « Devenir livreur » de la page Livreur, sur WhatsApp) ; « Nommer admin » donne tous les droits (argent, comptes, tarifs) : à réserver aux personnes de totale confiance. Le compte administrateur principal est protégé.
- « Fiche vendeur » : ouvre ce vendeur dans Vendeurs et tarifs (activité, abonnement, tarif).

## Admin · Messages et message de bienvenue
- Où : Admin › « Messages ». « Envoyer un message » à : tout le monde, clients, vendeurs, livreurs, ou une personne (e-mail ou numéro WhatsApp). Titre, message, lien sur le site (facultatif, ex. /promotions).
- Envoi : notification sur le site et e-mail à chaque destinataire. Formule e-mail gratuite (Brevo) : environ 300 e-mails par jour ; au-delà, le message reste visible sur le site.
- Message de bienvenue : envoyé à chaque nouveau compte (notification, et copie par e-mail et WhatsApp quand ces envois sont activés) ; on y règle le titre, le texte (avec le prénom de la personne), le lien du groupe WhatsApp et le lien de la chaîne WhatsApp AMAZER, avec un aperçu.

## Admin · Catégories et sections de l'accueil
- Catégories : Admin › « Catégories ». « Nouvelle catégorie » : nom, identifiant (slug, ex. technologie), catégorie parent éventuelle, active ou non, puis « Créer ». Les catégories existantes se modifient sur la même page.
- Sections de l'accueil : Admin › « Sections de l'accueil ». Rangées comme « Meilleures ventes » ou « Tendances », affichées sur l'accueil sous « Bonnes affaires ». Créer : titre, identifiant, type (Produits, Restaurants, Mixte).
- Contenu d'une section : « Modifier le contenu », une ligne par élément (product: suivi de l'identifiant du produit, ou restaurant: suivi de l'identifiant du vendeur), puis « Enregistrer le contenu ».

## Admin · Gardes des pharmacies et annuaire
- Où : Admin › « Gardes et approvisionnements ». Chaque semaine : photo de l'affiche des pharmacies de garde → vérifier → publier.
- 1. « Choisir la photo » : celle reçue sur WhatsApp suffit ; AMAZER lit les pharmacies, communes, numéros et dates (jusqu'à une minute).
- 2. Vérifier : ville, dates (du samedi 8 h au samedi 8 h en général), une ligne par pharmacie (Commune | Nom | | Repère | Numéro), source affichée aux clients (ex. MS/HP).
- 3. « Publier les … pharmacies de garde » : la liste est en ligne pendant sa période ; les pharmacies inscrites qui y figurent passent de garde automatiquement. « Listes publiées » : en ligne, à venir, terminée ; « Retirer » une liste.
- Annuaire des pharmacies : toutes les pharmacies connues, avec position et numéro, gardées même hors garde (Niamey, et tout le Niger d'après OpenStreetMap). Position : exacte (OpenStreetMap), approximative (centre du quartier), corrigée par AMAZER, ou sans position.
- Corriger une position : dans Google Maps, appui long sur la pharmacie, copier les coordonnées ou le lien de partage, le coller sur la ligne de la pharmacie (on peut aussi changer le numéro). Une position corrigée n'est plus jamais remplacée automatiquement.

## Admin · Communiqué des stations approvisionnées
- Où : Gardes et approvisionnements › « Stations approvisionnées ». Pour publier le communiqué d'une marque (ex. Oriba) valable un jour.
- Remplir : titre, source (communiqué du …), marque, carburant (Super ou Gasoil), téléphone et adresse de la marque, début et fin (heure de Niamey), stations (une par ligne : nom | précision), puis « Publier la liste ».
- Effet : les stations apparaissent sur la carte et dans la liste « Où trouver de l'essence », et les clients abonnés à « Me prévenir » dans cette ville reçoivent une alerte.

## Admin · Modération
- Où : Admin › « Modération ». Signalements de conversations (faits par les clients ou les vendeurs), avis sur les établissements, avis sur AMAZER (page « Avis »).
- Un compte qui abuse : le retirer dans Utilisateurs.

## Plan du site AMAZER
- Accueil (amazer.store) : recherche, bonnes affaires, sections, boutiques et restaurants à la une. Boutiques : /boutiques ; Restaurants : /restaurant ; Hôtels et Premium : /hotels ; Promotions : /promotions ; Catégories : /category.
- Pharmacies : /pharmacies (garde de la semaine, carte, annuaire). Stations : /stations (où trouver de l'essence, carte, alertes).
- Achat : panier /cart, paiement /order/pay, reçu /order/receipt (avec QR code), suivi dans « Mes commandes » (tableau de bord /dashboard).
- Compte : /login, /register, mot de passe oublié /forgot-password, profil /profile, messages /messages, notifications /notifications.
- Vendre : /vendre (présentation et inscription), espace vendeur /seller/dashboard, confirmation de livraison /seller/delivery-scan.
- Gagner avec AMAZER : revendre sans stock /revendre (boutique du revendeur /revendeur/…), affiliation /affiliation, formations gratuites /formations, livreurs /livreur, gérants de station /gerant-station.
- Aide : comment ça marche /comment-ca-marche, avis /avis, conditions /legal/terms, confidentialité /legal/privacy, suppression de compte /legal/account-deletion. Admin : /admin.

## Démarcher une marque ou un commerçant
- Préparer : savoir qui décide, son activité, ses points de vente, comment il vend aujourd'hui ; avoir amazer.store ouvert sur le téléphone (accueil, une boutique, page Stations ou Pharmacies selon le cas).
- Phrase d'ouverture : AMAZER vous fait connaître et vendre partout au Niger dès cette semaine, sans construire de site, sans gérer l'encaissement ni la livraison ; 14 jours d'essai gratuits, sans engagement.
- Ce qu'ils gagnent : vitrine en ligne et dans l'application ; commandes, paiement mobile money vérifié par AMAZER, livraison à Niamey ; revendeurs et affiliés qui vendent et font leur promotion ; « À la une » au lancement ; pour les stations : carte en temps réel, gérants, compteurs, alertes clients.
- Tarifs de base : Boutique 2 000 F/mois (ou formule gratuite : 5 produits, 5 % par vente), Restaurant 5 000 F/mois, Premium 10 000 F/mois, stations : base + prix par station dégressif.
- Offre partenaire pour une grande marque : prix négocié (fiche vendeur › Prix négocié par mois) incluant « À la une » et la mise en ligne du catalogue ; paiement d'avance sur 6 ou 12 mois (ex. 12 mois au prix de 10) ; ou abonnement réduit + petit pourcentage sur les ventes (commission propre au vendeur).
- Conclure : créer leur compte vendeur avec eux pendant le rendez-vous (/vendre), logo et premiers produits ; dans les 48 h, tout le catalogue + « À la une » + annonce sur la chaîne WhatsApp ; vers le 10e jour, rappeler avec leurs vrais résultats et encaisser (ils paient dans « Profil et abonnement », l'admin valide) ; accord écrit d'une page (prix, durée, services, paiement).
- Règle : ne donner que des chiffres vrais (ceux de l'admin) ; ne jamais promettre de ventes.

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
- 15 nov. : la carte des pharmacies montre toutes les pharmacies connues du Niger (pas seulement Niamey) ; on peut chercher une ville sur la carte. La carte des stations ne montre plus que les stations inscrites sur AMAZER (plus de points gris pour les stations inconnues) ; s'il n'y en a encore aucune dans la ville, la carte le dit et propose « Inscrire ma station ». Choisir une ville centre la carte sur cette ville.
