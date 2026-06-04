import { Link, useLocation } from "@tanstack/react-router";
import { MagnifyingGlass, UploadSimple, Files, Warning, Stack, Flask } from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const ITEMS = [
  { to: "/", label: "Retrieve", icon: MagnifyingGlass },
  { to: "/ingest", label: "Ingest", icon: UploadSimple },
  { to: "/documents", label: "Documents", icon: Files },
  { to: "/fallback", label: "Fallback", icon: Warning },
  { to: "/corpus", label: "Corpus", icon: Stack },
] as const;

export function AppSidebar() {
  const { pathname } = useLocation();
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Flask className="size-4" weight="fill" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Cosimi</span>
            <span className="text-xs text-muted-foreground">lab</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.label}>
                    <Link to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
