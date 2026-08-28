"use client";

import { es } from "@/lib/copy/es";

/**
 * The last resort: an error in the root layout itself.
 *
 * `global-error` replaces the root layout when it renders, which has two
 * consequences the docs are explicit about and that are easy to miss:
 *
 *   1. it must supply its own `<html>` and `<body>`;
 *   2. **it does not get `globals.css`**, so every Tailwind class and every
 *      colour token in this file would silently do nothing.
 *
 * Hence the inline styles and the hand-written media query. They are not a
 * style regression -- they are the only thing that works here, and a page that
 * renders unstyled white-on-white is a worse failure than the one it is
 * reporting. The palette is copied from `app/globals.css`; if that changes,
 * this drifts, which is the accepted cost of the file existing at all.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <head>
        <title>{es.trouble.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          :root { color-scheme: light dark; }
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            background: #fdfbf7;
            color: #1c1917;
          }
          main { max-width: 28rem; display: flex; flex-direction: column; gap: 1rem; }
          h1 { font-size: 1.75rem; line-height: 1.2; margin: 0; }
          p { font-size: 1.05rem; line-height: 1.5; margin: 0; color: #57534e; }
          a {
            display: inline-flex; align-items: center; justify-content: center;
            min-height: 3.5rem; padding: 0 1.5rem; border-radius: 9999px;
            background: #a6360f; color: #fff; font-weight: 600; font-size: 1.05rem;
            text-decoration: none; border: none; cursor: pointer;
          }
          button { font: inherit; }
          @media (prefers-color-scheme: dark) {
            body { background: #15120f; color: #f5f0e8; }
            p { color: #b8afa4; }
            a { background: #fb923c; color: #15120f; }
          }
        `}</style>
      </head>
      <body>
        <main>
          <h1>{es.trouble.title}</h1>
          <p>{es.trouble.body}</p>
          {/* An anchor styled as the button, because this document has no app
              chrome to borrow and `retry()` is the only action worth offering. */}
          <a role="button" tabIndex={0} onClick={() => retry()}>
            {es.trouble.retry}
          </a>
        </main>
      </body>
    </html>
  );
}
