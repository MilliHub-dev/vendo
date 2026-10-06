"use client";

import { useMutation } from "@tanstack/react-query";
import { History, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { api } from "@/api/client";
import { useGate } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Input, Spinner } from "@/components/ui";
import { isEmail } from "@/lib/validate";

const COMPANY_EMAIL_DOMAIN = "vendoltd.com";
const RESEND_SECONDS = 60;

/** Staff sign-in: work email → 6-digit code sent to that address. No passwords. */
export default function LoginPage() {
  const ok = useGate("signed_out");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const address = email.trim().toLowerCase();

  const request = useMutation({
    mutationFn: () => api.requestCode(address),
    onSuccess: () => {
      setStep("code");
      setCode("");
      setTouched(false);
      setSeconds(RESEND_SECONDS);
    },
  });
  const verify = useMutation({ mutationFn: () => api.verifyCode(address, code), onError: () => setCode("") });

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  if (!ok) return <Spinner />;

  const emailError = !isEmail(email) ? "Enter your work email address" : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (step === "email" && !emailError) request.mutate();
    if (step === "code" && code.length === 6) verify.mutate();
  };

  return (
    <div className="auth">
      <section className="auth__brand" style={{ background: "var(--navy, #0A1633)" }}>
        <div className="row">
          <Logo height={30} forceWhite />
          <span className="brand__tag" style={{ background: "#fff", color: "#0A1633" }}>
            ADMIN
          </span>
        </div>
        <h1>
          Run Vendo
          <br />
          from one place.
        </h1>
        <ul>
          <li>
            <Users /> Orders, riders, vendors and customers across every city
          </li>
          <li>
            <ShieldCheck /> Access requires an active administrator account
          </li>
          <li>
            <History /> Every change is recorded in the audit log
          </li>
        </ul>
      </section>

      <section className="auth__panel">
        <form className="auth__form" onSubmit={submit} noValidate>
          <div className="between">
            <span className="eyebrow">Staff sign-in</span>
            <ThemeToggle />
          </div>

          {step === "email" ? (
            <>
              <h2>Sign in to Vendo Admin</h2>
              <p className="muted">For Vendo staff only. We’ll email a 6-digit code to your company address.</p>
              <Input
                label="Work email"
                type="email"
                placeholder={`you@${COMPANY_EMAIL_DOMAIN}`}
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => (setEmail(e.target.value), request.isError && request.reset())}
                error={touched && emailError ? emailError : request.isError ? request.error.message : null}
              />
              <Button type="submit" block loading={request.isPending}>
                Send code
              </Button>

            </>
          ) : (
            <>
              <h2>Enter the code</h2>
              <p className="muted">
                We emailed a 6-digit code to <strong className="strong">{address}</strong>.
              </p>
              <Input
                label="Verification code"
                className="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => (setCode(e.target.value.replace(/\D/g, "").slice(0, 6)), verify.isError && verify.reset())}
                error={verify.isError ? verify.error.message : touched && code.length < 6 ? "Enter all 6 digits" : null}
                hint="Check your spam folder if it hasn’t arrived."
              />
              <Button type="submit" block loading={verify.isPending}>
                Sign in
              </Button>
              <div className="between">
                <Button variant="ghost" size="sm" onClick={() => (setStep("email"), setCode(""), verify.reset())}>
                  Use a different email
                </Button>
                <Button variant="ghost" size="sm" disabled={seconds > 0} loading={request.isPending} onClick={() => request.mutate()}>
                  {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
                </Button>
              </div>
              {request.isError ? <p className="text-danger">{request.error.message}</p> : null}
            </>
          )}
        </form>
      </section>
    </div>
  );
}
