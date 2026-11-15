import { blockInvalidNumberKeys, sanitizeNumberInput } from "../utils/inputUtils";
import { capitalizeFirstLetter } from "@/lib/utils";

const inputCls =
  "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-transparent placeholder-slate-300 transition-all duration-200";

export function StyledInput({
  type,
  value,
  onChange,
  placeholder,
  min,
  step,
  maxLength,
  disabled = false,
  capitalize = false,
}: {
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  min?: number | string;
  step?: number | string;
  maxLength?: number;
  disabled?: boolean;
  capitalize?: boolean;
}) {
  const isNumber = type === "number";
  const allowDecimal = !(step === 1 || step === "1");
  return (
    <input
      type={type}
      min={min}
      step={step}
      maxLength={maxLength}
      inputMode={isNumber ? (allowDecimal ? "decimal" : "numeric") : undefined}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) =>
        onChange(
          isNumber
            ? sanitizeNumberInput(e.target.value, { allowDecimal })
            : capitalize && !(e.nativeEvent as InputEvent).isComposing ? capitalizeFirstLetter(e.target.value) : e.target.value,
        )
      }
      onCompositionEnd={(e) => {
        if (capitalize && !isNumber) onChange(capitalizeFirstLetter(e.currentTarget.value));
      }}
      onKeyDown={(e) => {
        if (isNumber) {
          blockInvalidNumberKeys(e, { allowDecimal });
        }
      }}
      className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
    />
  );
}
