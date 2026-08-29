"use client";

import { useRef, useState } from "react";
import { normalise } from "@/lib/session/grade";

/**
 * THROWAWAY. A spike, not a feature — see `docs/ROADMAP.md` #2.
 *
 * It answers one question nobody has published an answer to: how long does a
 * cheap Android phone take to recognise a four-second English sentence in the
 * browser, with no server? Under ~3 s the feature is worth building; over it,
 * the hours go to the listening library instead. Every number this page
 * reports feeds that decision and nothing else.
 *
 * Deliberately ugly, English-only, unstyled, and reachable without an account
 * (`/spike` is in `PUBLIC_PATHS`) so it can be opened on any borrowed phone.
 * The model is pulled from the Hugging Face CDN because that is what a spike
 * does; the real feature would self-host it behind the service worker.
 * Delete this route once the number is known.
 */

const MODEL = "onnx-community/moonshine-tiny-ONNX";
const TARGET = "I would like a coffee, please.";
const RECORD_MS = 4000;

type Asr = (audio: Float32Array) => Promise<{ text: string } | { text: string }[]>;

// A minimal SIMD module: (module (func (result v128) v128.const i32x4 0 0 0 0))
// If the engine refuses to validate it, the WASM build of the model will not
// load at all, and that is worth knowing before spending 28 MB finding out.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
  253, 15, 253, 98, 11,
]);

export default function AsrSpike() {
  const [log, setLog] = useState<string[]>([]);
  const [asr, setAsr] = useState<Asr | null>(null);
  const [busy, setBusy] = useState<"idle" | "loading" | "recording" | "recognising">("idle");
  const [result, setResult] = useState<Record<string, string | number | boolean>>({});
  const bytesRef = useRef<Map<string, number>>(new Map());

  const say = (line: string) => setLog((l) => [...l, line]);
  const note = (k: string, v: string | number | boolean) => setResult((r) => ({ ...r, [k]: v }));

  // Device facts. Gathered on the first tap rather than in an effect: the
  // compiler's purity rule rejects a synchronous setState in an effect, and a
  // lazy initialiser would render differently on the server. All of these
  // bear on whether the feature can ship at all, independent of speed.
  function probeDevice() {
    const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
    const simd = (() => {
      try {
        return WebAssembly.validate(SIMD_PROBE);
      } catch {
        return false;
      }
    })();
    setResult({
      ua: nav.userAgent,
      wasmSimd: simd,
      deviceMemoryGB: nav.deviceMemory ?? -1,
      cores: nav.hardwareConcurrency ?? -1,
      webgpu: "gpu" in nav,
    });
  }

  async function loadModel() {
    probeDevice();
    setBusy("loading");
    const t0 = performance.now();
    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.allowLocalModels = false;
      say(`loading ${MODEL} q8 on wasm…`);
      const pipe = await pipeline("automatic-speech-recognition", MODEL, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p) => {
          const info = p as { status: string; file?: string; total?: number; progress?: number };
          if (info.status === "progress" && info.file && info.total) {
            bytesRef.current.set(info.file, info.total);
          }
          if (info.status === "done" && info.file) say(`  ✓ ${info.file}`);
        },
      });
      const ms = Math.round(performance.now() - t0);
      const mb = [...bytesRef.current.values()].reduce((a, b) => a + b, 0) / 1e6;
      setAsr(() => pipe as unknown as Asr);
      note("loadMs", ms);
      note("downloadMB", Number(mb.toFixed(1)));
      say(`model ready in ${ms} ms (${mb.toFixed(1)} MB; second load should be near-instant from cache)`);
    } catch (e) {
      say(`LOAD FAILED: ${e instanceof Error ? e.message : String(e)}`);
      note("loadError", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  }

  async function recordAndRecognise() {
    if (!asr) return;
    setBusy("recording");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>((res) => (rec.onstop = () => res()));
      rec.start();
      say(`recording ${RECORD_MS / 1000}s — say: "${TARGET}"`);
      await new Promise((r) => setTimeout(r, RECORD_MS));
      rec.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());

      // The model wants 16 kHz mono float samples. Decoding through an
      // AudioContext at that rate resamples for free.
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      const ctx = new AudioContext({ sampleRate: 16000 });
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      const samples = decoded.getChannelData(0);
      await ctx.close();
      note("clipSeconds", Number(decoded.duration.toFixed(2)));

      setBusy("recognising");
      const t0 = performance.now();
      const out = await asr(samples);
      const ms = Math.round(performance.now() - t0);
      const text = (Array.isArray(out) ? out[0] : out).text.trim();
      const matched = normalise(text) === normalise(TARGET);

      note("recogniseMs", ms);
      note("transcript", text);
      note("matched", matched);
      note("realTimeFactor", Number((ms / 1000 / decoded.duration).toFixed(2)));
      say(`heard: "${text}" in ${ms} ms — ${matched ? "MATCH" : "no match"}`);
    } catch (e) {
      say(`RECOGNISE FAILED: ${e instanceof Error ? e.message : String(e)}`);
      note("recogniseError", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  }

  const report = JSON.stringify(result, null, 2);

  return (
    <main style={{ fontFamily: "monospace", padding: 16, maxWidth: 640 }}>
      <h1>ASR spike (throwaway)</h1>
      <p>
        Target: <b>{TARGET}</b>
      </p>
      <ol>
        <li>
          <button onClick={loadModel} disabled={busy !== "idle" || !!asr}>
            {asr ? "model loaded" : busy === "loading" ? "loading…" : "1. Load model (~28 MB)"}
          </button>
        </li>
        <li>
          <button onClick={recordAndRecognise} disabled={!asr || busy !== "idle"}>
            {busy === "recording"
              ? "recording…"
              : busy === "recognising"
                ? "recognising…"
                : "2. Record 4 s and recognise"}
          </button>
        </li>
        <li>
          <button onClick={() => navigator.clipboard?.writeText(report)}>3. Copy results</button>
        </li>
      </ol>
      <pre style={{ background: "#eee", padding: 8, whiteSpace: "pre-wrap" }}>{report}</pre>
      <pre style={{ whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </main>
  );
}
