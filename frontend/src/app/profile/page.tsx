"use client";

export default function ProfilePage() {
  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-14 sm:px-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Profil</h1>
        <p className="mt-2 text-sm text-slate-600">Parametres du compte AMAZER.</p>
      </header>

      <article className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-amber-50 p-6 shadow-2xl">
        <p className="text-sm font-medium text-slate-700">Devise</p>
        <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900">
          Franc CFA (XOF) uniquement
        </p>
      </article>
    </section>
  );
}

