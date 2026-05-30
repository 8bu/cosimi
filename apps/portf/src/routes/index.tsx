import { createFileRoute } from "@tanstack/react-router";
import { HomePane } from "@/features/home/components/HomePane";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Long NGUYỄN - portfolio" },
      {
        name: "description",
        content:
          "Long NGUYỄN (8bu) - Senior Web Developer. Personal portfolio with selected projects, essays, and a chat surface.",
      },
      { property: "og:title", content: "Long NGUYỄN - portfolio" },
      { property: "og:description", content: "Selected projects, essays, and a chat surface." },
      { property: "og:image", content: "/og/default.png" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://8bu.dev/" }],
  }),
  component: HomePane,
});
