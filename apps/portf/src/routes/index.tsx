import { createFileRoute } from "@tanstack/react-router";
import { HomePane } from "@/features/home/components/HomePane";

export const Route = createFileRoute("/")({
  component: HomePane,
});
