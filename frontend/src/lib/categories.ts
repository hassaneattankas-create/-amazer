export type HomeCategory = {
  slug: string;
  label: string;
  emoji: string;
  query: string;
};

export const HOME_CATEGORIES: HomeCategory[] = [
  { slug: "alimentation", label: "Alimentation", emoji: "🥕", query: "riz huile lait" },
  { slug: "restaurant", label: "Restaurant", emoji: "🍽️", query: "restaurant plat menu" },
  { slug: "accessoires", label: "Accessoires", emoji: "👜", query: "ecouteur casque accessoires" },
  { slug: "technologie", label: "Technologie", emoji: "💻", query: "smartphone ordinateur solaire" },
];

export function resolveCategoryQuery(slug: string): string {
  const match = HOME_CATEGORIES.find((item) => item.slug === slug);
  return match?.query ?? slug;
}
