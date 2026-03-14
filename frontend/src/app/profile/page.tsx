"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-14 pt-10 sm:px-6">
      <p className="text-sm text-slate-500">Redirection vers le dashboard...</p>
    </section>
  );
}

