"""Zips content/out for handing over: one zip per week of the plan plus the spare posts.
Run after render.mjs, reel.mjs and gallery.mjs:  python3 content/studio/pack.py"""
import json, os, zipfile
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out")
groups = json.load(open(os.path.join(out, "groups.json")))
os.makedirs(os.path.join(out, "zips"), exist_ok=True)
for g, dirs in groups.items():
    name = "Simpatico " + g.lower()
    path = os.path.join(out, "zips", name.replace(" ", "-") + ".zip")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as z:  # pictures and video are already compressed
        z.write(os.path.join(out, "index-%s.html" % g.lower().replace(" ", "-")), name + "/index.html")
        for d in dirs:
            for root, _, files in os.walk(os.path.join(out, d)):
                for f in sorted(files):
                    if f.endswith(".part"): continue
                    full = os.path.join(root, f)
                    z.write(full, os.path.join(name, os.path.relpath(full, out)))
    print(path, round(os.path.getsize(path) / 1e6), "MB", len(dirs), "posts")
