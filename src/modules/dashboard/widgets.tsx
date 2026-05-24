import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export function Card({
  title,
  to,
  children,
  className = '',
}: {
  title: string;
  to?: string;
  children: ReactNode;
  className?: string;
}) {
  const heading = (
    <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-dark-2">
      {title}
    </h3>
  );
  return (
    <section className={`rounded-card border border-sand bg-white p-5 shadow-sm ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-2">
        {to ? (
          <Link to={to} className="hover:text-teal-d">
            {heading}
          </Link>
        ) : (
          heading
        )}
        {to && (
          <Link to={to} className="text-xs text-teal-d hover:underline">
            Ver →
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export function KPI({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'success' | 'warn' | 'danger';
}) {
  const tones = {
    default: 'text-dark',
    success: 'text-teal-d',
    warn: 'text-gold',
    danger: 'text-rust',
  };
  return (
    <div className="rounded-md border border-sand bg-sand-l/40 p-3">
      <div className={`font-heading text-3xl font-bold ${tones[tone]}`}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-dark-2">{label}</div>
      {hint && <div className="mt-1 text-xs text-dark-3">{hint}</div>}
    </div>
  );
}

export function LoadingLine() {
  return <p className="text-xs text-dark-3">Cargando…</p>;
}

export function ErrorLine({ message }: { message: string }) {
  return <p className="text-xs text-rust">Error: {message}</p>;
}

export function EmptyLine({ message }: { message: string }) {
  return <p className="text-xs text-dark-3">{message}</p>;
}
