import { forwardRef, type InputHTMLAttributes, type MouseEvent } from "react";

// Plain <input type="date"> only opens the native calendar when you click
// the small icon on the right — clicking anywhere else in the field just
// focuses it with no picker. This wraps it so a click anywhere opens the
// picker too, same look/styling as a plain date input otherwise.
export const DateInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function DateInput({ onClick, ...props }, ref) {
    return (
      <input
        type="date"
        ref={ref}
        onClick={(e: MouseEvent<HTMLInputElement>) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // Unsupported browser or blocked (e.g. disabled field) — the
            // native icon-click still works as a fallback.
          }
          onClick?.(e);
        }}
        {...props}
      />
    );
  },
);
