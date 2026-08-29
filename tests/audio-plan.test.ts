import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  buildAudioPlan,
  clipHash,
  loadVoiceRoster,
  parseTranscriptLines,
} from "../lib/content/audio-plan";
import { loadContent, loadPronunciationOverrides, loadSpeakerRoster } from "../lib/content/load";

const bundle = loadContent();
const roster = loadVoiceRoster();
const speakers = loadSpeakerRoster();
const plan = buildAudioPlan(bundle, roster);

describe("clip hashing", () => {
  test("is stable for identical input", () => {
    assert.equal(clipHash("Hello", "us_f_1", "macos"), clipHash("Hello", "us_f_1", "macos"));
  });

  test("changes when text, voice, or provider changes", () => {
    const base = clipHash("Hello", "us_f_1", "macos");
    assert.notEqual(base, clipHash("Hello there", "us_f_1", "macos"));
    assert.notEqual(base, clipHash("Hello", "us_m_1", "macos"));
    assert.notEqual(base, clipHash("Hello", "us_f_1", "piper"));
    // The effective length_scale changes the bytes; leaving it out of the
    // hash made every clip look cached after a roster edit.
    assert.notEqual(clipHash("Hello", "us_f_1", "piper", 0.85), clipHash("Hello", "us_f_1", "piper", 1.25));
    // But float noise must not: the same scale to three decimals is the same clip.
    assert.equal(clipHash("Hello", "us_f_1", "piper", 0.85), clipHash("Hello", "us_f_1", "piper", 0.8501));
  });

  test("ignores surrounding whitespace so reflowing YAML costs nothing", () => {
    assert.equal(clipHash("Hello", "us_f_1", "piper"), clipHash("  Hello\n", "us_f_1", "piper"));
  });
});

describe("transcript parsing", () => {
  test("splits speaker tags from lines and normalises them to character ids", () => {
    assert.deepEqual(parseTranscriptLines("ANA: Hello.\nMIGUEL: Hi there.\n"), [
      { speaker: "ana", text: "Hello." },
      { speaker: "miguel", text: "Hi there." },
    ]);
  });

  test("skips blank lines", () => {
    assert.equal(parseTranscriptLines("ANA: Hello.\n\n\nMIGUEL: Hi.").length, 2);
  });
});

describe("the cast (PRD 4.3)", () => {
  test("every character has a distinct voice", () => {
    const voices = [...bundle.cast.values()].map((c) => c.voice);
    assert.equal(new Set(voices).size, voices.length, "two characters share a voice");
  });

  test("a character keeps one voice across every scene they appear in", () => {
    const heard = new Map<string, Set<string>>();
    for (const scene of plan.scenes) {
      for (const line of scene.lines) {
        const clip = plan.clips.find((c) => c.hash === line.clipHash)!;
        if (!heard.has(line.character)) heard.set(line.character, new Set());
        heard.get(line.character)!.add(clip.voiceId);
      }
    }
    for (const [character, voices] of heard) {
      assert.equal(
        voices.size,
        1,
        `${character} is voiced by ${voices.size} different voices across the track`
      );
      assert.equal([...voices][0], bundle.cast.get(character)!.voice);
    }
  });

  test("every scene speaker is a real cast member -- no anonymous walk-ons", () => {
    for (const scene of plan.scenes) {
      for (const line of scene.lines) {
        assert.ok(bundle.cast.has(line.character), `${scene.sceneId}: unknown speaker "${line.character}"`);
      }
    }
  });

  test("a scene with an uncast speaker is rejected, not silently voiced", () => {
    const broken = structuredClone(bundle);
    broken.units[0].scenes[0].transcript = "ANA: Hello.\nSTRANGER: Hello.";
    assert.throws(() => buildAudioPlan(broken, roster), /not in the cast/);
  });
});

describe("pronunciation overrides (PRD 8.1A)", () => {
  const spell = loadPronunciationOverrides();

  test("substitutes whole words only, for synthesis only", () => {
    const said = spell("Hello, Miguel.", "macos");
    assert.notEqual(said, "Hello, Miguel.");
    assert.match(said, /Hello, /);
  });

  test("leaves words with no override exactly as written", () => {
    assert.equal(spell("Nice to meet you.", "macos"), "Nice to meet you.");
  });

  test("a clip records both what is read and what is said", () => {
    for (const clip of plan.clips) {
      assert.ok(clip.text.length > 0);
      assert.ok(clip.synthText.length > 0);
    }
    // The learner always sees the real spelling; only the engine gets the respelling.
    const miguelClips = plan.clips.filter((c) => /Miguel/.test(c.text));
    assert.ok(miguelClips.length > 0, "no clip mentions Miguel -- the fixture moved");
    assert.ok(miguelClips.every((c) => !/Miguel/.test(c.synthText.replace(/Mig-ELL/g, ""))));
  });

  test("changing what the engine says changes the cache key", () => {
    assert.notEqual(clipHash("Miguel", "us_f_1", "macos"), clipHash("Mig-ELL", "us_f_1", "macos"));
  });
});

