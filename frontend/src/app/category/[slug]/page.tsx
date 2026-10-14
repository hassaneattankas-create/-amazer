"use client";

import { useParams } from "next/navigation";

import { CategoryView } from "@/components/catalog/CategoryView";

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  return <CategoryView slug={params.slug} />;
}
