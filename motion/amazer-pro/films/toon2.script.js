window.TOON_SCRIPT = {
 "id": "toon2",
 "nom": "pub-personnages-1_commandez-on-vous-livre_v2",
 "titre": "Commandez, on vous livre",
 "voix": "fr-FR-DeniseNeural",
 "vitesse": "+6%",
 "tenue": 1.8,
 "scenes": [
  {
   "type": "rue_chaleur",
   "voix": "Vingt-cinq kilos de riz… sous ce soleil ?",
   "vo": "s1"
  },
  {
   "type": "maison_ombre",
   "voix": "Restez plutôt à l'ombre !",
   "transition": "balayage",
   "vo": "s2"
  },
  {
   "type": "ecrans",
   "voix": "Sur AMAZER, cherchez votre produit, et ajoutez-le au panier.",
   "ecrans": [
    {
     "img": "assets/screens/01-accueil.png",
     "de": 0,
     "texte": "Cherchez sur *AMAZER*",
     "taps": [
      {
       "x": 195,
       "y": 203,
       "at": 0.85
      }
     ]
    },
    {
     "img": "assets/screens/02-recherche-riz.png",
     "de": 1.25,
     "taps": [
      {
       "x": 95,
       "y": 700,
       "at": 2.05
      }
     ]
    },
    {
     "img": "assets/screens/03-fiche-riz-long.png",
     "de": 2.45,
     "texte": "Ajoutez au *panier*",
     "taps": [
      {
       "x": 288,
       "y": 810,
       "at": 3.4
      }
     ],
     "scroll": [
      0,
      70,
      2.75,
      3.1
     ]
    }
   ],
   "fin": 1.3,
   "vo": "s3"
  },
  {
   "type": "ecrans",
   "voix": "Commandez, et payez par Nita ou Amana : AMAZER vérifie votre paiement.",
   "ecrans": [
    {
     "img": "assets/screens/05-panier-rempli-long.png",
     "de": 0,
     "texte": "Commandez",
     "scroll": [
      0,
      784,
      0.2,
      1.05
     ],
     "taps": [
      {
       "x": 195,
       "y": 1424,
       "at": 1.45
      }
     ]
    },
    {
     "img": "assets/screens/06-paiement-long.png",
     "de": 1.85,
     "texte": "Payez par *Nita ou Amana*",
     "scroll": [
      300,
      300,
      0,
      0.1
     ],
     "taps": [
      {
       "x": 215,
       "y": 562,
       "at": 3.05
      }
     ]
    },
    {
     "img": "assets/screens/08-paiement-confirme.png",
     "de": 3.45,
     "texte": "Paiement *vérifié*",
     "taps": []
    }
   ],
   "succes": 3.6,
   "fin": 1.5,
   "vo": "s4"
  },
  {
   "type": "boutique",
   "voix": "La boutique est prévenue, et prépare votre commande…",
   "ecran": "assets/screens/11-boutique-commandes.png",
   "tap": {
    "x": 195,
    "y": 525
   },
   "vo": "s5"
  },
  {
   "type": "moto",
   "voix": "puis un livreur AMAZER vous l'apporte, partout à Niamey.",
   "ecran": "assets/screens/13-livreur-long.png",
   "tap": {
    "x": 189,
    "y": 808
   },
   "scroll": [
    0,
    90,
    0.15,
    0.55
   ],
   "vo": "s6"
  },
  {
   "type": "portail",
   "voix": "Vous montrez votre reçu : c'est livré !",
   "recu": "assets/screens/14-recu-qr-long.png",
   "confirme": "assets/screens/17-commande-livree.png",
   "recuScroll": 467,
   "vo": "s7"
  },
  {
   "type": "fin",
   "voix": "AMAZER. Commandez, on vous livre. amazer point store.",
   "sous_titres_voix": [
    "AMAZER.",
    "Commandez, on vous livre.",
    "amazer.store"
   ],
   "vo": "s8"
  }
 ]
};
