import type { HintFields } from "@/lib/hints";

type FieldSpec = {
  key: keyof HintFields;
  label: string;
  maxLength: number;
  placeholder: string;
  wide?: boolean;
  numeric?: boolean;
  help?: string;
};

const FIELDS: FieldSpec[] = [
  { key: "name", label: "What is it?", maxLength: 80, placeholder: "e.g. Ankara tote bag", wide: true },
  { key: "condition", label: "Condition", maxLength: 60, placeholder: "e.g. Brand new" },
  {
    key: "price",
    label: "Price in mind",
    maxLength: 40,
    placeholder: "e.g. 15000",
    numeric: true,
    help: "Leave empty to get a suggested range. Only what you type is used.",
  },
];

// Typed values are upright ink; placeholders are italic and lighter so they never read as input.
const inputClass =
  "mt-1.5 w-full min-h-11 rounded-xl border border-forest/30 bg-paper px-3 text-ink " +
  "placeholder:italic placeholder:text-muted";

export function HintInputs({
  value,
  onChange,
}: {
  value: HintFields;
  onChange: (next: HintFields) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      {FIELDS.map((f) => {
        const id = `hint-${f.key}`;
        const helpId = f.help ? `${id}-help` : undefined;
        return (
          <div key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-1" : undefined}>
            <label htmlFor={id} className="text-sm font-semibold text-forest">
              {f.label} <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id={id}
              value={value[f.key]}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              maxLength={f.maxLength}
              inputMode={f.numeric ? "numeric" : undefined}
              placeholder={f.placeholder}
              autoComplete="off"
              aria-describedby={helpId}
              className={inputClass}
            />
            {f.help && (
              <p id={helpId} className="mt-1 text-xs text-muted">
                {f.help}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