describe("audio plan", () => {
  test("every chunk gets at least two distinct voices (PRD F2)", () => {
    for (const unit of bundle.units) {
      for (const chunk of unit.chunks) {
        const voices = new Set(
          plan.clips.filter((c) => c.kind === "chunk" && c.ownerId === chunk.id).map((c) => c.voiceId)
        );
        assert.ok(voices.size >= 2, `${chunk.id} has ${voices.size} voice(s)`);
      }
    }
  });

  test("every chunk gets an example clip", () => {
    for (const unit of bundle.units) {
      for (const chunk of unit.chunks) {
        assert.ok(
          plan.clips.some((c) => c.kind === "example" && c.ownerId === chunk.id),
          `${chunk.id} has no example clip`
        );
      }
    }
  });

  test("ear training is never in the synthesis plan (PRD 8.1B)", () => {
    // The mechanism HVPT depends on is genuine acoustic variation between
    // talkers. Six TTS voices look like six speakers and do not behave like
    // them, so a synthesised minimal-pair clip is not a shortcut -- it is a
    // different, weaker exercise wearing the same UI.
    const kinds = new Set(plan.clips.map((c) => c.kind));
    assert.ok(!kinds.has("hvpt" as never), "the plan wants to synthesise ear-training audio");
    assert.equal(roster.roles.hvpt, undefined, "voices.yaml defines an hvpt role");
  });

  test("every minimal pair word is planned for every human speaker (PRD F3)", () => {
    assert.ok(speakers.min_speakers_per_contrast >= 4);
    for (const set of bundle.contrasts.values()) {
      assert.ok(
        set.speakers.length >= speakers.min_speakers_per_contrast,
        `${set.contrast} has ${set.speakers.length} speakers`
      );
      for (const pair of set.pairs) {
        const planned = plan.recordings.filter((r) => r.pairId === pair.id);
        // Both sides of the pair, from every speaker: enough distinct talkers
        // that the drill can avoid repeating a speaker on consecutive items.
        assert.equal(planned.length, set.speakers.length * 2, `${pair.id} plans ${planned.length} recordings`);
        assert.equal(new Set(planned.map((r) => r.speakerId)).size, set.speakers.length);
      }
    }
  });

  test("a recording that has not been made is reported, not faked", () => {
    for (const rec of plan.recordings) {
      assert.equal(rec.present, false, "fixtures unexpectedly have recordings on disk");
      assert.match(rec.sourceFile, /content\/recordings\//);
    }
  });

  test("distinct scene speakers get distinct voices", () => {
    for (const scene of plan.scenes) {
      const byCharacter = new Map<string, Set<string>>();
      for (const line of scene.lines) {
        const clip = plan.clips.find((c) => c.hash === line.clipHash)!;
        if (!byCharacter.has(line.character)) byCharacter.set(line.character, new Set());
        byCharacter.get(line.character)!.add(clip.voiceId);
      }
      // one voice per character...
      for (const [character, voices] of byCharacter) {
        assert.equal(voices.size, 1, `${scene.sceneId} speaker ${character} drifts between voices`);
      }
      // ...and no two characters sharing one.
      const used = [...byCharacter.values()].map((v) => [...v][0]);
      assert.equal(new Set(used).size, used.length, `${scene.sceneId} gives two characters the same voice`);
    }
  });

  test("identical text in the same voice is generated once", () => {
    const hashes = plan.clips.map((c) => c.hash);
    assert.equal(new Set(hashes).size, hashes.length, "plan contains duplicate clips");
    // "Nice to meet you" recurs across scenes; it should collapse to one file.
    const niceToMeet = plan.clips.filter((c) => c.text === "Nice to meet you.");
    const voices = niceToMeet.map((c) => c.voiceId);
    assert.equal(new Set(voices).size, voices.length);
  });

  test("every role in voices.yaml resolves to a real voice", () => {
    const ids = new Set(roster.voices.map((v) => v.id));
    for (const [role, members] of Object.entries(roster.roles)) {
      for (const id of members) assert.ok(ids.has(id), `role ${role} references unknown voice ${id}`);
    }
  });

  test("the ear-training roster includes non-native speakers (PRD 4.4)", () => {
    // Not a gesture: the accent most likely to be on the other end of a work
    // phone call is not General American, and a drill trained only on native
    // talkers does not prepare anyone for that.
    assert.ok(speakers.speakers.some((s) => !s.native));
  });

  test("every speaker a contrast set names exists on the roster", () => {
    const ids = new Set(speakers.speakers.map((s) => s.id));
    for (const set of bundle.contrasts.values()) {
      for (const id of set.speakers) assert.ok(ids.has(id), `${set.contrast} references unknown speaker ${id}`);
    }
  });

  test("no clip is generated for a voice the engine does not have", () => {
    const ids = new Set(roster.voices.map((v) => v.id));
    for (const clip of plan.clips) assert.ok(ids.has(clip.voiceId), `unknown voice ${clip.voiceId}`);
  });
});
