import assert from "node:assert/strict";
import { test, describe } from "node:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p: string) => fs.existsSync(path.join(ROOT, p));

/**
 * What the learner sees when our side is broken.
 *
 * These are structural assertions, not behaviour — the behaviour was verified
 * by pointing a production build at an unreachable project and reading what
 * came back. What this file defends is that the pieces stay wired, because
 * every one of them is invisible until the day it matters and silently
 * removable on any other.
 */

describe("error boundaries exist at all", () => {
  test("a thrown error does not render Next's English default", () => {
    // Before these existed, any exception produced "Application error: a
    // server-side exception has occurred" — in English, to a learner who reads
    // Spanish, on a product whose own test is "would a nervous 19-year-old quit
    // at this screen?"
    assert.ok(exists("app/error.tsx"), "no app/error.tsx");
    assert.ok(exists("app/global-error.tsx"), "no app/global-error.tsx");
  });

  test("both are client components, as error boundaries must be", () => {
    for (const file of ["app/error.tsx", "app/global-error.tsx"]) {
      assert.match(read(file), /^"use client"/, `${file} is not a client component`);
    }
  });

  test("global-error carries its own document and styles", () => {
    // It replaces the root layout when it renders, so it gets no globals.css.
    // A Tailwind class here would silently do nothing and the page would render
    // unstyled — a worse failure than the one it is reporting.
    const src = read("app/global-error.tsx");
    assert.match(src, /<html/, "global-error must supply its own <html>");
    assert.match(src, /<body/, "global-error must supply its own <body>");
    assert.match(src, /<style>/, "global-error has no inline styles and gets no stylesheet");
  });

  test("nothing shown to the learner is in English or exposes a stack trace", () => {
    for (const file of ["app/error.tsx", "app/global-error.tsx", "app/pausa/page.tsx"]) {
      const src = read(file);
      assert.match(src, /es\.trouble\./, `${file} does not use the Spanish copy`);
      assert.ok(!/error\.message/.test(src), `${file} renders a raw error message`);
      assert.ok(!/error\.stack/.test(src), `${file} renders a stack trace`);
    }
  });
});

describe("an unreachable backend is not mistaken for being signed out", () => {
  test("the proxy distinguishes the two", () => {
    // `getUser()` returns null both when there is no session and when the auth
    // server cannot be reached. Treating those the same is what made a dead
    // database present as "you are logged out" — the learner was redirected to
    // a login that could not succeed, with no explanation anywhere.
    const src = read("proxy.ts");
    assert.match(src, /isUnreachable/, "the proxy no longer probes reachability");
    assert.match(src, /\/pausa/, "the proxy no longer routes to the offline page");
  });

  test("the offline page is reachable without an account", () => {
    // Left out of PUBLIC_PATHS it would redirect to /login, which is the exact
    // loop it exists to break.
    assert.match(read("proxy.ts"), /"\/pausa"/, "/pausa is not public");
    assert.ok(exists("app/pausa/page.tsx"), "no offline page");
  });

  test("the probe is bounded, so nobody watches a blank screen", () => {
    // An unreachable host takes ~7s to fail on DNS alone.
    assert.match(read("proxy.ts"), /abortSignal\(AbortSignal\.timeout\(\d+\)\)/);
  });
});

describe("the keepalive can actually fail", () => {
  test("the health route exists and is public", () => {
    assert.ok(exists("app/api/health/route.ts"), "no health route");
    // Not public, it 307s to /login — and a redirect is not an HTTP failure, so
    // the workflow would report green forever while pinging a login page. That
    // happened; this is the regression test for it.
    assert.match(read("proxy.ts"), /"\/api\/health"/, "/api/health is not public");
  });

  test("it reports a broken database as an error status, not a cheerful 200", () => {
    const src = read("app/api/health/route.ts");
    assert.match(src, /status:\s*503/, "health never returns a failure status");
    assert.match(src, /force-dynamic/, "a cached health check answers about the past");
  });

  test("the workflow fails the run when the endpoint does", () => {
    const wf = read(".github/workflows/keepalive.yml");
    assert.match(wf, /--fail-with-body/, "curl would swallow a 503");
    assert.match(wf, /schedule:/, "the keepalive is not scheduled");
    assert.match(wf, /api\/health/, "the workflow does not hit the health route");
  });

  test("it does not live on the platform it is meant to outlive", () => {
    // On GitHub Actions deliberately: a Vercel-hosted cron would be throttled
    // by the same event it exists to survive.
    assert.ok(!exists("vercel.json") || !/crons/.test(read("vercel.json")));
  });
});
