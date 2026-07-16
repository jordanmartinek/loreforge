import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]
        px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
        outline-none transition-colors focus:border-[var(--color-accent)]
        ${className}`}
      {...props}
    />
  );
}
