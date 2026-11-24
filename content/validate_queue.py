"""Checks a Simpatico content queue CSV against RULES.md. Prints every failure; exit 1 if any.
   python3 content/validate_queue.py content/queue.csv"""
import csv, re, sys
COLS = "post_id,feature_id,angle_name,audience,format,hook,old_way,cost,mechanic,change,ask,caption,hashtags,voiceover_script,pose_1,pose_2,pose_3,pose_4,pose_5,ui_card,tiktok_hook,tiktok_caption,tiktok_sound".split(",")
LIMITS = {"hook": 9, "old_way": 9, "cost": 14, "mechanic": 14, "change": 14, "ask": 7, "tiktok_hook": 7}
ASKS = {"Try Simpatico free on iPhone.", "Send someone your call card.", "Link in bio. Talk to anyone."}
AUD = {"couples", "families", "travellers", "newcomers", "friends", "everyone"}
FMT = {"carousel", "still", "reel"}
UI = {"ui-call-captions", "ui-inperson-split", "ui-home-callbutton", "ui-call-card-share", "ui-group-captions", "ui-language-picker", "ui-transcript"}
POSES = set(re.findall(r"[a-z]+(?:-[a-z]+)+", open(__file__.replace("validate_queue.py", "RULES.md")).read().split("## Poses")[1]))
POSES -= {"partner-a", "partner-b"}
US = r"\b(color|colors|favorite|mom|moms|organize|realize|realized|traveling|traveler|center|program|neighbor|apologize|behavior)\b"
HYPE = r"\b(best|amazing|incredible|game-changer|game changer|revolutionary|unbelievable|insane)\b"
PLAIN = r"\b(tradie|tradies|sparky|sparkies|ute|arvo|mate|mates|footy|netball|heaps|reckon|nan|aunty|nene|dede|yiayia|lola|teta|baba|nonna|tita|saga|sagas|sorted|kettle|sunnybank|footscray|fitzroy|dandenong|bowen|kad[ıi]k[öo]y|collingwood|inala|fiumicino|simit|sarma|bayram)\b"
import os
feat = {r["feature_id"]: r["status"] for r in csv.DictReader(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "features.csv")))}
words = lambda s: len(s.split())
def check(path):
    bad = []
    rows = list(csv.DictReader(open(path, newline="")))
    if rows and list(rows[0].keys()) != COLS: bad.append(f"columns differ: {list(rows[0].keys())}")
    ids = set()
    for r in rows:
        p = r.get("post_id", "?")
        e = lambda m: bad.append(f"{p}: {m}")
        if not re.fullmatch(r"S\d{3}", p or ""): e("post_id must be S + 3 digits")
        if p in ids: e("duplicate post_id")
        ids.add(p)
        if feat.get(r["feature_id"]) != "shipped": e(f"feature {r['feature_id']} is not a shipped feature")
        if r["audience"] not in AUD: e(f"audience {r['audience']}")
        if r["format"] not in FMT: e(f"format {r['format']}")
        for k, n in LIMITS.items():
            if words(r[k]) > n: e(f"{k} has {words(r[k])} words (max {n})")
            if not r[k].strip(): e(f"{k} empty")
        if r["ask"] not in ASKS: e(f"ask not one of the three variants: {r['ask']}")
        if words(r["caption"]) > 60: e(f"caption {words(r['caption'])} words (max 60)")
        tags = r["hashtags"].split()
        if len(tags) != 5 or not all(re.fullmatch(r"#[A-Za-z0-9]+", t) for t in tags) or tags[-1].lower() != "#simpatico": e(f"hashtags must be 5 single words ending #simpatico: {r['hashtags']}")
        v = r["voiceover_script"]
        if not 25 <= words(v) <= 50: e(f"voiceover {words(v)} words (25 to 50)")
        if "?" in v: e("voiceover has a question mark")
        if re.search(HYPE, v, re.I): e("voiceover has a superlative")
        for i in range(1, 6):
            if r[f"pose_{i}"] not in POSES: e(f"pose_{i} {r[f'pose_{i}']} not in the pose list")
        if r["ui_card"] not in UI: e(f"ui_card {r['ui_card']}")
        tc = r["tiktok_caption"]
        if len(tc) > 150: e(f"tiktok_caption {len(tc)} chars (max 150)")
        tt = re.findall(r"#\w+", tc)
        if not 3 <= len(tt) <= 5 or "#simpatico" not in [t.lower() for t in tt]: e("tiktok_caption needs 3 to 5 hashtags incl #simpatico")
        if r["format"] == "carousel" and not r["tiktok_sound"].startswith("trending: "): e("carousel tiktok_sound must be 'trending: <mood>'")
        if r["format"] != "carousel" and r["tiktok_sound"] != "original voiceover": e("reel/still tiktok_sound must be 'original voiceover'")
        allt = " ".join(r[c] for c in COLS)
        if re.search("[–—]", allt): e("has an en or em dash")
        if re.search(US, allt, re.I): e(f"US spelling: {re.search(US, allt, re.I).group(0)}")
        if re.search("[\U0001F300-\U0001FAFF☀-➿]", allt): e("has an emoji")
        # Plain words: regional slang, borrowed family words and local place names, outside quoted slang examples.
        plain = re.sub(r"'[^']*'", "", " ".join(r[c] for c in ["hook", "old_way", "cost", "mechanic", "change", "caption", "voiceover_script", "tiktok_hook", "tiktok_caption"]).replace("\u2019", "'"))
        plain = re.sub(r"#\w+", "", plain)
        m = re.search(PLAIN, plain, re.I)
        if m: e(f"not plain English: {m.group(0)}")
        for k in ["hook", "old_way", "cost", "mechanic", "change"]:
            if not re.search(r"[.!?]['\"]?$", r[k].strip()): e(f"{k} is not a full sentence (no end stop)")
    return rows, bad
if __name__ == "__main__":
    total = 0
    for path in sys.argv[1:]:
        rows, bad = check(path)
        for b in bad: print(f"{path}: {b}")
        print(f"{path}: {len(rows)} posts, {len(bad)} problems")
        total += len(bad)
    sys.exit(1 if total else 0)
