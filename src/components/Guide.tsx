type Props = {
  title: string;
  message: string;
  tone?: "default" | "error";
  actionLabel?: string;
  onAction?: () => void;
};

export function Guide({ title, message, tone = "default", actionLabel, onAction }: Props) {
  return <div className={`guide guide-${tone}`} role={tone === "error" ? "alert" : undefined}>
    <svg className="guide-mascot" viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <path d="M36 9v7M31 9h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="10" y="18" width="52" height="42" rx="12" fill="white" stroke="currentColor" strokeWidth="3" />
      <path d="M10 33H5v13h5M62 33h5v13h-5" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="26" cy="36" r="3" fill="currentColor" /><circle cx="46" cy="36" r="3" fill="currentColor" />
      <path d="M29 47c3 3 11 3 14 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
    <div><strong>{title}</strong><p>{message}</p>{actionLabel && onAction && <button className="guide-action" type="button" onClick={onAction}>{actionLabel}</button>}</div>
  </div>;
}
