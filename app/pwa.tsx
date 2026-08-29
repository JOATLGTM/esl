"use client";

import { useEffect, useState } from "react";
import { es, fill } from "@/lib/copy/es";

/** Registers the service worker once. Silent on failure: nothing depends on it. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

/**
 * "Save this unit": hands the unit's audio to the service worker so it is
 * there without a network, and says how many landed. Offered, never
 * automatic -- ~3 MB is real money on the archetype's data plan, and the
 * decision to spend it on wifi is his.
 */
export function OfflineUnit({ urls }: { urls: string[] }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "unsupported">("idle");
  const [saved, setSaved] = useState(0);

  async function save() {
    if (!("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    setState("saving");
    const reg = await navigator.serviceWorker.ready;
    const sw = reg.active;
    if (!sw) {
      setState("unsupported");
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => {
      setSaved(e.data?.done ?? 0);
      setState("done");
    };
    sw.postMessage({ type: "precache", urls }, [channel.port2]);
  }

  if (urls.length === 0) return null;

  return (
    <button
      type="button"
      onClick={save}
      disabled={state === "saving" || state === "done"}
      className="min-h-11 text-base font-medium text-muted underline underline-offset-4 disabled:no-underline"
    >
      {state === "idle" && es.offline.save}
      {state === "saving" && es.offline.saving}
      {state === "done" && fill(es.offline.saved, { count: saved })}
      {state === "unsupported" && es.offline.unsupported}
    </button>
  );
}
