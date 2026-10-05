import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Job Search Tracker" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next, error } = await props.searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Job Search Tracker</h1>
          <p className="text-muted-foreground">Track, score and draft your NHS and public sector applications.</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <LoginForm next={typeof next === "string" ? next : undefined} linkError={error === "link"} />
        </div>
      </div>
    </main>
  );
}
