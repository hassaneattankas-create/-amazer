"use client";

import { Eye, EyeOff } from "lucide-react";
import { InputHTMLAttributes, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  /** When true, input is shown as plain text initially (user can hide). Default: masked. */
  defaultVisible?: boolean;
  /** Use text input with optional masking (for admin PIN / secondary key). */
  masking?: "password" | "text";
  /** Class on the outer wrapper (e.g. flex layouts). */
  wrapperClassName?: string;
};

export function PasswordInput({
  label,
  id: idProp,
  className,
  wrapperClassName,
  defaultVisible = false,
  masking = "password",
  ...rest
}: PasswordInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [visible, setVisible] = useState(defaultVisible);

  const inputType = masking === "text" ? "text" : visible ? "text" : "password";

  return (
    <div className={cn("w-full", wrapperClassName)}>
      {label ? (
        <label className="text-sm font-medium text-slate-800" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className={cn("relative", label ? "mt-1" : "")}>
        <input
          id={id}
          type={inputType}
          autoComplete={rest.autoComplete ?? (masking === "password" ? "current-password" : "off")}
          className={cn(
            "w-full rounded-md border border-slate-300 px-3 py-2 text-sm",
            masking === "password" ? "pr-11" : "",
            className,
          )}
          {...rest}
        />
        {masking === "password" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-slate-500 hover:text-slate-800"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
