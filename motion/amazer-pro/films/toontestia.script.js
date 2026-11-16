window.TOON_SCRIPT = {
 "id": "toontestia",
 "titre": "Test outil Assistant",
 "scenes": [
  {
   "type": "maison_ombre",
   "voix": "À l'ombre, tranquille.",
   "vo": "s1"
  },
  {
   "type": "ecrans",
   "voix": "Cherchez, ajoutez au panier, commandez.",
   "ecrans": [
    {
     "img": "assets/screens/02-recherche-riz.png",
     "de": 0,
     "texte": "Cherchez",
     "taps": [
      {
       "x": 95,
       "y": 700,
       "at": 0.8
      }
     ]
    },
    {
     "img": "assets/screens/03-fiche-riz-long.png",
     "de": 1.2,
     "scroll": [
      0,
      70,
      1.3,
      1.6
     ],
     "taps": [
      {
       "x": 288,
       "y": 810,
       "at": 2
      }
     ]
    },
    {
     "img": "assets/screens/05-panier-rempli-long.png",
     "de": 2.4,
     "scroll": [
      0,
      784,
      2.5,
      3.1
     ],
     "taps": [
      {
       "x": 195,
       "y": 1424,
       "at": 3.4
      }
     ]
    }
   ],
   "vo": "s2"
  },
  {
   "type": "moto",
   "voix": "Le livreur arrive.",
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
   "vo": "s3"
  },
  {
   "type": "portail",
   "voix": "Livré !",
   "recu": "assets/screens/14-recu-qr-long.png",
   "recuVers": "QR code du reçu",
   "confirme": "assets/screens/17-commande-livree.png",
   "recuScroll": 467,
   "vo": "s4"
  },
  {
   "type": "fin",
   "voix": "AMAZER.",
   "vo": "s5"
  }
 ]
};
