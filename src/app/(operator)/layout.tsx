import React from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthSession();

  if (!user) {
    redirect("/login");
  }

  if (!user.roles.some((role) => role === "ADMIN" || role === "OPERATOR")) {
    redirect("/login");
  }

  const shellRole = user.roles.includes("ADMIN") ? "ADMIN" : "OPERATOR";

  return (
    <DashboardShell role={shellRole} userEmail={user.email}>
      {children}
    </DashboardShell>
  );
}
