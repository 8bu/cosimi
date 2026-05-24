import { Routes, Route } from "react-router";
import { AppShell } from "@/components/AppShell";
import ChatPage from "@/routes/index";
import NotFound from "@/routes/NotFound";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}
