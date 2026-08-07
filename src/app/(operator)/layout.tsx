import React from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell role="OPERATOR" userEmail="operator@local.test">
      {children}
    </DashboardShell>
  );
}
