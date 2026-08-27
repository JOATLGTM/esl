# Recording script — /iː/ vs /ɪ/ (sheep / ship)

**Speaker:** `hs_03` · UK (Southern British)
**Words:** 50 · **Time:** about 15 minutes · **Kit:** your phone, a quiet room

Thank you for doing this. These recordings are how people learning English train
their ear to hear the difference between `sheep` and `ship`.
It only works if lots of different people read the same words, so your voice is
the point — please read normally, in your own accent. Do not perform, do not
slow down, and do not try to sound like anyone else.

## How to record

1. Somewhere quiet. No music, no fan, no traffic. A soft room beats a big one.
2. Hold the phone about a hand's width from your mouth, slightly off to the side
   so you are not breathing straight into it.
3. Record **one continuous take** of the whole list.
4. Say each word **once**, clearly, then pause for about a second before the next.
   The pause matters — it is how the file gets split up afterwards.
5. If you fluff a word, just pause, say it again, and keep going. We will trim it.
6. Read the number too if it helps you keep your place; the numbers get cut.

## What happens to it

The take is split into one short file per word and used inside the app as
listening practice. Nothing else. Your name is not attached to it and no clip is
longer than the single word you said.

**Before recording, someone needs your consent on file.** Reply to whoever asked
you with: *"I agree that my recordings can be used in this app."* Until then the
build refuses to ship your clips, which is the intended behaviour.

## The words

  1.  **sheep**
  2.  **ship**
  3.  **seat**
  4.  **sit**
  5.  **feel**
  6.  **fill**
  7.  **heat**
  8.  **hit**
  9.  **leave**
 10.  **live**
 11.  **beat**
 12.  **bit**
 13.  **peak**
 14.  **pick**
 15.  **green**
 16.  **grin**
 17.  **cheap**
 18.  **chip**
 19.  **deed**
 20.  **did**
 21.  **eat**
 22.  **it**
 23.  **each**
 24.  **itch**
 25.  **feet**
 26.  **fit**
 27.  **least**
 28.  **list**
 29.  **meal**
 30.  **mill**
 31.  **neat**
 32.  **knit**
 33.  **reach**
 34.  **rich**
 35.  **seek**
 36.  **sick**
 37.  **sleep**
 38.  **slip**
 39.  **steal**
 40.  **still**
 41.  **wheel**
 42.  **will**
 43.  **bean**
 44.  **bin**
 45.  **cheek**
 46.  **chick**
 47.  **heel**
 48.  **hill**
 49.  **bead**
 50.  **bid**

---

## For whoever ingests this (not the speaker)

1. Split the take one word per file. In Audacity: **Analyze > Label Sounds**
   (Threshold −30 dB, minimum silence 0.4 s), check the labels line up, then
   **File > Export > Export Multiple**, split on labels.
2. Name each file after the word, lowercase: `sheep.wav`, `ship.wav`.
3. Put them in `content/recordings/ee_ih/hs_03/`.
4. Set `status: recorded` and `consent: on_file` for `hs_03` in
   `content/speakers.yaml`.
5. `npm run content:audio` — the clips are transcoded and registered. Then
   `npm run content:validate` will stop nagging about this speaker.
