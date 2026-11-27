// The joining of a call's lines across a reload: nothing twice, nothing lost, in time order.
import assert from "node:assert/strict";
import { mergeLines, type SavedLine } from "../lib/saved";

const l = (at: number, who: "me" | "them", said: string, read?: string): SavedLine => ({ at, who, said, read });
const before = [l(1000, "me", "Hello", "Merhaba"), l(2000, "them", "Nasılsın", "How are you")];
const since = [l(2000, "them", "Nasılsın", "How are you?"), l(3000, "me", "Good", "İyi")];
const merged = mergeLines(before, since);
assert.equal(merged.length, 3, "a line present on both sides appears once");
assert.deepEqual(merged.map((x) => x.at), [1000, 2000, 3000], "in time order");
assert.equal(merged[1].read, "How are you?", "the newer version of a line wins");
assert.equal(mergeLines([], since).length, 2);
assert.equal(mergeLines(before, []).length, 2, "lines from before the reload survive when nothing new has arrived yet");
// Two people speaking in the same millisecond are both kept.
assert.equal(mergeLines([l(5000, "me", "a")], [l(5000, "them", "b")]).length, 2);
console.log("✓ a reloaded call keeps its earlier lines: nothing twice, nothing lost");
