import { createFileRoute, redirect } from "@tanstack/react-router";

/* The register moved home (Counter IA, HLA-147). The route stays for old
 * bookmarks and installed-PWA shortcuts that point at /log. */
export const Route = createFileRoute("/log")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
