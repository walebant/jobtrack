"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="space-y-2">
        <h2 className="text-lg font-bold">Check your email</h2>
        <p className="text-muted-foreground">
          We sent a sign-in link to <b className="text-foreground">{state.email}</b>. Open it on this device to sign in.
          The link works once and expires after an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="space-y-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          placeholder="you@example.com"
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={state.status === "error" || linkError ? "login-error" : undefined}
          className="h-10 bg-background"
        />
      </div>
      {(state.status === "error" || linkError) && (
        <p id="login-error" className="text-sm text-destructive">
          {state.status === "error" ? state.message : "That sign-in link has expired or was already used. Send a new one."}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-10 w-full">
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
