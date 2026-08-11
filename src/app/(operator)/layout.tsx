import React from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthSession();
  const cookieStore = await cookies();

  if (!user) {
    redirect("/login");
  }

  if (!user.roles.some((role) => role === "ADMIN" || role === "OPERATOR")) {
    redirect("/login");
  }

  const shellRole = user.roles.includes("ADMIN") ? "ADMIN" : "OPERATOR";

  return (
    <DashboardShell
      role={shellRole}
      userEmail={user.email}
      sidebarDefaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </DashboardShell>
  );
}
