import Link from "next/link";
import { BookOpen, CheckCircle2, ExternalLink, Target } from "lucide-react";

import { COURSES, RESOURCES } from "./courses";

export const metadata = {
  title: "Formations gratuites — AMAZER",
  description: "Formations pratiques pour vendre, revendre sans stock, faire de l'affiliation et vendre sur WhatsApp, avec AMAZER.",
};

/**
 * Formations : parcours AMAZER (objectif, essentiel, exercice) + ressources externes gratuites verifiees.
 * Les sections <details> fonctionnent sans JavaScript (rapide sur reseau mobile).
 */
export default function FormationsPage() {
  const moduleCount = COURSES.reduce((sum, course) => sum + course.modules.length, 0);
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-gutter pb-14 pt-4">
      <header className="rounded-card bg-ink-900 px-4 py-6 text-white sm:px-8">
        <h1 className="flex items-center gap-2 text-display-sm font-semibold tracking-display">
          <BookOpen className="h-6 w-6 text-brand-400" aria-hidden="true" />
          Formations gratuites
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-white/80">
          {COURSES.length} parcours, {moduleCount} modules courts. Chaque module : un objectif, l&apos;essentiel, et un exercice à faire tout de suite.
        </p>
        <nav aria-label="Parcours" className="mt-4 flex flex-wrap gap-2">
          {COURSES.map((course) => (
            <a
              key={course.key}
              href={`#${course.key}`}
              className="inline-flex min-h-11 items-center rounded-pill border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10"
            >
              {course.title}
            </a>
          ))}
        </nav>
      </header>

      {COURSES.map((course) => (
        <section key={course.key} id={course.key} aria-labelledby={`${course.key}-title`} className="scroll-mt-24 space-y-2">
          <div>
            <h2 id={`${course.key}-title`} className="text-lg font-semibold text-ink-900">
              {course.title}
            </h2>
            <p className="text-sm text-ink-600">Pour : {course.audience}</p>
          </div>
          {course.modules.map((module, index) => (
            <details key={module.title} open={index === 0} className="group rounded-card border border-border bg-card">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-ink-900">
                {module.title}
                <span className="text-xl leading-none text-ink-500 transition-transform duration-fast group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="space-y-3 px-4 pb-4 text-sm text-ink-800">
                <p className="flex items-start gap-2 font-medium">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  Objectif : {module.goal}
                </p>
                <ul className="space-y-2">
                  {module.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-brand-600" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                <p className="flex items-start gap-2 rounded-field bg-surface-1 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">À faire maintenant : </span>
                    {module.exercise}
                  </span>
                </p>
              </div>
            </details>
          ))}
        </section>
      ))}

      <section aria-labelledby="ressources-title" className="space-y-2">
        <h2 id="ressources-title" className="text-lg font-semibold text-ink-900">
          Pour aller plus loin : cours gratuits reconnus
        </h2>
        <p className="text-sm text-ink-600">
          Sélection de formations gratuites en français, proposées par des organismes reconnus. Sites externes à AMAZER.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {RESOURCES.map((resource) => (
            <li key={resource.href}>
              <a
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full gap-3 rounded-card border border-border bg-card p-4 transition-colors duration-fast hover:border-ink-400"
              >
                <ExternalLink className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-ink-900">{resource.title}</span>
                  <span className="block text-xs font-medium uppercase tracking-label text-ink-500">{resource.provider}</span>
                  <span className="mt-1 block text-sm text-ink-600">{resource.text}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/vendre" className="inline-flex min-h-11 items-center rounded-field bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Ouvrir ma boutique
        </Link>
        <Link href="/revendre" className="inline-flex min-h-11 items-center rounded-field border border-border px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1">
          Revendre sans stock
        </Link>
        <Link href="/affiliation" className="inline-flex min-h-11 items-center rounded-field border border-border px-4 text-sm font-semibold text-ink-900 hover:bg-surface-1">
          Affiliation
        </Link>
      </div>
    </section>
  );
}
