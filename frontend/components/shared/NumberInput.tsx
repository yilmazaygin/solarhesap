"use client";

import { forwardRef, InputHTMLAttributes } from "react";

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  helperText?: string;
  unit?: string;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, error, helperText, unit, className = "", id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="input-label">
          {label}
          {unit && <span className="text-slate-500 font-normal ml-1">({unit})</span>}
        </label>
        <input
          ref={ref}
          id={id}
          type="number"
          className={`input-field ${error ? "error" : ""} ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-slate-500 mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";
export default NumberInput;
