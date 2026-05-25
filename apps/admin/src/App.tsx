import { Outlet, Route, Routes } from "react-router";
import { Sidebar } from "@/components/Sidebar";
import UnansweredRoute from "@/routes/unanswered";
import PairsRoute from "@/routes/pairs";
import TeachQueueRoute from "@/routes/teach-queue";
import ImportRoute from "@/routes/import";
import RollbackRoute from "@/routes/rollback";

function Layout() {
  return (
    <div className="h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <Outlet />
      </main>
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
      </Route>
    </Routes>
  );
}
