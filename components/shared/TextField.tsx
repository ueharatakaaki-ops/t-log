"use client";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
};

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  multiline,
  maxLength,
}: TextFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-base font-semibold text-[#0F2537]">{label}</span>
        {!required && <span className="text-xs text-slate-400">任意</span>}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={4}
          className="w-full rounded-xl border border-slate-200 bg-white p-4 text-base text-[#0F2537] outline-none focus:border-[#0F2537] focus:ring-2 focus:ring-[#00A859]/20"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className="h-14 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-[#0F2537] outline-none focus:border-[#0F2537] focus:ring-2 focus:ring-[#00A859]/20"
        />
      )}
    </div>
  );
}
