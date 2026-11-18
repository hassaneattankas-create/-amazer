window.TOON_SCRIPT = {
 "id": "toon3",
 "nom": "pub-personnages-2_vendez-sur-amazer",
 "titre": "Vendez sur AMAZER",
 "voix": "fr-FR-HenriNeural",
 "vitesse": "+6%",
 "tenue": 1.8,
 "scenes": [
  {
   "type": "boutique_calme",
   "voix": "Une belle boutique… mais les clients se font rares ?",
   "vo": "s1"
  },
  {
   "type": "ecrans",
   "voix": "Sur AMAZER, ouvrez votre boutique en ligne. C'est gratuit pour commencer.",
   "transition": "balayage",
   "ecrans": [
    {
     "img": "assets/screens/18-vendre-long.png",
     "de": 0,
     "texte": "Ouvrez votre *boutique*",
     "scroll": [
      0,
      560,
      0.35,
      1.25
     ],
     "taps": [
      {
       "x": 195,
       "y": 849,
       "at": 1.75
      }
     ]
    }
   ],
   "fin": 1.9,
   "vo": "s2"
  },
  {
   "type": "ecrans",
   "voix": "Ajoutez vos produits avec une photo : votre vitrine est en ligne.",
   "ecrans": [
    {
     "img": "assets/screens/19-boutique-ajout-long.png",
     "de": 0,
     "texte": "Ajoutez vos *produits*",
     "scroll": [
      0,
      380,
      0.15,
      0.7
     ],
     "taps": [
      {
       "x": 195,
       "y": 539,
       "at": 0.95
      },
      {
       "x": 136,
       "y": 1077,
       "at": 1.7
      }
     ]
    },
    {
     "img": "assets/screens/20-vitrine-long.png",
     "de": 2.25,
     "texte": "Votre *vitrine* en ligne",
     "scroll": [
      0,
      330,
      2.6,
      3.4
     ],
     "taps": []
    }
   ],
   "succes": 1.85,
   "fin": 1.5,
   "vo": "s3"
  },
  {
   "type": "commandes_pluie",
   "voix": "Et les commandes arrivent, directement sur votre téléphone !",
   "commandes": [
    "Riz parfumé 25 kg",
    "Huile végétale 5 L",
    "Sucre en poudre 5 kg",
    "Lait en poudre 400 g",
    "Spaghetti 500 g"
   ],
   "vo": "s4"
  },
  {
   "type": "boutique",
   "voix": "Vous préparez, et le livreur AMAZER s'occupe de la livraison.",
   "ecran": "assets/screens/11-boutique-commandes.png",
   "tap": {
    "x": 195,
    "y": 525
   },
   "sous_titres": [
    {
     "texte": "Vous *préparez*\net on livre !",
     "de": 0.15
    }
   ],
   "vo": "s5"
  },
  {
   "type": "fin",
   "voix": "AMAZER. Vendez en ligne, vendez plus. amazer point store.",
   "slogan": "Vendez en ligne.\n*Vendez plus.*",
   "mention": "Gratuit pour commencer · Paiement contrôlé par AMAZER",
   "sous_titres_voix": [
    "AMAZER.",
    "Vendez en ligne, vendez plus.",
    "amazer.store"
   ],
   "vo": "s6"
  }
 ]
};
