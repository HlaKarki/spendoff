import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const APP_ID = "93AV3DLH8S.us.spendoff.app";
const aasaUrl = new URL("../../public/.well-known/apple-app-site-association", import.meta.url);
const headersUrl = new URL("../../public/_headers", import.meta.url);

type AssociationFile = {
  applinks: {
    details: Array<{
      appIDs: string[];
      components: Array<{ "/": string; comment?: string }>;
    }>;
  };
  webcredentials: { apps: string[] };
};

describe("Apple app-site association", () => {
  const association = JSON.parse(readFileSync(aasaUrl, "utf8")) as AssociationFile;

  test("associates the signed Spendoff app with passkeys", () => {
    expect(association.webcredentials).toEqual({ apps: [APP_ID] });
  });

  test("opens only the email magic-link path as a universal link", () => {
    expect(association.applinks.details).toEqual([
      {
        appIDs: [APP_ID],
        components: [
          {
            "/": "/auth/magic",
            comment: "Open Spendoff email magic links in the native app.",
          },
        ],
      },
    ]);
  });

  test("serves the extensionless asset as JSON through Cloudflare static assets", () => {
    const headers = readFileSync(headersUrl, "utf8");
    expect(headers).toContain("/.well-known/apple-app-site-association\n");
    expect(headers).toContain("  Content-Type: application/json\n");
    expect(headers).toContain("  X-Content-Type-Options: nosniff\n");
  });
});
