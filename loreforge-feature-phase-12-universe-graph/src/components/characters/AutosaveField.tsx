import { useAutosaveField } from "../../hooks/useAutosaveField";
import { Input } from "../ui/Input";
import { TextArea } from "../ui/TextArea";

interface AutosaveFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}

/** A labeled field that autosaves via debounce -- the building block behind
 * every text input on the character detail dashboard (FR2, FR4.5). */
export function AutosaveField({
  label,
  value,
  onCommit,
  multiline,
  placeholder,
}: AutosaveFieldProps) {
  const { value: localValue, onChange, flush } = useAutosaveField(value, onCommit);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {label}
      </label>
      {multiline ? (
        <TextArea
          rows={3}
          value={localValue}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={flush}
        />
      ) : (
        <Input
          value={localValue}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={flush}
        />
      )}
    </div>
  );
}
