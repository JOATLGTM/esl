import type { MetadataRoute } from "next";
import { es } from "@/lib/copy/es";

/**
 * The web app manifest (`docs/ROADMAP.md` #10). Add-to-home-screen makes it
 * open like an app, which for a nervous learner is the difference between a
 * thing he has and a website he once visited.
 *
 * `start_url` is `/home`, not `/`: the landing page redirects a signed-in
 * learner there anyway, and an installed app should open on the button.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: es.app.name,
    short_name: es.app.name,
    description: es.app.description,
    start_url: "/home",
    display: "standalone",
    lang: "es",
    background_color: "#fdfbf7",
    theme_color: "#fdfbf7",
    icons: [
      // One SVG, any size. Chrome on Android accepts SVG manifest icons; a
      // PNG pair (192 / 512, maskable) is the follow-up for older devices.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
