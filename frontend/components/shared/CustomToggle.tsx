"use client";

interface CustomToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  description?: string;
}

export default function CustomToggle({
  label,
  checked,
  onChange,
  id,
  description,
}: CustomToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-slate-300 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        id={id}
        className="toggle-switch"
        data-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-dot" />
      </button>
    </div>
  );
}
