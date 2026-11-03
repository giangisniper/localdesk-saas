"use client";
import { emailError } from "@/lib/email";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { loginAction, registerAction } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/action";

function useAuthForm(action: (v: unknown) => Promise<ActionResult>, redirectTo: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const emailProblem = emailError(values.email ?? "", { required: true });
    if (emailProblem) { setError(undefined); setFields({ email: emailProblem }); return; }
    setFields({});
    start(async () => {
      const r = await action(values);
      if (r.ok) { router.push(redirectTo); router.refresh(); return; }
      setError(r.error); setFields(r.fieldErrors ?? {});
    });
  }
  return { pending, error, fields, submit };
}

export function LoginForm({ oauth, initialError }: { oauth?: React.ReactNode; initialError?: string }) {
  const f = useAuthForm(loginAction, "/dashboard");
  return (
    <form onSubmit={f.submit} className="space-y-4" noValidate>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="-mt-2 text-sm text-ink-500">Sign in to manage your appointments.</p>
      {(f.error ?? initialError) && <Alert>{f.error ?? initialError}</Alert>}
      {oauth}
      <Field label="Email" error={f.fields.email}><Input name="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" required autoFocus={!oauth} /></Field>
      <Field label="Password" error={f.fields.password}><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <Button type="submit" size="lg" className="w-full" loading={f.pending}>Sign in</Button>
      <p className="text-center text-sm text-ink-500">New to LocalDesk? <Link href="/register" className="font-medium text-brand-700 hover:underline">Create an account</Link></p>
      <div className="rounded-lg bg-ink-100 p-3 text-xs text-ink-600">
        <p className="font-medium text-ink-800">Demo account</p>
        <p>owner@demo.localdesk.app · LocalDesk2026!</p>
      </div>
    </form>
  );
}

export function RegisterForm({ oauth, initialError }: { oauth?: React.ReactNode; initialError?: string }) {
  const f = useAuthForm(registerAction, "/onboarding");
  return (
    <form onSubmit={f.submit} className="space-y-4" noValidate>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="-mt-2 text-sm text-ink-500">Free for 14 days. No credit card required.</p>
      {(f.error ?? initialError) && <Alert>{f.error ?? initialError}</Alert>}
      {oauth}
      <Field label="Full name" error={f.fields.name}><Input name="name" autoComplete="name" required /></Field>
      <Field label="Work email" error={f.fields.email}><Input name="email" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" required /></Field>
      <Field label="Password" error={f.fields.password} hint="At least 10 characters, with letters and numbers."><Input name="password" type="password" autoComplete="new-password" required /></Field>
      <Button type="submit" size="lg" className="w-full" loading={f.pending}>Create account</Button>
      <p className="text-center text-sm text-ink-500">Already have an account? <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></p>
    </form>
  );
}
