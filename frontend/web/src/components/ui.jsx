export function Alert({ variant = 'primary', children }) {
  if (!children) return null;
  return <div className={`alert alert-${variant}`}>{children}</div>;
}

export function Spinner() {
  return <p className="text-secondary"><span className="spinner" />Chargement…</p>;
}

export function Badge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
