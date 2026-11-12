// Phrasebook matching and saved-name hints. Run: npx tsx test/phrasebook.test.ts
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "pb-"));
const { phrasebookTag, phrasesIn } = await import("../server/phrasebook");
const { namesTag } = await import("../server/refine");

const said = (t: string, l = "en") => phrasesIn(t, l).map((p) => p.phrase);
assert.deepEqual(said("Honestly this flat ticks all the boxes for us"), ["tick all the boxes"]);
assert.deepEqual(said("Don't worry mate, you'll pull through, you always do"), ["you'll pull through"]);
assert.deepEqual(said("She'll be right, no worries").sort(), ["no worries", "she'll be right"]);
assert.deepEqual(said("How are you going mate"), ["how ya going"], "either wording matches");
assert.deepEqual(said("I put the box on the table"), [], "ordinary sentences don't match");
assert.deepEqual(said("İçim rahatladı valla", "tr-TR"), ["içim rahatladı"]);
const tag = phrasebookTag("this ticks all the boxes", "en-AU", "tr");
assert.match(tag, /people say: "tam aradığım gibi/);
console.log("✓ phrasebook: phrases just said are found (any inflection), ordinary sentences aren't");

const hint = namesTag(["Max", "Ezgi"], "did you feed Mia, I'll tell es ky later", "Max", ["Mia", "Kadıköy"]);
assert.match(hint, /<their_names_and_words>Mia, Kadıköy<\/their_names_and_words>/);
assert.match(hint, /"es ky" may be Ezgi/);
console.log("✓ saved names and words go to the translator; a name heard as two words is flagged");
console.log("\nPHRASEBOOK TESTS PASSED");
