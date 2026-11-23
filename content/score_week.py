"""Ranks posts and angles from performance_log.csv (fill one row per post, 3 days after posting).
   python3 content/score_week.py
Winning post = top 20% of the last 30 posts on that platform by share rate ((shares + saves + IG sends)
per 1,000 views), with completion at or above that platform's median. Dead angle = an angle whose
posts all sat in the bottom 30% twice. Winners are re-queued as trial reels; dead angles are dropped."""
import csv, os, statistics
D = os.path.dirname(os.path.abspath(__file__))
rows = [r for r in csv.DictReader(open(os.path.join(D, "performance_log.csv"))) if r.get("views")]
queue = {r["post_id"]: r for r in csv.DictReader(open(os.path.join(D, "queue.csv")))} if os.path.exists(os.path.join(D, "queue.csv")) else {}
num = lambda v: float(v or 0)
for platform in sorted({r["platform"] for r in rows}):
    rs = [r for r in rows if r["platform"] == platform][-30:]
    for r in rs: r["rate"] = (num(r["shares"]) + num(r["saves"]) + num(r["ig_sends"])) * 1000 / max(1, num(r["views"]))
    med = statistics.median([num(r["completion_pct"]) for r in rs]) if rs else 0
    rs.sort(key=lambda r: -r["rate"])
    top = rs[: max(1, len(rs) // 5)]
    print(f"\n{platform}: {len(rs)} posts, median completion {med:.0f}%")
    for r in top:
        if num(r["completion_pct"]) >= med: print(f"  WINNER {r['post_id']} {r['rate']:.1f} per 1k  {r['hook']}  (angle: {queue.get(r['post_id'], {}).get('angle_name', '?')})")
    for r in rs[-max(1, len(rs) * 3 // 10):]: print(f"  low    {r['post_id']} {r['rate']:.1f} per 1k  {r['hook']}")
