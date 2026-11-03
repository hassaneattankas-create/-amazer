"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type AccordionContextValue = {
  isOpen: (id: string, itemDefault: boolean) => boolean;
  toggle: (id: string) => void;
  register: (id: string, defaultOpen: boolean) => void;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

function toList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export type AccordionProps = {
  /** Une seule section ouverte à la fois (comme le menu principal). */
  single?: boolean;
  /** Section(s) ouverte(s) au départ (mode non contrôlé). */
  defaultOpen?: string | string[];
  /** Mode contrôlé : identifiants ouverts. */
  open?: string[];
  onOpenChange?: (open: string[]) => void;
  className?: string;
  children: ReactNode;
};

/**
 * Groupe de sections repliables, au toucher comme le menu principal.
 * Les sections (`AccordionItem`) peuvent contenir un autre `Accordion` (niveau imbriqué, variant="row").
 */
export function Accordion({ single = false, defaultOpen, open, onOpenChange, className, children }: AccordionProps) {
  // null = l'utilisateur n'a encore rien touché : on applique les ouvertures par défaut.
  const [touched, setTouched] = useState<string[] | null>(null);
  const defaultsRef = useRef<Set<string>>(new Set(toList(defaultOpen)));
  const groupDefaults = useMemo(() => toList(defaultOpen), [defaultOpen]);
  const current = open ?? touched;

  const isOpen = useCallback(
    (id: string, itemDefault: boolean) => (current === null ? groupDefaults.includes(id) || itemDefault : current.includes(id)),
    [current, groupDefaults],
  );
  const register = useCallback((id: string, itemDefault: boolean) => {
    if (itemDefault) defaultsRef.current.add(id);
  }, []);
  const toggle = useCallback(
    (id: string) => {
      const base = current ?? [...defaultsRef.current];
      const wasOpen = base.includes(id);
      const next = single ? (wasOpen ? [] : [id]) : wasOpen ? base.filter((entry) => entry !== id) : [...base, id];
      if (open === undefined) setTouched(next);
      onOpenChange?.(next);
    },
    [current, open, onOpenChange, single],
  );
  const value = useMemo(() => ({ isOpen, toggle, register }), [isOpen, toggle, register]);

  return (
    <AccordionContext.Provider value={value}>
      <div className={cn("space-y-2", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export type AccordionTone = "default" | "warning" | "danger";

export type AccordionItemProps = {
  /** Identifiant unique dans le groupe. */
  id: string;
  title: ReactNode;
  /** Ligne courte sous le titre (facultatif). */
  description?: ReactNode;
  /** Icône lucide décorative, taille posée par l'appelant (ex. `<Fuel className="h-5 w-5" />`). */
  icon?: ReactNode;
  /** Texte court à droite (ex. « 12 stations », « 2 à confirmer »). */
  meta?: ReactNode;
  /** Couleur du badge meta ; le texte du meta doit dire la même chose. */
  tone?: AccordionTone;
  /** « card » : carte de premier niveau ; « row » : ligne compacte imbriquée. */
  variant?: "card" | "row";
  /** Ouvert au départ (hors contrôle du groupe). */
  defaultOpen?: boolean;
  /** Enveloppe le bouton dans un titre h2…h6 pour la structure de la page. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  className?: string;
  children: ReactNode;
};

const toneClass: Record<AccordionTone, string> = {
  default: "bg-surface-2 text-ink-700",
  warning: "bg-warning/15 text-ink-900",
  danger: "bg-danger/10 text-danger",
};

/** Une section repliable : en-tête bouton (aria-expanded), contenu rendu seulement quand il est ouvert. */
export function AccordionItem({
  id,
  title,
  description,
  icon,
  meta,
  tone = "default",
  variant = "card",
  defaultOpen = false,
  headingLevel,
  className,
  children,
}: AccordionItemProps) {
  const group = useContext(AccordionContext);
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const buttonId = `${baseId}-button`;
  const register = group?.register;
  useEffect(() => {
    register?.(id, defaultOpen);
  }, [register, id, defaultOpen]);

  const expanded = group ? group.isOpen(id, defaultOpen) : localOpen;
  const toggle = () => (group ? group.toggle(id) : setLocalOpen((value) => !value));
  const isCard = variant === "card";
  const Heading = headingLevel ? (`h${headingLevel}` as const) : "div";

  return (
    <div className={cn(isCard ? "rounded-card border border-border bg-card shadow-resting" : "", className)}>
      <Heading className="m-0">
        <button
          id={buttonId}
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={toggle}
          className={cn(
            "flex min-h-12 w-full items-center gap-3 text-left transition-colors duration-fast hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            isCard ? "rounded-card px-3 py-2 sm:px-4" : "rounded-field px-2 py-1.5 sm:px-3",
          )}
        >
          {icon ? <span className="grid shrink-0 place-items-center text-brand-600" aria-hidden="true">{icon}</span> : null}
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("min-w-0 font-semibold text-ink-900", isCard ? "text-base" : "text-sm")}>{title}</span>
            {meta != null && meta !== "" ? (
              <span className={cn("inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold", toneClass[tone])}>{meta}</span>
            ) : null}
            {description ? <span className="w-full text-xs text-ink-600">{description}</span> : null}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-ink-500 transition-transform duration-fast", expanded ? "rotate-180" : "")}
            aria-hidden="true"
          />
        </button>
      </Heading>
      {expanded ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          className={cn(
            "animate-in fade-in-0 motion-reduce:animate-none",
            // Niveaux imbriqués plus serrés sur mobile : la largeur utile reste suffisante au 3e niveau.
            isCard ? "border-t border-border px-3 pb-4 pt-3 sm:px-4" : "mb-1 ml-2 border-l border-border pb-2 pl-2 pt-1 sm:ml-3 sm:pl-3",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
