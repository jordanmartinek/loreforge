import type { TextareaHTMLAttributes } from "react";

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]
        px-3 py-2 text-sm leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
        outline-none transition-colors focus:border-[var(--color-accent)]
        ${className}`}
      {...props}
    />
  );
}
