"use client";

import { useId, useState } from "react";

import { stationFieldClass, stationLabelClass } from "@/components/stations/shared";
import { NIGER_REGION_CITIES } from "@/lib/local-services";

const OTHER = "__other__";

const sameCity = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" }) === 0;

/** Villes du Niger d'abord, puis les autres villes connues (sans doublon, accents et casse ignorés). */
export function cityOptions(...extra: string[][]): string[] {
  const list = [...NIGER_REGION_CITIES];
  const others = extra
    .flat()
    .map((city) => city.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "fr"));
  for (const city of others) if (!list.some((known) => sameCity(known, city))) list.push(city);
  return list;
}

export type CitySelectProps = {
  label: string;
  value: string;
  onChange: (city: string) => void;
  options: string[];
  disabled?: boolean;
};

/** Liste des villes + « Autre ville… » qui ouvre un champ libre. */
export function CitySelect({ label, value, onChange, options, disabled = false }: CitySelectProps) {
  const uid = useId();
  const [other, setOther] = useState(false);
  const isOther = other || (value !== "" && !options.includes(value));

  return (
    <>
      <label className={stationLabelClass} htmlFor={`${uid}-select`}>
        {label}
        <select
          id={`${uid}-select`}
          className={stationFieldClass}
          value={isOther ? OTHER : value}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            setOther(next === OTHER);
            onChange(next === OTHER ? "" : next);
          }}
        >
          {options.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
          <option value={OTHER}>Autre ville…</option>
        </select>
      </label>
      {isOther ? (
        <label className={stationLabelClass}>
          Nom de la ville
          <input
            className={stationFieldClass}
            value={value}
            required
            minLength={2}
            maxLength={80}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Ex. Birni N'Konni"
          />
        </label>
      ) : null}
    </>
  );
}
