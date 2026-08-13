"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bird } from "lucide-react"

import { StatusBadge } from "@/components/ui/status-badge"
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { getNavigation, isNavigationItemActive, type AppRole } from "./navigation"

interface SidebarProps {
  role: AppRole
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  return (
    <ShadcnSidebar collapsible="icon" variant="inset" surfaceClassName="app-sidebar-frosted">
      <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip="GSU Pantau"
              className="hover:!bg-foreground/10 hover:!text-accent-foreground"
            >
              <Link href={role === "ADMIN" ? "/admin/dashboard" : "/dashboard"} onClick={() => setOpenMobile(false)}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Bird className="size-4" />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-heading font-semibold">GSU Pantau</span>
                  <span className="block truncate text-xs text-muted-foreground">Poultry Counter RPA</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {getNavigation(role).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isNavigationItemActive(pathname, item.href)
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className={active
                          ? "!bg-foreground/10 !font-normal !text-accent-foreground hover:!bg-foreground/10 [&_svg]:!text-current [&_svg]:stroke-[1.5]"
                          : "hover:!bg-foreground/10 hover:!text-accent-foreground hover:[&_svg]:!text-current [&_svg]:stroke-[1.5]"}
                      >
                        <Link href={item.href} onClick={() => setOpenMobile(false)}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 pt-3">
        <div className="flex items-center justify-between gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Poultry Counter MVP</span>
          <StatusBadge tone={role === "ADMIN" ? "primary" : "success"} className="uppercase group-data-[collapsible=icon]:hidden">
            {role}
          </StatusBadge>
          <span className="hidden size-2 rounded-full bg-success group-data-[collapsible=icon]:block" aria-label={`Peran ${role}`} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </ShadcnSidebar>
  )
}
