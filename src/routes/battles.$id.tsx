import { createFileRoute, Outlet } from "@tanstack/react-router";

// Pathless layout so /battles/$id (detail) and /battles/$id/results/$ym (showdown)
// share a parent. Each child supplies its own ClientOnly + AppShell wrapper.
export const Route = createFileRoute("/battles/$id")({
  component: () => <Outlet />,
});
