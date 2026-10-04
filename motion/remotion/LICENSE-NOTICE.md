# ⚠️ Remotion — contrainte de licence (verifiee le 2026-10-04)

Source : https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md

> Une organisation a but lucratif peut utiliser Remotion gratuitement si elle compte
> **jusqu'a 3 employes**. Au-dela, une **Company License** payante est obligatoire.
> Sont egalement couverts gratuitement : les particuliers, les organisations a but non
> lucratif, et **la phase d'evaluation avant deploiement commercial**.

Ce workspace est installe **au titre de l'evaluation**. Il est volontairement :

- **isole** de `frontend/` : Remotion n'est PAS une dependance de l'application Next ;
- **non branche** sur le build ou le deploiement ;
- **remplacable** : le moteur Canvas deterministe (`jde-motion/`) produit deja des rendus
  1080p/60 sans aucune contrainte de licence.

## Avant tout usage commercial

1. Compter les employes de l'entite qui exploite Remotion.
2. Si > 3 : acheter la Company License sur https://remotion.pro
3. Documenter la decision ici meme.

Tant que ce point n'est pas tranche, le moteur par defaut pour la production video
AMAZER reste le pipeline Canvas (voir le Skill `amazer-motion-design`).
