"use client";

import { useMutation } from "@tanstack/react-query";
import { History, ShieldCheck, Users } from "lucide-react";
import { useState, type FormEvent } from "react";

import { api, apiMode } from "@/api/client";
import { ALLOWED_DOMAIN, MOCK_PASSWORD, demoAdmins } from "@/api/mock/index.ts";
import { useGate } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Input, Spinner } from "@/components/ui";
import { roleLabel } from "@/lib/permissions";
import { isEmail } from "@/lib/validate";
import { useSession } from "@/store/session";

export default function LoginPage() {
  const ok = useGate("signed_out");
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);
  const login = useMutation({ mutationFn: () => api.login(email, password), onSuccess: ({ token, admin }) => signIn(token, admin) });

  if (!ok) return <Spinner />;

  const emailError = !isEmail(email) ? "Enter your work email address" : !email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`) ? `Use your @${ALLOWED_DOMAIN} address` : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!emailError && password) login.mutate();
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
            <ShieldCheck /> Each role sees only the actions it’s allowed to take
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
          <h2>Sign in to Vendo Admin</h2>
          <p className="muted">For Vendo staff only. Use your company email address.</p>
          <Input label="Work email" type="email" placeholder={`you@${ALLOWED_DOMAIN}`} autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} error={touched ? emailError : null} />
          <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={touched && !password ? "Enter your password" : login.isError ? login.error.message : null} />
          <Button type="submit" block loading={login.isPending}>
            Sign in
          </Button>
          {apiMode === "mock" ? (
            <div className="note stack-sm">
              <span className="small">
                <strong className="strong">Demo mode.</strong> Pick a role to fill the form (password <code>{MOCK_PASSWORD}</code>):
              </span>
              <div className="demo-logins">
                {demoAdmins.map((a) => (
                  <button key={a.id} type="button" onClick={() => (setEmail(a.email), setPassword(MOCK_PASSWORD), login.reset())}>
                    <span>{roleLabel[a.role]}</span>
                    <span className="muted">{a.email}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}
