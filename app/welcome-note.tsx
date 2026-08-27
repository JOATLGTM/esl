"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { es } from "@/lib/copy/es";

/**
 * A note from the author, shown once on a visitor's first page of the app.
 *
 * Remembered in `localStorage`, which is per-browser: this is a message, not
 * learner data, and putting it in a column would mean a schema change to store
 * one boolean about one person. The cost is that he would see it again on a
 * second device, which for a note read once is the right trade.
 *
 * A real `<dialog>` rather than a styled div. `showModal()` gives focus
 * trapping, Escape-to-close, an inert background and a `::backdrop` for free,
 * and all four are things a hand-rolled modal usually gets wrong.
 */
const STORAGE_KEY = "hablar:welcome-seen";

/* -------------------------------------------------------------------------- */
/* localStorage as an external store                                          */
/* -------------------------------------------------------------------------- */
/*
 * `useSyncExternalStore` rather than "read it in an effect and setState":
 * localStorage is exactly the external store this hook exists for, and reading
 * it into state during an effect is both a cascading render (which the React
 * Compiler's lint rejects) and a flash of the note at someone who already
 * dismissed it.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Dismissing it in one tab dismisses it in the others.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readSeen(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing and blocked site data both throw on access. Showing the
    // note again is a far better failure than crashing the page around it.
    return null;
  }
}

/**
 * The server has no `localStorage`, so it renders as though the note were
 * already seen. Nothing is sent in the HTML, there is no hydration mismatch,
 * and the note appears only once the client has actually checked.
 */
function readSeenOnServer(): string {
  return "server";
}

function markSeen() {
  try {
    // A timestamp rather than a flag: it costs the same and says when.
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // See `readSeen`. The dialog still closes for this visit -- that is what
    // `dismissed` below is for.
  }
  for (const listener of listeners) listener();
}

export function WelcomeNote() {
  const dialog = useRef<HTMLDialogElement>(null);
  const messageId = useId();
  const seen = useSyncExternalStore(subscribe, readSeen, readSeenOnServer);

  // Belt to the braces above: if the write threw, `seen` never changes, and
  // without this the note would reopen on every re-render of the page.
  const [dismissed, setDismissed] = useState(false);
  const open = seen === null && !dismissed;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();

    // Bound natively rather than with an `onClose` prop. `close` does not
    // bubble and React does not attach a direct listener for it, so `onClose`
    // is accepted, type-checks, and silently never fires -- which loses the
    // dismissal for both the button and Escape. Verified in a browser, not
    // assumed: `dialog.close()` ran, the note reopened on the next load.
    const remember = () => {
      markSeen();
      setDismissed(true);
    };
    el.addEventListener("close", remember);
    return () => el.removeEventListener("close", remember);
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={messageId}
      // Not `backdrop:bg-ink/50`: `ink` is the *text* colour, which is near-white
      // in dark mode -- it would brighten the page instead of dimming it. A
      // backdrop has to darken in both themes, so it is a literal black.
      className="m-auto w-[min(28rem,calc(100vw-2.5rem))] rounded-3xl border-2 border-line bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-6 p-6">
        <p id={messageId} className="text-lg leading-relaxed text-ink">
          {es.welcome}
        </p>
        <Button type="button" onClick={() => dialog.current?.close()} autoFocus>
          {es.common.close}
        </Button>
      </div>
    </dialog>
  );
}
