import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { WebSocketProvider } from "./ws-provider";

interface DashboardShellProps {
  children: React.ReactNode;
  role: "OPERATOR" | "ADMIN";
  userEmail?: string;
}

export function DashboardShell({
  children,
  role,
  userEmail,
}: DashboardShellProps) {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-background overflow-hidden font-sans">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <WebSocketProvider>
          <Header role={role} userEmail={userEmail} />
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            {children}
          </main>
        </WebSocketProvider>
      </div>
    </div>
  );
}
