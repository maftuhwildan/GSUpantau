import type { ReactNode } from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Header } from "./Header"
import { Sidebar } from "./Sidebar"
import type { AppRole } from "./navigation"
import { WebSocketProvider } from "./ws-provider"

interface DashboardShellProps {
  children: ReactNode
  role: AppRole
  userEmail?: string
  sidebarDefaultOpen?: boolean
}

export function DashboardShell({ children, role, userEmail, sidebarDefaultOpen = true }: DashboardShellProps) {
  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen} className="h-svh overflow-hidden">
      <Sidebar role={role} />
      <SidebarInset className="min-w-0 overflow-hidden">
        <WebSocketProvider>
          <Header role={role} userEmail={userEmail} />
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="app-dashboard-content mx-auto w-full max-w-400 space-y-4 p-3 pb-24 sm:space-y-6 sm:p-5 sm:pb-6 lg:p-6">
              {children}
            </div>
          </main>
        </WebSocketProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
