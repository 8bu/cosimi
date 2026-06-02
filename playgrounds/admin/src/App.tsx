import { Outlet, Route, Routes } from "react-router";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { Sidebar } from "@/components/Sidebar";
import UnansweredRoute from "@/routes/unanswered";
import PairsRoute from "@/routes/pairs";
import TeachQueueRoute from "@/routes/teach-queue";
import ImportRoute from "@/routes/import";
import RollbackRoute from "@/routes/rollback";
import PresetsRoute from "@/routes/presets";
import NotFound from "@/routes/NotFound";

function Layout() {
  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <Outlet />
      </main>
      {/* Global `?` cheatsheet — listens at the window level. Lives at
          the layout root so it's available in every admin view. */}
      <KeyboardShortcuts />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<UnansweredRoute />} />
        <Route path="/pairs" element={<PairsRoute />} />
        <Route path="/teach-queue" element={<TeachQueueRoute />} />
        <Route path="/import" element={<ImportRoute />} />
        <Route path="/rollback" element={<RollbackRoute />} />
        <Route path="/presets" element={<PresetsRoute />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
