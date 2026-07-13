import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import { useEffect } from "react";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { initPostHog } from "../integrations/posthog";
import { SwRegister } from "../components/SwRegister";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

const SITE_URL = "https://spendoff.us";
const SITE_TITLE = "Spendoff — spend less, win";
const SITE_DESC =
  "A dead-simple app to track spending with your sibling or friends. Log in seconds; at month's end the lowest spender wins, with a head-to-head breakdown. Passkey sign-in, works offline.";
const OG_IMAGE = `${SITE_URL}/og.png`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESC },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#efece3" },
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#211f1a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Spendoff" },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Spendoff" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESC },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Spendoff — spend less, win" },
      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: SITE_URL },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/logo192.png" },
    ],
  }),
  shellComponent: RootDocument,
});

/* Applies the per-device theme override before first paint so a PWA cold start
 * never flashes the wrong theme. Must stay in sync with lib/theme.ts. */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("spendoff-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Spendoff",
  url: SITE_URL,
  description: SITE_DESC,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web, iOS, Android",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initPostHog();
  }, []);

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <HeadContent />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </head>
      <body>
        <SwRegister />
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
