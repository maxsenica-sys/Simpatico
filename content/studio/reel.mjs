// Renders the reels: the same five beats and the ask as moving scenes, 1080 x 1920, 30 frames a
// second. Every frame is drawn by setting the animations to an exact time, so a render is repeatable.
//   node content/studio/reel.mjs [post ids...] [--part i/n] [--only ig|tt]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { frame, page } from "./slides.mjs";
import { open, done, readQueue } from "./shot.mjs";
import { folder, writeText } from "./render.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30, ASK = 3.0;
const count = (s) => s.trim().split(/\s+/).length;

/** How long each scene stays up: enough to read its line, and never shorter overall than the voiceover takes to say. */
export function timing(p) {
  const d = [p.hook, p.old_way, p.cost, p.mechanic, p.change].map((t, i) => Math.max(2.3, 0.9 + count(t) * 0.22) + (i === 3 ? 1.3 : 0));
  const need = count(p.voiceover_script) / 2.7, sum = d.reduce((a, b) => a + b, 0);
  const k = Math.max(1, need / sum);
  const dur = [...d.map((x) => Math.round(x * k * FPS) / FPS), ASK];
  const starts = dur.map((_, i) => dur.slice(0, i).reduce((a, b) => a + b, 0));
  return { dur, starts, total: starts[5] + ASK };
}
const SCRIPT = (starts, total) => `<script>
const S=${JSON.stringify(starts.map((s) => s * 1000))},A=[],POP='cubic-bezier(.2,1.4,.4,1)',OUT='cubic-bezier(.2,.8,.2,1)';
const add=(el,kf,o)=>{if(!el)return;const a=el.animate(kf,{fill:'both',easing:OUT,...o});a.pause();A.push(a)};
document.querySelectorAll('.scene').forEach((sc,i)=>{const s=S[i];
  if(i>0)add(sc,[{clipPath:'circle(0% at 50% 62%)'},{clipPath:'circle(125% at 50% 62%)'}],{delay:s,duration:520,easing:'cubic-bezier(.6,0,.2,1)'});
  sc.querySelectorAll('.head .w').forEach((w,j)=>add(w,[{opacity:0,transform:'translateY(46px)'},{opacity:1,transform:'none'}],{delay:s+220+j*75,duration:340}));
  sc.querySelectorAll('.pill,.lockup').forEach((e)=>add(e,[{opacity:0,transform:'translateY(-18px)'},{opacity:1,transform:'none'}],{delay:s+120,duration:300}));
  sc.querySelectorAll('.disc').forEach((e)=>{e.style.transformBox='fill-box';e.style.transformOrigin='center';add(e,[{transform:'scale(0)'},{transform:'scale(1)'}],{delay:s+80,duration:520,easing:POP})});
  sc.querySelectorAll('.chr').forEach((e)=>{add(e,[{transform:'scale(.55)',opacity:0},{transform:'scale(1)',opacity:1}],{delay:s+240,duration:480,easing:POP});
    add(e,[{transform:'translateY(0)'},{transform:'translateY(-12px)'},{transform:'translateY(0)'}],{delay:s+900,duration:1500,iterations:Infinity,composite:'add',easing:'ease-in-out',fill:'none'})});
  sc.querySelectorAll('[data-a=phone]').forEach((e)=>add(e,[{transform:'translateY(1300px) rotate(8deg)'},{transform:'none'}],{delay:s+350,duration:700,easing:'cubic-bezier(.2,1.15,.4,1)'}));
  sc.querySelectorAll('[data-a=say]').forEach((e)=>{e.style.transformOrigin='0 100%';add(e,[{transform:'scale(0)'},{transform:'scale(1)'}],{delay:s+950,duration:380,easing:POP})});
  sc.querySelectorAll('[data-a=band]').forEach((e)=>add(e,[{opacity:0,transform:'translateY(30px)'},{opacity:1,transform:'none'}],{delay:s+500,duration:350}));
  sc.querySelectorAll('[data-type]').forEach((e)=>{const ws=e.textContent.split(' ');e.innerHTML=ws.map((w)=>'<span style="display:inline-block;white-space:pre">'+w+' </span>').join('');
    [...e.children].forEach((w,j)=>add(w,[{opacity:0},{opacity:1}],{delay:s+1500+j*150,duration:90}))});
  sc.querySelectorAll('[data-pulse]').forEach((e)=>add(e,[{transform:'scale(1)'},{transform:'scale(1.09)'},{transform:'scale(1)'}],{delay:s+1500,duration:900,iterations:Infinity,easing:'ease-in-out',fill:'none'}));
  sc.querySelectorAll('[data-a=card]').forEach((e)=>add(e,[{transform:'scale(.6)',opacity:0},{transform:'scale(1)',opacity:1}],{delay:s+250,duration:420,easing:POP}));
  sc.querySelectorAll('.mark.big .bl,.mark.big .br').forEach((e,j)=>{e.style.transformBox='fill-box';e.style.transformOrigin=j?'80% 100%':'20% 100%';add(e,[{transform:'scale(0)'},{transform:'scale(1)'}],{delay:s+600+j*300,duration:420,easing:POP})});
  sc.querySelectorAll('[data-a=slogan]').forEach((e)=>add(e,[{opacity:0},{opacity:1}],{delay:s+1500,duration:400}));
});
window.setTime=(ms)=>{for(const a of A)a.currentTime=ms};setTime(0);
</script>`;
export function reelPage(p, hook) {
  const { starts, total } = timing(p);
  const scenes = [0, 1, 2, 3, 4, 5].map((b) => `<div class="scene" style="position:absolute;inset:0;z-index:${b}">${frame(p, b, { fmt: "tt", chrome: false, hook })}</div>`).join("");
  return page(`<div style="position:relative;width:1080px;height:1920px;overflow:hidden">${scenes}</div>`) + SCRIPT(starts, total);
}
async function render(p, hook, file) {
  const { total } = timing(p);
  const pg = await open(reelPage(p, hook), 1080, 1920);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] });
  const n = Math.round(total * FPS);
  for (let f = 0; f < n; f++) {
    await pg.evaluate((t) => window.setTime(t), (f / FPS) * 1000);
    const buf = await pg.screenshot({ type: "jpeg", quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await pg.close();
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const part = args.includes("--part") ? args[args.indexOf("--part") + 1].split("/").map(Number) : null;
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const ids = args.filter((a) => /^S\d+$/.test(a));
  let q = (await readQueue(path.resolve(here, "../queue.csv"))).filter((p) => p.format === "reel" && (!ids.length || ids.includes(p.post_id)));
  if (part) q = q.filter((_, i) => i % part[1] === part[0]);
  const sec = (s) => s.toFixed(1).padStart(4);
  for (const p of q) {
    const dir = writeText(p), t = timing(p);
    const names = ["Hook", "Right now", "What it costs", "With Simpatico", "What changes", "Ask"];
    const lines = [p.hook, p.old_way, p.cost, p.mechanic, p.change, p.ask];
    writeFileSync(path.join(dir, "voiceover.txt"), `Voiceover (${count(p.voiceover_script)} words, the video runs ${t.total.toFixed(1)} seconds):\n\n${p.voiceover_script}\n\nWhat is on screen, and when:\n${names.map((nm, i) => `${sec(t.starts[i])} s  ${nm}: ${lines[i]}`).join("\n")}\n`);
    if (only !== "tt") await render(p, undefined, path.join(dir, "reel-instagram.mp4"));
    if (only !== "ig") await render(p, p.tiktok_hook, path.join(dir, "reel-tiktok.mp4"));
    console.log(p.post_id, t.total.toFixed(1) + "s");
  }
  await done();
}
