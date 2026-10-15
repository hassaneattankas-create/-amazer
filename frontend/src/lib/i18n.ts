"use client";

import { useCallback } from "react";

import { useLocaleStore } from "@/store/locale-store";

/**
 * Traduction legere : le texte francais sert de cle, l'anglais est fourni ici.
 * Un texte absent du dictionnaire reste en francais (jamais de cle brute a l'ecran).
 * Variables : t("{n} articles", { n: 3 }).
 */
const EN: Record<string, string> = {
  // Navigation
  Accueil: "Home",
  Boutiques: "Shops",
  Restaurant: "Restaurant",
  Restaurants: "Restaurants",
  Premium: "Premium",
  Promotions: "Deals",
  Avis: "Reviews",
  "Ma Boutique": "My shop",
  "Activer vendeur": "Activate seller account",
  "Tableau de bord": "Dashboard",
  Messages: "Messages",
  "Espace livreur": "Courier area",
  "Espace Admin": "Admin",
  Menu: "Menu",
  "Menu principal": "Main menu",
  "Se connecter": "Sign in",
  "Créer un compte": "Create account",
  "Devenir vendeur": "Become a seller",
  "Se déconnecter": "Sign out",
  "Déconnexion…": "Signing out…",
  Panier: "Cart",
  Notifications: "Notifications",
  // Pays / devise / langue
  "Pays, devise et langue": "Country, currency and language",
  Pays: "Country",
  "Région ou ville": "Region or city",
  Devise: "Currency",
  Langue: "Language",
  Enregistrer: "Save",
  Annuler: "Cancel",
  "Les prix sont payés en XOF. La conversion est indicative.":
    "Prices are paid in XOF. Conversion is for reference only.",
  "Préférences enregistrées.": "Preferences saved.",
  // Accueil
  "Achetez et vendez en toute confiance": "Buy and sell with confidence",
  "Rechercher un produit, une marque…": "Search for a product, a brand…",
  "Rechercher un produit, une marque ou une catégorie": "Search for a product, a brand or a category",
  Catégories: "Categories",
  Tout: "All",
  Nouveautés: "New arrivals",
  "Catégorie": "Category",
  "Résultats pour « {q} »": "Results for “{q}”",
  "Boutiques vérifiées": "Verified shops",
  "Badge attribué par AMAZER": "Badge granted by AMAZER",
  "Paiement contrôlé": "Checked payment",
  "Confirmé avant toute préparation": "Confirmed before any preparation",
  Livraison: "Delivery",
  "Standard ou express": "Standard or express",
  "Boutiques à la une": "Featured shops",
  "Bonnes affaires": "Top deals",
  "Voir tout": "See all",
  "Chargement des produits": "Loading products",
  "Impossible de charger les produits. Vérifiez votre connexion.": "Could not load products. Check your connection.",
  Réessayer: "Try again",
  "Aucun produit trouvé": "No products found",
  "Essayez un autre mot, une autre catégorie ou élargissez les filtres.":
    "Try another word, another category or widen the filters.",
  "Tout réinitialiser": "Reset all",
  "Chargement…": "Loading…",
  "Voir plus de produits": "Show more products",
  "Vous avez un commerce ?": "Do you run a business?",
  "Vendez ou revendez sur AMAZER": "Sell or resell on AMAZER",
  "Ouvrez votre boutique, ou revendez nos produits sans stock et gardez la marge.":
    "Open your shop, or resell our products without stock and keep the margin.",
  "Ouvrez votre boutique AMAZER et vendez partout.": "Open your AMAZER shop and sell everywhere.",
  Scan: "Scan",
  // Catalogue
  Pertinence: "Relevance",
  "Prix croissant": "Price: low to high",
  "Prix décroissant": "Price: high to low",
  "{n} article": "{n} item",
  "{n} articles": "{n} items",
  "Rupture de stock": "Out of stock",
  "Boutique vérifiée": "Verified shop",
  // Catégories
  Alimentation: "Groceries",
  Accessoires: "Accessories & fashion",
  Electronique: "Electronics",
  Technologie: "Computers & tech",
  Hygiene: "Health & hygiene",
  Maison: "Home",
  // Pied de page
  Acheter: "Buy",
  Vendre: "Sell",
  "Aide et légal": "Help & legal",
  "Comment ça marche ?": "How it works",
  "Espace vendeur": "Seller area",
  "Guide du vendeur": "Seller guide",
  "Devenir livreur": "Become a courier",
  "Revendre sans stock": "Resell without stock",
  Affiliation: "Affiliate program",
  "Formations gratuites": "Free training",
  "Signaler un problème": "Report a problem",
  "Conditions d'utilisation": "Terms of use",
  "Politique de confidentialité": "Privacy policy",
  "Suppression de compte": "Account deletion",
  "La marketplace africaine : boutiques, restaurants et services, du Niger vers le monde.":
    "The African marketplace: shops, restaurants and services, from Niger to the world.",
  "Écrire à AMAZER": "Message AMAZER",
  "Support :": "Support:",
};

// Libelles venant de la base sans accents : corriges a l'affichage.
const FR: Record<string, string> = {
  Electronique: "Électronique",
  Hygiene: "Hygiène",
};

const DICTIONARIES: Record<string, Record<string, string>> = { en: EN, fr: FR };

export function translate(language: string, text: string, vars?: Record<string, string | number>): string {
  const template = DICTIONARIES[language]?.[text] ?? text;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function useT() {
  const language = useLocaleStore((state) => state.language);
  return useCallback(
    (text: string, vars?: Record<string, string | number>) => translate(language, text, vars),
    [language]
  );
}
