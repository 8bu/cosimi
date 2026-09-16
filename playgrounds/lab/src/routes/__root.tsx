import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { useShell } from "@/components/shell/shell-store";

function RootLayout() {
  const rail = useShell((s) => s.rail);
  return (
    <div className="lab" data-theme="pavilion" data-density="regular" data-rail={rail}>
      <Sidebar />
      <div className="main">
        <Topbar />
        <Outlet />
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout });
