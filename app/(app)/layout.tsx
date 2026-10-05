import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { getClaims } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const claims = await getClaims();
  if (!claims) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-[1180px] p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-3.5">
        <h1 className="text-[22px] font-bold tracking-tight sm:text-[26px]">Job Search Tracker</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {typeof claims.email === "string" && <span className="hidden sm:inline">{claims.email}</span>}
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-lg border bg-card px-3 py-1.5 font-medium text-foreground hover:border-muted-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <AppNav />
      <main className="pt-4">{children}</main>
    </div>
  );
}
