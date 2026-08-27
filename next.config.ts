import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        /*
         * Audio filenames are content hashes (`d5a0f63985a9e528.opus`), so a
         * file's bytes can never change under its own name -- editing a line of
         * content produces a new hash and a new file. That makes the clip
         * genuinely immutable and safe to cache forever.
         *
         * Worth setting explicitly: Next serves everything in `public/` as
         * `Cache-Control: public, max-age=0`, because in general those files
         * *can* change. Left at the default, every clip is revalidated on every
         * play -- a round trip per tap, on the slowest connection the product
         * is designed for, for bytes the browser already has.
         */
        source: "/audio/:path*.opus",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          /*
           * Without this the files go out as `application/octet-stream`, which
           * is not a lie a browser has to accept: some refuse to decode an
           * `<audio>` source they were not told is audio. The pipeline writes
           * Opus in an Ogg container (`content/audio-manifest.json` -> format),
           * and `audio/ogg` is the registered type for exactly that.
           */
          { key: "Content-Type", value: "audio/ogg; codecs=opus" },
        ],
      },
    ];
  },
};

export default nextConfig;
