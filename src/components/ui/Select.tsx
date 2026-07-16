import type { SelectHTMLAttributes } from "react";

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]
        px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors
        focus:border-[var(--color-accent)]
        ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
