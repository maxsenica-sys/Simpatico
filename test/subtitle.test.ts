// The model sometimes "thinks out loud" in the reply; only the subtitle may reach the screen.
import assert from "node:assert/strict";
import { subtitleOnly } from "../server/refine";

assert.equal(
  subtitleOnly(`"Oh come on, Cimbom won again, it was a legendary match, I swear" — no, "oha" is an exclamation of surprise, "yok artık" is "no way", "Cimbom" is Galatasaray's nickname, so: "No way, Cimbom won again, what a legendary game, I swear."`),
  "No way, Cimbom won again, what a legendary game, I swear.",
);
assert.equal(subtitleOnly(`"kanka" is slang for mate, so the subtitle is "Mate, hang on"`), "Mate, hang on");
assert.equal(subtitleOnly(`Wait, the target is English.\nMate, hang on a sec`), "Mate, hang on a sec");
for (const ok of [`She said "no way" and left`, `"Ripper," he said, "she'll be right"`, `No way, Cimbom won again!`, `Kanka, "efsane" bir maçtı`, `"Babe, I miss you"`])
  assert.equal(subtitleOnly(ok), ok === `"Babe, I miss you"` ? "Babe, I miss you" : ok);
console.log("✓ self-talk is stripped; normal quotes are kept");
console.log("\nSUBTITLE TESTS PASSED");
