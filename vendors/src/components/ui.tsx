"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm"; block?: boolean; loading?: boolean };

export function Button({ variant = "primary", size, block, loading, disabled, children, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={["btn", `btn--${variant}`, size && `btn--${size}`, block && "btn--block", className].filter(Boolean).join(" ")} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}

type FieldProps = { label?: string; error?: string | null; hint?: string };

export function Input({ label, error, hint, prefix, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & FieldProps & { prefix?: string }) {
  const id = useId();
  const input = <input id={id} className={["input", className].filter(Boolean).join(" ")} aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-e` : undefined} {...rest} />;
  return (
    <div className="field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      {prefix ? (
        <div className="input-group">
          <span>{prefix}</span>
          {input}
        </div>
      ) : (
        input
      )}
      {error ? (
        <span id={`${id}-e`} className="field__error">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Textarea({ label, error, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const id = useId();
  return (
    <div className="field">
      {label ? <label htmlFor={id}>{label}</label> : null}
      <textarea id={id} className="textarea" aria-invalid={!!error || undefined} {...rest} />
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function Badge({ tone, children }: { tone?: "primary" | "success" | "warning" | "danger"; children: ReactNode }) {
  return <span className={["badge", tone && `badge--${tone}`].filter(Boolean).join(" ")}>{children}</span>;
}

export function Spinner() {
  return <div className="spinner spinner--page" role="status" aria-label="Loading" />;
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <h3>{title}</h3>
      <p style={{ maxWidth: 380 }}>{children}</p>
      {action}
    </div>
  );
}

/** Dialog: closes on Escape, on the backdrop, or the X. `side` renders it as a right-hand panel. */
export function Modal({ title, onClose, children, footer, wide, side }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; side?: boolean }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className={side ? "overlay overlay--right" : "overlay"} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={side ? "drawer" : wide ? "modal modal--wide" : "modal"}>
        <div className="modal__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel, danger, loading, onConfirm, onClose }: { title: string; message: string; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }>
      <p className="muted">{message}</p>
    </Modal>
  );
}
