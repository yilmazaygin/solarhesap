"use client";

import { forwardRef, SelectHTMLAttributes } from "react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  options: readonly Option[];
  error?: string;
  helperText?: string;
  placeholder?: string;
}

const CustomSelect = forwardRef<HTMLSelectElement, CustomSelectProps>(
  ({ label, options, error, helperText, placeholder, className = "", id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="input-label">
          {label}
        </label>
        <select
          ref={ref}
          id={id}
          className={`select-field ${error ? "error" : ""} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-slate-500 mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

CustomSelect.displayName = "CustomSelect";
export default CustomSelect;
