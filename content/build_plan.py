"""Builds the 30-day posting plans for Instagram and TikTok from the queue and the shoot list.
   python3 content/build_plan.py
Rules (same as the Pindar system, plus TikTok):
- Weekly themes, each with its pool of features; the three Instagram slots rotate through the pool.
- The sharpest angle (slang-idioms) is pinned once in weeks 1 to 3 (days 3, 10, 17) and every day of week 4.
- No feature twice on the same day; a week short of a format borrows the next unused post of it.
- One filmed episode a day, by series rhythm (Mon street, Tue Max and Ezgi, Wed street, Thu Can it translate,
  Fri street, Sat Call home, Sun Building Simpatico); unused episodes and posts are the backlog.
- TikTok: three a day (filmed episode morning, photo-mode carousel midday, reel evening).
"""
import csv, os
D = os.path.dirname(os.path.abspath(__file__))
queue = []
for w in (1, 2, 3, 4):
    p = os.path.join(D, f"queue_w{w}.csv")
    if os.path.exists(p): queue += [dict(r, week=w) for r in csv.DictReader(open(p, newline=""))]
shoot = list(csv.DictReader(open(os.path.join(D, "shoot_list.csv"), newline=""))) if os.path.exists(os.path.join(D, "shoot_list.csv")) else []
THEMES = {1: "Week 1: talk to anyone", 2: "Week 2: face to face", 3: "Week 3: family and love across languages", 4: "Week 4: it gets how people really talk"}
SHARP = "slang-idioms"
days = {d: (1 if d <= 7 else 2 if d <= 14 else 3 if d <= 21 else 4) for d in range(1, 31)}
used = set()
def take(fmt, week, today, prefer=None):
    pools = [q for q in queue if q["week"] == week] + [q for q in queue if q["week"] != week]
    for q in pools:
        if q["post_id"] in used or q["format"] != fmt: continue
        if prefer and q["feature_id"] != prefer: continue
        if not prefer and (q["feature_id"] in today or q["feature_id"] == SHARP): continue  # the sharpest angle only in its pinned slot
        used.add(q["post_id"]); return q
    return None
ig, tt = [], []
SLOTS = [("morning", "carousel"), ("midday", "still"), ("evening", "reel")]
for d in range(1, 31):
    w = days[d]; today = set()
    pin = d in (3, 10, 17) or w == 4
    pin_slot = (d % 3) if pin else None
    for i, (slot, fmt) in enumerate(SLOTS):
        q = take(fmt, w, today, SHARP if pin_slot == i else None) or take(fmt, w, today)
        if not q: continue
        today.add(q["feature_id"])
        ig.append({"day": d, "week": THEMES[w], "slot": slot, "format": fmt, "post_id": q["post_id"], "feature_id": q["feature_id"], "audience": q["audience"], "hook": q["hook"]})
# Filmed episodes by series rhythm.
RHYTHM = ["I don't speak your language", "Max and Ezgi", "I don't speak your language", "Can it translate this?", "I don't speak your language", "Call home", "Building Simpatico"]
eps_used = set()
def episode(series):
    for e in shoot:
        if e["episode_id"] not in eps_used and e["series"] == series: eps_used.add(e["episode_id"]); return e
    for e in shoot:
        if e["episode_id"] not in eps_used and e["series"] == "I don't speak your language": eps_used.add(e["episode_id"]); return e
    return None
films = {}
for d in range(1, 31):
    e = episode(RHYTHM[(d - 1) % 7])
    if e:
        films[d] = e
        ig.append({"day": d, "week": THEMES[days[d]], "slot": "trial reel (filmed)", "format": "filmed", "post_id": e["episode_id"], "feature_id": "in-person", "audience": "everyone", "hook": e["hook_first_frame"]})
ig.sort(key=lambda r: (r["day"], ["morning", "midday", "evening", "trial reel (filmed)"].index(r["slot"])))
byid = {q["post_id"]: q for q in queue}
for d in range(1, 31):
    e = films.get(d)
    if e: tt.append({"day": d, "week": THEMES[days[d]], "time": "7:30 am", "format": "filmed video", "post_id": e["episode_id"], "length_s": e["length_tiktok_s"], "on_screen_hook": e["hook_first_frame"], "caption": e["tiktok_caption"], "sound": "original audio"})
    for r in ig:
        if r["day"] != d or r["format"] not in ("carousel", "reel"): continue
        q = byid[r["post_id"]]
        tt.append({"day": d, "week": THEMES[days[d]], "time": "12:30 pm" if r["format"] == "carousel" else "7:00 pm", "format": "photo carousel" if r["format"] == "carousel" else "video", "post_id": q["post_id"], "length_s": "" if r["format"] == "carousel" else "15-25", "on_screen_hook": q["tiktok_hook"], "caption": q["tiktok_caption"], "sound": q["tiktok_sound"]})
def write(name, rows):
    with open(os.path.join(D, name), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
write("posting_plan_instagram.csv", ig)
write("posting_plan_tiktok.csv", tt)
backlog = [{"post_id": q["post_id"], "format": q["format"], "feature_id": q["feature_id"], "audience": q["audience"], "hook": q["hook"]} for q in queue if q["post_id"] not in used]
backlog += [{"post_id": e["episode_id"], "format": "filmed", "feature_id": e["series"], "audience": "everyone", "hook": e["hook_first_frame"]} for e in shoot if e["episode_id"] not in eps_used]
if backlog: write("backlog.csv", backlog)
# One file with every post, for the renderer and the posting app.
if queue:
    with open(os.path.join(D, "queue.csv"), "w", newline="") as f:
        cols = [c for c in queue[0].keys() if c != "week"]
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader(); w.writerows(queue)
print(f"queue {len(queue)} posts, shoot list {len(shoot)} episodes; instagram {len(ig)} scheduled, tiktok {len(tt)} scheduled, backlog {len(backlog)}")
sharp = sum(1 for r in ig if r["feature_id"] == SHARP)
print(f"sharpest angle ({SHARP}) scheduled {sharp} times on Instagram")
