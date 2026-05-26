import { createFileRoute } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

function HomePane() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
      }}
    >
      <Wordmark size={32} sub="Senior Web Developer" />
      <p style={{ fontSize: "0.875rem", opacity: 0.7 }}>
        Portfolio scaffold — Phase C
      </p>
    </main>
  );
}

export const Route = createFileRoute("/")({
  component: HomePane,
});
