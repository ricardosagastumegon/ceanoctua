import { forwardRef, type TextareaHTMLAttributes } from 'react';

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className, id, rows = 3, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-dark-2"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        {...rest}
        className={`mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:bg-sand-l/50 ${
          error ? 'border-rust focus:border-rust focus:ring-rust' : ''
        }`}
      />
      {error ? (
        <p className="mt-1 text-xs text-rust">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-dark-3">{hint}</p>
      ) : null}
    </div>
  );
});
