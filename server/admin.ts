import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { BRAND } from "../shared/brand";
import { append, device, recent } from "./store";

/** Read a small JSON body (rejects anything over `limit` bytes). */
export function readJson(req: IncomingMessage, limit = 8 * 1024): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** POST /api/feedback — the rating a tester gives at the end of a call. */
export async function feedback(req: IncomingMessage, res: ServerResponse) {
  const b = await readJson(req);
  const rating = str(b?.rating, 10);
  if (!b || !rating || !["great", "ok", "bad"].includes(rating)) return send(res, 400, { error: "bad-request" });
  append("feedback", {
    rating,
    comment: str(b.comment, 1000)?.trim() || undefined,
    room: str(b.room, 12),
    kind: str(b.kind, 8),
    people: num(b.people),
    minutes: num(b.minutes),
    speaks: str(b.speaks, 16),
    reads: str(b.reads, 16),
    audioOnly: b.audioOnly === true || undefined,
    device: device(req.headers["user-agent"]),
  });
  send(res, 201, { ok: true });
}

/** POST /api/client-error — uncaught errors from testers' browsers. */
export async function clientError(req: IncomingMessage, res: ServerResponse) {
  const b = await readJson(req);
  const message = str(b?.message, 500);
  if (!message) return send(res, 400, { error: "bad-request" });
  append("errors", { message, stack: str(b?.stack, 2000), path: str(b?.path, 120), device: device(req.headers["user-agent"]) });
  send(res, 201, { ok: true });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function authorised(token: string | undefined): boolean {
  const want = process.env.ADMIN_TOKEN;
  if (!want || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const when = (ts: unknown) => esc(String(ts ?? "").replace("T", " ").slice(0, 16));

/** GET /admin?token=… — the development dashboard: calls, feedback, errors. */
export function dashboard(token: string | undefined, res: ServerResponse) {
  if (!authorised(token)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  const calls = recent("calls", 500);
  const fb = recent("feedback", 300);
  const errs = recent("errors", 200);
  const minutes = calls.reduce((s, c) => s + (Number(c.minutes) || 0), 0);
  const cost = calls.reduce((s, c) => s + (Number(c.estCostUsd) || 0), 0);
  const counts = { great: 0, ok: 0, bad: 0 } as Record<string, number>;
  for (const f of fb) counts[String(f.rating)] = (counts[String(f.rating)] ?? 0) + 1;
  const groups = calls.filter((c) => c.kind === "group").length;
  const costPerHour = minutes ? (cost / minutes) * 60 : 0;

  const table = (head: string[], rows: string[][]) =>
    `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${
      rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${head.length}" class="muted">Nothing yet</td></tr>`
    }</tbody></table>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${BRAND.appName} · dashboard</title><style>
:root{color-scheme:dark}body{margin:0;font:15px/1.45 system-ui,-apple-system,sans-serif;background:#0b0d10;color:#f4f5f7;padding:20px 16px 48px}
main{max-width:1100px;margin:0 auto}h1{font-size:1.4rem;margin:0 0 4px}h2{font-size:1.1rem;margin:32px 0 10px}.muted{color:#9aa0a8}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}.kpi{background:#15181d;border:1px solid #262a31;border-radius:12px;padding:12px 14px}
.kpi b{display:block;font-size:1.5rem}table{width:100%;border-collapse:collapse;font-size:.88rem}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #22262c;vertical-align:top}
th{color:#9aa0a8;font-weight:600}.wrap{overflow-x:auto}.great{color:#3ddc84}.bad{color:#ff6b6b}.ok{color:#ffc24b}code{font-size:.8rem;white-space:pre-wrap;word-break:break-word;color:#c9ced6}
</style></head><body><main>
<h1>${BRAND.appName} · development dashboard</h1><p class="muted">Calls are recorded when their room closes. No audio, video or words of conversations are stored.</p>
<div class="kpis">
<div class="kpi"><span class="muted">Calls</span><b>${calls.length}</b><span class="muted">${groups} group</span></div>
<div class="kpi"><span class="muted">Call minutes</span><b>${Math.round(minutes)}</b><span class="muted">avg ${calls.length ? Math.round(minutes / calls.length) : 0} min</span></div>
<div class="kpi"><span class="muted">Caption cost (est.)</span><b>$${cost.toFixed(2)}</b><span class="muted">$${costPerHour.toFixed(2)} per call-hour</span></div>
<div class="kpi"><span class="muted">Feedback</span><b><span class="great">${counts.great}</span> · <span class="ok">${counts.ok}</span> · <span class="bad">${counts.bad}</span></b><span class="muted">great · ok · bad</span></div>
<div class="kpi"><span class="muted">Client errors</span><b>${errs.length}</b><span class="muted">latest 200</span></div>
</div>
<h2>Feedback</h2><div class="wrap">${table(
    ["When (UTC)", "Rating", "Comment", "Call", "Languages", "Device"],
    fb.map((f) => [
      when(f.ts),
      `<span class="${esc(f.rating)}">${esc(f.rating)}</span>`,
      esc(f.comment ?? ""),
      `${esc(f.kind ?? "")} · ${esc(f.people ?? "?")} people · ${esc(f.minutes ?? "?")} min${f.audioOnly ? " · audio only" : ""}`,
      `${esc(f.speaks ?? "")} → reads ${esc(f.reads ?? "")}`,
      esc(f.device),
    ]),
  )}</div>
<h2>Calls</h2><div class="wrap">${table(
    ["Ended (UTC)", "Kind", "Minutes", "People", "Languages", "Caption min", "Est. cost", "Devices"],
    calls.map((c) => [
      when(c.ts),
      esc(c.kind),
      esc(c.minutes),
      `${esc(c.people)} (peak ${esc(c.peak)})`,
      esc((c.langs as string[] | undefined)?.join(", ")),
      esc(c.captionMinutes),
      `$${esc(Number(c.estCostUsd ?? 0).toFixed(3))}`,
      esc((c.devices as string[] | undefined)?.join(", ")),
    ]),
  )}</div>
<h2>Client errors</h2><div class="wrap">${table(
    ["When (UTC)", "Message", "Where", "Device"],
    errs.map((e) => [when(e.ts), `${esc(e.message)}${e.stack ? `<br><code>${esc(String(e.stack).slice(0, 600))}</code>` : ""}`, esc(e.path), esc(e.device)]),
  )}</div>
</main></body></html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  res.end(html);
}
