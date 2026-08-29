# Images

Pictograms and portraits referenced from content (`docs/ROADMAP.md` #6):

- `chunks[].image` — a picture of a concrete referent
- `frames[].filler_images` — one per literal filler, keyed by the filler text
- `characters[].portrait` — six faces, one-time

Rules, all of which the validator enforces where it can:

- Paths are public: `/images/coffee.svg`. The file must exist here, or the
  validator fails — a broken-image glyph where meaning was promised is worse
  than no picture.
- **Pictograms, not photos.** One consistently styled set, one licence line.
  Mulberry and OpenMoji are CC BY-SA (copyleft — the same obligation as NGSL);
  ARASAAC is CC BY-**NC**-SA and needs a decision before use.
- **Never generated images of people**, and never a stock photo for anything
  touching supervisors, clinics or police.
- Do not illustrate what cannot be pictured. "I don't understand" has no
  picture and must not be given a mascot.

Nothing is here yet. The slots exist so the assets can be added as they are
chosen, without a schema change or a migration.
