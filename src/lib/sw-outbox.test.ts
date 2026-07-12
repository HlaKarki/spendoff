import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { SYNC_FIELDS } from "./outbox";

/**
 * `public/sw.js` re-implements `flushOutbox()` by hand: it lives outside the bundle and outside
 * TypeScript, so nothing about it can fail a typecheck. It has drifted from `outbox.ts` twice —
 * once on which items get deleted, once on which fields get sent — and both times the symptom was
 * silent (an expense lost, or booked in the wrong currency), never an error.
 *
 * These tests read the file as text. They can't prove it behaves correctly, but they can prove it
 * hasn't quietly stopped matching the contract `outbox.ts` defines.
 */
const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const outbox = readFileSync(new URL("./outbox.ts", import.meta.url), "utf8");

describe("public/sw.js mirrors the outbox contract", () => {
  test.each(SYNC_FIELDS)("forwards %s on the sync payload", (field) => {
    expect(sw).toContain(`${field}: i.${field}`);
  });

  // The other half: a field added to SYNC_FIELDS must actually reach the client's own payload too.
  test.each(SYNC_FIELDS)("and so does flushOutbox in outbox.ts (%s)", (field) => {
    expect(outbox).toContain(`${field}: i.${field}`);
  });

  test("deletes only the client_ids the server confirmed", () => {
    expect(sw).toContain("confirmed.has(i.client_id)");
    // The old bug: clearing the store on a bare 200, discarding items the server skipped.
    expect(sw).not.toMatch(/for \(const i of items\) await tx\.store\.delete/);
  });

  test("rejects on a failed sync so the browser retries", () => {
    expect(sw).toMatch(/if \(!res\.ok\) throw/);
  });
});
