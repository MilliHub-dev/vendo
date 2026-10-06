"use client";

import { useMutation } from "@tanstack/react-query";
import { Banknote, Bike, ClipboardList } from "lucide-react";
import { useState, type FormEvent } from "react";

import { api } from "@/api/client";
import { useGate } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Input, Spinner } from "@/components/ui";
import { normalisePhone } from "@/lib/phone";
import { isEmail, isName } from "@/lib/validate";
import { useSession } from "@/store/session";

/** Login and sign-up are one flow: email → email code → (new vendors only) name and phone. */
export default function LoginPage() {
  const ok = useGate("signed_out");
  const { signIn } = useSession();
  const [step, setStep] = useState<"email" | "code" | "details">("email");
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const phone = normalisePhone(phoneInput);

  const request = useMutation({ mutationFn: (p: string) => api.requestCode(p), onSuccess: () => (setStep("code"), setTouched(false)) });
  const verify = useMutation({
    mutationFn: () => api.verifyCode(email.trim().toLowerCase(), code),
    onSuccess: ({ token, user }) => {
      if (user) return signIn(token, user); // returning vendor: the gate moves them on
      setStep("details");
      setTouched(false);
    },
  });
  const signUp = useMutation({ mutationFn: () => api.completeSignUp({ name, phone: phone! }), onSuccess: (user) => signIn(useSession.getState().token!, user) });

  if (!ok) return <Spinner />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (step === "email" && isEmail(email)) request.mutate(email.trim().toLowerCase());
    if (step === "code" && code.length === 6) verify.mutate();
    if (step === "details" && isName(name) && phone) signUp.mutate();
  };

  return (
    <div className="auth">
      <section className="auth__brand">
        <div className="row">
          <Logo height={30} forceWhite />
          <span className="brand__tag" style={{ background: "#fff", color: "var(--blue)" }}>
            VENDOR
          </span>
        </div>
        <h1>
          Sell more
          <br />
          with Vendo.
        </h1>
        <ul>
          <li>
            <ClipboardList /> Take orders and manage your menu in one place
          </li>
          <li>
            <Bike /> Vendo riders deliver — no riders of your own needed
          </li>
          <li>
            <Banknote /> Manage earnings and bank withdrawals
          </li>
        </ul>
      </section>

      <section className="auth__panel">
        <form className="auth__form" onSubmit={submit} noValidate>
          <div className="between">
            <span className="eyebrow">{step === "details" ? "Create your account" : "Sign in or register"}</span>
            <ThemeToggle />
          </div>

          {step === "email" ? (
            <>
              <h2>What’s your email address?</h2>
              <p className="muted">We’ll email you a code to sign you in or start registering your store.</p>
              <Input label="Email address" type="email" placeholder="you@example.com" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} error={touched && !isEmail(email) ? "Enter a valid email address" : request.isError ? request.error.message : null} />
              <Button type="submit" block loading={request.isPending}>
                Continue
              </Button>
            </>
          ) : step === "code" ? (
            <>
              <h2>Enter the code</h2>
              <p className="muted">We sent a 6-digit code to {email}.</p>
              <Input label="Verification code" className="otp" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} error={verify.isError ? `${verify.error.message}. Check the code and try again.` : touched && code.length < 6 ? "Enter all 6 digits" : null} />
              <Button type="submit" block loading={verify.isPending}>
                Verify
              </Button>
              <Button variant="ghost" onClick={() => (setStep("email"), setCode(""), verify.reset())}>
                Use a different email
              </Button>
            </>
          ) : (
            <>
              <h2>About you</h2>
              <p className="muted">You’re the store owner or manager. We use this to contact you about orders and payouts.</p>
              <Input label="Full name" placeholder="e.g. Hauwa Sani" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} error={touched && !isName(name) ? "Enter your name" : null} />
<Input label="Phone number" prefix="🇳🇬 +234" placeholder="803 000 0000" inputMode="tel" autoComplete="tel" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} error={touched && !phone ? "Enter a valid Nigerian mobile number" : signUp.isError ? signUp.error.message : null} />
              <Button type="submit" block loading={signUp.isPending}>
                Continue to store registration
              </Button>
            </>
          )}
          <p className="small subtle">By continuing you agree to Vendo’s Terms of Service and Privacy Policy.</p>
        </form>
      </section>
    </div>
  );
}
