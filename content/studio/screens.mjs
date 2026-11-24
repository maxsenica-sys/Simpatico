// The seven phone screens the posts point at, drawn large and simple in the app's own look so
// they read at slide size. Logical size 390 x 720; phone() scales it to the width asked for.
import { C, bust, charOf, esc, mark } from "./kit.mjs";
import { CAST } from "./cast.mjs";
import { LANGS, langOf, quoted } from "./dialogue.mjs";

const ic = {
  mic: `<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
  cam: `<svg viewBox="0 0 24 24"><rect x="3" y="6" width="12" height="12" rx="3"/><path d="M15 10l6-3v10l-6-3z"/></svg>`,
  chat: `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="3"/><path d="M7 9h10M7 13h6"/></svg>`,
  dots: `<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></svg>`,
  end: `<svg viewBox="0 0 24 24"><path d="M4 14c5-5 11-5 16 0l-2 2.5-3.5-1.5v-2.5c-1.7-.5-3.3-.5-5 0V15L6 16.5z" fill="currentColor" stroke="none"/></svg>`,
  home: `<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>`,
  group: `<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="8" r="2.5"/><path d="M17 13c2.5 0 4.5 2 4.5 5"/></svg>`,
  two: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="12" height="9" rx="3"/><rect x="9" y="12" width="12" height="9" rx="3"/></svg>`,
  card: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 5.5-1.5 6 0M15 10h3M15 14h3"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M16 16l4.5 4.5"/></svg>`,
  share: `<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>`,
  save: `<svg viewBox="0 0 24 24"><path d="M12 4v11M8 11l4 4 4-4M5 19h14"/></svg>`,
};
export const SCREEN_CSS = `
.phone{position:relative;background:${C.dark};border-radius:calc(56px*var(--k));padding:calc(11px*var(--k));box-shadow:0 0 0 calc(2.5px*var(--k)) #2b313b inset, calc(16px*var(--k)) calc(18px*var(--k)) 0 rgba(11,13,16,.2)}
.phone .glass{width:calc(390px*var(--k));height:calc(720px*var(--k));border-radius:calc(46px*var(--k));overflow:hidden;position:relative;background:${C.dark}}
.scr{width:390px;height:720px;zoom:var(--k);position:relative;color:${C.ink};background:#0b0d10;font-family:Nunito,sans-serif;overflow:hidden}
.scr svg{display:block}
.scr .i{display:inline-block;flex:none}
.scr .i svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.scr .island{position:absolute;left:50%;top:12px;width:96px;height:26px;margin-left:-48px;border-radius:14px;background:#000;z-index:9}
/* call */
.call .vid{position:absolute;inset:0}
.call .vid svg{position:absolute;left:0;top:70px;width:390px;height:410px}
.call .ctl{position:absolute;left:0;right:0;top:50px;display:flex;justify-content:center;gap:14px}
.call .ctl .i{width:46px;height:46px;border-radius:50%;background:rgba(11,13,16,.55);padding:12px;color:${C.ink}}
.call .ctl .i.end{background:#ff4d5e}
.call .chip{position:absolute;left:20px;top:112px;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;background:rgba(11,13,16,.6);padding:7px 13px;border-radius:20px}
.call .chip i{width:9px;height:9px;border-radius:50%;background:#37d67a}
.call .self{position:absolute;right:16px;top:330px;width:104px;height:138px;border-radius:20px;overflow:hidden;border:3px solid ${C.dark};box-shadow:0 8px 20px rgba(0,0,0,.35)}
.call .self svg{width:100%;height:100%}
.call .cap{position:absolute;left:0;right:0;bottom:0;padding:26px 24px 34px;background:${C.dark};border-radius:30px 30px 0 0;min-height:206px}
.cap .who{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;letter-spacing:.08em;color:${C.mint};text-transform:uppercase;margin-bottom:6px}
.cap .who:before{content:"";width:9px;height:9px;background:${C.mint};transform:rotate(45deg)}
.cap .prev{font-size:21px;font-weight:700;color:rgba(244,245,247,.42);line-height:1.25;margin-bottom:10px}
.cap .now{font-size:35px;font-weight:800;line-height:1.14;letter-spacing:-.015em}
/* in person */
.ip .half{position:absolute;left:0;right:0;height:346px;padding:30px 26px;display:flex;flex-direction:column;justify-content:flex-end}
.ip .top{top:0;background:#0f2a25;transform:rotate(180deg)}
.ip .bot{bottom:0;background:#111c38}
.ip .lang{align-self:flex-start;display:flex;align-items:center;gap:7px;font-family:Nunito,'Noto Sans',sans-serif;font-size:16px;font-weight:800;padding:7px 14px;border-radius:20px;background:rgba(255,255,255,.1);margin-bottom:auto}
.ip .lang .i{width:18px;height:18px}
.ip .top .lang.found{background:${C.mint};color:${C.dark}}
.ip .said{font-size:17px;font-weight:700;color:rgba(244,245,247,.45);margin-bottom:8px}
.ip p.big{font-size:36px;font-weight:800;line-height:1.18;letter-spacing:-.01em}
.ip .top p.big{color:#c9f7e9}.ip .bot p.big{color:#fff}
.ip .mid{position:absolute;left:0;right:0;top:346px;height:28px;background:${C.dark};display:flex;align-items:center;justify-content:center;gap:5px}
.ip .mid b{width:5px;border-radius:3px;background:${C.blue}}
.ip .latest{position:absolute;right:22px;bottom:24px;font-size:15px;font-weight:800;background:${C.blue};color:${C.dark};padding:8px 16px;border-radius:20px}
/* home */
.home{background:radial-gradient(120% 60% at 0% 0%,#1b2a55 0%,#0b0d10 60%)}
.home .hd{position:absolute;left:20px;right:20px;top:54px;display:flex;align-items:center;gap:8px;font-size:25px;font-weight:800;letter-spacing:-.02em}
.home .hd .chipc{margin-left:auto;display:flex;align-items:center;gap:7px;font-size:14px;font-weight:700;padding:8px 13px;border-radius:20px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.home .hd .chipc .i{width:19px;height:19px;color:${C.mint}}
.home .tiles{position:absolute;left:20px;right:20px;top:112px;display:flex;gap:12px}
.home .tile{flex:1;height:138px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:16px}
.home .tile .i{width:42px;height:42px;border-radius:13px;padding:9px;background:rgba(91,140,255,.22);color:#9db8ff;margin-bottom:12px}
.home .tile:last-child .i{background:rgba(95,224,189,.18);color:${C.mint}}
.home .tile b{display:block;font-size:19px;font-weight:800}.home .tile span{font-size:14px;color:rgba(244,245,247,.55);font-weight:600}
.home h4{position:absolute;left:24px;top:272px;font-size:17px;font-weight:800}
.home .list{position:absolute;left:20px;right:20px;top:304px;border-radius:24px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.home .row{display:flex;align-items:center;gap:13px;padding:12px 16px;border-top:1px solid rgba(255,255,255,.08)}
.home .row:first-child{border-top:0}
.home .av{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:18px;color:${C.dark};background:linear-gradient(135deg,${C.mint},${C.blue})}
.home .row b{font-size:18px;font-weight:800;display:block}.home .row span{font-size:14px;color:rgba(244,245,247,.5);font-weight:600}
.home .row .i{margin-left:auto;width:38px;height:38px;border-radius:50%;padding:9px;background:rgba(91,140,255,.18);color:#9db8ff}
.home .bar{position:absolute;left:0;right:0;bottom:0;height:92px;background:#0d1014;border-top:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-around;align-items:flex-end;padding:0 30px 16px;font-size:13px;font-weight:700}
.home .bar .t{width:70px;text-align:center;color:rgba(244,245,247,.55)}.home .bar .t.on{color:${C.blue}}
.home .bar .t .i{width:26px;height:26px;margin:0 auto 4px}
.home .bar .me{width:28px;height:28px;border-radius:50%;margin:0 auto 4px;background:linear-gradient(135deg,${C.mint},${C.blue})}
.home .callbtn{position:absolute;left:50%;bottom:34px;width:92px;height:92px;margin-left:-46px;border-radius:50%;background:linear-gradient(160deg,#6f9bff,#4a6fe8);border:6px solid #0d1014;display:grid;place-items:center;box-shadow:0 0 0 7px rgba(91,140,255,.35),0 0 0 17px rgba(91,140,255,.16)}
.home .callbtn .i{width:40px;height:40px;color:#fff}
.home .calll{position:absolute;left:0;right:0;bottom:14px;text-align:center;font-size:14px;font-weight:800}
/* call card */
.cc{background:radial-gradient(120% 60% at 100% 0%,#143a33 0%,#0b0d10 60%)}
.cc h3{position:absolute;left:24px;top:58px;font-size:23px;font-weight:800}
.cc .card{position:absolute;left:22px;right:22px;top:108px;border-radius:30px;padding:26px 22px 24px;background:linear-gradient(160deg,#20315f,#17203a);border:1px solid rgba(255,255,255,.14);text-align:center}
.cc .ph{width:124px;height:124px;border-radius:50%;margin:0 auto 12px;overflow:hidden;background:${C.mint};border:4px solid ${C.ink}}
.cc .ph svg{width:100%;height:100%}
.cc .card b{font-size:30px;font-weight:800;display:block}.cc .card span{font-size:17px;font-weight:600;color:rgba(244,245,247,.65)}
.cc .card .lk{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:17px;font-weight:800;background:rgba(11,13,16,.5);border-radius:16px;padding:12px}
.cc .card .lk .i{width:20px;height:20px;color:${C.mint}}
.cc .btn{position:absolute;left:22px;right:22px;top:418px;height:62px;border-radius:22px;background:${C.blue};color:${C.dark};font-size:21px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px}
.cc .btn .i{width:25px;height:25px}
.cc .msg{position:absolute;left:22px;right:60px;top:508px;border-radius:24px 24px 24px 6px;background:#1c2028;padding:16px 18px;font-size:17px;font-weight:600;line-height:1.3}
.cc .msg u{display:block;margin-top:9px;text-decoration:none;font-weight:800;color:${C.mint};background:rgba(95,224,189,.12);padding:10px 12px;border-radius:14px}
.cc .note{position:absolute;left:0;right:0;bottom:28px;text-align:center;font-size:16px;font-weight:700;color:rgba(244,245,247,.55)}
/* group */
.grp .grid{position:absolute;left:14px;right:14px;top:52px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grp .tl{height:168px;border-radius:22px;overflow:hidden;position:relative}
.grp .tl svg{width:100%;height:100%}
.grp .tl em{position:absolute;left:9px;bottom:8px;font-style:normal;font-size:13px;font-weight:800;background:rgba(11,13,16,.7);padding:4px 10px;border-radius:12px}
.grp .tl.talk{box-shadow:0 0 0 4px ${C.mint}}
.grp .chip{position:absolute;left:18px;top:412px;font-size:14px;font-weight:800;background:rgba(255,255,255,.08);padding:6px 13px;border-radius:18px}
.grp .caps{position:absolute;left:22px;right:22px;top:456px}
.grp .ln{margin-bottom:13px;font-size:25px;font-weight:800;line-height:1.16}
.grp .ln small{display:block;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;margin-bottom:1px}
.grp .ln.old{color:rgba(244,245,247,.45);font-size:20px}
/* language picker */
.lp h3{position:absolute;left:24px;top:58px;font-size:26px;font-weight:800}
.lp .srch{position:absolute;left:20px;right:20px;top:106px;height:52px;border-radius:18px;background:rgba(255,255,255,.07);display:flex;align-items:center;gap:10px;padding:0 16px;font-size:17px;font-weight:600;color:rgba(244,245,247,.5)}
.lp .srch .i{width:22px;height:22px}
.lp .rows{position:absolute;left:20px;right:20px;top:176px}
.lp .r{height:74px;display:flex;align-items:center;padding:0 18px;border-radius:20px;margin-bottom:8px;background:rgba(255,255,255,.045)}
.lp .r b{font-size:24px;font-weight:700}.lp .r span{margin-left:12px;font-size:16px;font-weight:600;color:rgba(244,245,247,.5);font-family:Nunito,sans-serif}
.lp .r.on{background:${C.blue};color:${C.dark}}.lp .r.on span{color:rgba(11,13,16,.6)}
.lp .r .i{margin-left:auto;width:28px;height:28px}
.lp .more{position:absolute;left:0;right:0;bottom:26px;text-align:center;font-size:16px;font-weight:800;color:${C.mint}}
/* transcript */
.tr h3{position:absolute;left:24px;top:58px;font-size:25px;font-weight:800}
.tr .sv{position:absolute;right:20px;top:52px;height:44px;padding:0 16px;border-radius:16px;display:flex;align-items:center;gap:7px;font-size:16px;font-weight:800;background:rgba(255,255,255,.08)}
.tr .sv .i{width:20px;height:20px}
.tr .sv.hot{background:${C.mint};color:${C.dark};box-shadow:0 0 0 6px rgba(95,224,189,.25)}
.tr .rows{position:absolute;left:20px;right:20px;top:116px}
.tr .b{border-radius:22px;padding:14px 16px 15px;margin-bottom:10px;background:rgba(255,255,255,.05)}
.tr .b small{display:block;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:${C.mint};margin-bottom:3px;font-family:Nunito,sans-serif}
.tr .b.me small{color:#9db8ff}
.tr .b .o{font-size:18px;font-weight:600;color:rgba(244,245,247,.55);line-height:1.25}
.tr .b .e{font-size:23px;font-weight:800;line-height:1.2;margin-top:2px;font-family:Nunito,sans-serif}
.tr .nr{display:inline-block;margin-top:9px;font-size:14px;font-weight:800;padding:6px 13px;border-radius:14px;background:rgba(255,255,255,.09);font-family:Nunito,sans-serif}
.tr .nr.hot{background:${C.blue};color:${C.dark};box-shadow:0 0 0 6px rgba(91,140,255,.28)}
`;

const I = (name, cls = "") => `<span class="i ${cls}">${ic[name]}</span>`;
const tileBg = (who) => (CAST[who].top === C.blue ? "#c9f3e7" : CAST[who].top === C.mint ? "#cfdcff" : CAST[who].top === C.dark ? "#c9f3e7" : "#cfdcff");
const KIND = { grandma: "g", "partner-b": "w", newcomer: "w", grandkid: "k", "partner-a": "m", traveller: "m", shopkeeper: "m", student: "m" };

/** Who is on the phone, in which language, saying what. */
export function context(post) {
  const lang = langOf(post), L = LANGS[lang];
  const poses = [post.pose_1, post.pose_2, post.pose_3, post.pose_4, post.pose_5];
  const self = charOf(post.pose_4) || charOf(post.pose_1) || "partner-a";
  let remote = [post.pose_1, post.pose_5, post.pose_2, post.pose_3].map(charOf).find((c) => c && c !== self);
  if (!remote) remote = self === "grandma" ? "grandkid" : self === "partner-a" ? "partner-b" : "grandma";
  if (post.pose_4 === "two-people-one-phone") remote = "shopkeeper";
  const n = parseInt(post.post_id.slice(1), 10);
  return { lang, L, self, remote, name: L.names[KIND[remote]], n, poses };
}

function callCaptions(post, x) {
  const q = quoted(post);
  const [a, b] = q ? [["", ""], ["", q.read]] : [x.L.warm[x.n % 3], x.L.warm[(x.n + 1) % 3]];
  return `<div class="scr call"><div class="island"></div>
    <div class="vid" style="background:${tileBg(x.remote)}">${bust(x.remote, { expr: "laugh" })}</div>
    <div class="ctl">${I("mic")}${I("cam")}${I("chat")}${I("dots")}${I("end", "end")}</div>
    <div class="chip"><i></i>Captions on</div>
    <div class="self" style="background:${tileBg(x.self)}">${bust(x.self, { expr: "smile" })}</div>
    <div class="cap"><div class="who">${esc(x.name)}</div>${a[1] ? `<div class="prev">${esc(a[1])}</div>` : ""}<div class="now" data-type>${esc(b[1])}</div></div></div>`;
}
function inPerson(post, x) {
  const set = (post.audience === "travellers" ? x.L.shop || x.L.meet : x.L.meet || x.L.shop) || { them: x.L.warm[0], me: ["Nice to meet you.", x.L.warm[1][0]] };
  const found = post.feature_id === "auto-detect";
  const scroll = post.feature_id === "scroll-back";
  return `<div class="scr ip">
    <div class="half top"><div class="lang ${x.L.cls} ${found ? "found" : ""}">${found ? I("check") : ""}${esc(x.L.native)}</div><div class="said">${esc(set.me[0])}</div><p class="big ${x.L.cls}" ${x.L.rtl ? 'dir="rtl"' : ""}>${esc(set.me[1])}</p></div>
    <div class="mid">${[8, 14, 20, 12, 18, 9].map((h) => `<b style="height:${h}px"></b>`).join("")}</div>
    <div class="half bot"><div class="lang">English</div><div class="said ${x.L.cls}" ${x.L.rtl ? 'dir="rtl"' : ""}>${esc(set.them[0])}</div><p class="big" data-type>${esc(set.them[1])}</p>${scroll ? `<div class="latest">Latest</div>` : ""}</div></div>`;
}
function home(post, x) {
  const others = ["Turkish", "Vietnamese", "Greek", "Arabic", "Italian"].filter((l) => l !== x.lang).slice(0, 2);
  const people = [[x.L.names.g, "Today"], [x.L.names.w, "Yesterday"], [LANGS[others[0]].names.m, "Thu"]];
  return `<div class="scr home"><div class="island"></div>
    <div class="hd">${mark(34)}Simpatico<span class="chipc">${I("card")}Your call card</span></div>
    <div class="tiles"><div class="tile">${I("group")}<b>Group call</b><span>Up to 12 people</span></div><div class="tile">${I("two")}<b>In person</b><span>One phone</span></div></div>
    <h4>Recent</h4>
    <div class="list">${people.map(([nm, when]) => `<div class="row"><div class="av">${nm[0]}</div><div><b>${esc(nm)}</b><span>${when}</span></div>${I("cam")}</div>`).join("")}</div>
    <div class="bar"><div class="t on">${I("home")}Home</div><div class="t"></div><div class="t"><div class="me"></div>Me</div></div>
    <div class="callbtn" data-pulse>${I("cam")}</div><div class="calll">Call</div></div>`;
}
function callCard(post, x) {
  return `<div class="scr cc"><div class="island"></div><h3>Your call card</h3>
    <div class="card"><div class="ph" style="background:${tileBg(x.self)}">${bust(x.self)}</div><b>Max</b><span>Call me on Simpatico</span><div class="lk">${I("card")}Your personal call link</div></div>
    <div class="btn" data-pulse>${I("share")}Share your card</div>
    <div class="msg">${esc(x.name)}, tap this to call me:<u>Max's call card</u></div>
    <div class="note">They tap it. No app, no account.</div></div>`;
}
function group(post, x) {
  const cast = [["grandma", x.L.names.g], ["partner-b", x.L.names.w], ["grandkid", x.L.names.k], ["partner-a", "Max"]];
  const lines = [[x.L.names.w, "Mum, sit down, we're fine.", "#9db8ff", "old"], [x.L.names.k, "I've eaten twice!", "#ffd166", "old"], [x.L.names.g, "Has everyone eaten?", C.mint, ""]];
  const n = post.feature_id === "in-room" ? 3 : 4;
  return `<div class="scr grp"><div class="island"></div>
    <div class="grid">${cast.map(([w, nm], i) => `<div class="tl ${i === 0 ? "talk" : ""}" style="background:${tileBg(w)}">${bust(w, { expr: i === 0 ? "laugh" : "grin" })}<em>${esc(nm)}</em></div>`).join("")}</div>
    <div class="chip">${n === 3 ? "4 people · 3 phones · heard once" : "4 in the call"}</div>
    <div class="caps">${lines.map(([nm, t, col, cls]) => `<div class="ln ${cls}"><small style="color:${col}">${esc(nm)}</small>${cls ? esc(t) : `<span data-type>${esc(t)}</span>`}</div>`).join("")}</div></div>`;
}
function picker(post, x) {
  const all = ["Turkish", "Vietnamese", "Arabic", "Hindi", "Mandarin", "Greek", "Korean", "Tagalog", "Punjabi", "Italian"].filter((l) => l !== x.lang);
  const list = [all[0], x.lang, ...all.slice(1, 5)];
  return `<div class="scr lp"><div class="island"></div><h3>They speak</h3><div class="srch">${I("search")}Search 60 languages</div>
    <div class="rows">${list.map((l) => `<div class="r ${l === x.lang ? "on" : ""}"><b class="${LANGS[l].cls}">${esc(LANGS[l].native)}</b><span>${l}</span>${l === x.lang ? I("check") : ""}</div>`).join("")}</div>
    <div class="more">60 languages</div></div>`;
}
function transcript(post, x) {
  const hotSave = post.feature_id !== "not-right";
  const w = x.L.warm;
  const rows = [[x.name, w[0][0], w[0][1], ""], ["You", "When are you coming?", w[2][0], "me"], [x.name, w[1][0], w[1][1], ""]];
  return `<div class="scr tr"><div class="island"></div><h3>Conversation</h3><div class="sv ${hotSave ? "hot" : ""}" ${hotSave ? "data-pulse" : ""}>${I("save")}Save</div>
    <div class="rows">${rows.map(([nm, o, e, cls], i) => `<div class="b ${cls}"><small>${esc(nm)}</small><div class="o ${cls ? "" : x.L.cls}" ${!cls && x.L.rtl ? 'dir="rtl"' : ""}>${esc(o)}</div><div class="e ${cls ? x.L.cls : ""}" ${cls && x.L.rtl ? 'dir="rtl"' : ""}>${esc(e)}</div>${!cls ? `<span class="nr ${!hotSave && i === 2 ? "hot" : ""}" ${!hotSave && i === 2 ? "data-pulse" : ""}>Not right?</span>` : ""}</div>`).join("")}</div></div>`;
}
const SCREENS = { "ui-call-captions": callCaptions, "ui-inperson-split": inPerson, "ui-home-callbutton": home, "ui-call-card-share": callCard, "ui-group-captions": group, "ui-language-picker": picker, "ui-transcript": transcript };

/** The phone for a post, `width` pixels wide on the canvas (bezel included). */
export function phone(post, width, cls = "") {
  const x = context(post);
  const k = width / 412;
  return `<div class="phone ${cls}" style="--k:${k.toFixed(4)}"><div class="glass">${SCREENS[post.ui_card](post, x)}</div></div>`;
}
/** What the other person actually said, for the speech bubble beside the phone (or null). */
export function spoken(post) {
  const x = context(post);
  const q = quoted(post);
  if (q) return q.said ? { text: q.said, cls: "", rtl: false, lang: "Said" } : null;
  if (post.ui_card === "ui-call-captions") return { text: x.L.warm[(x.n + 1) % 3][0], cls: x.L.cls, rtl: x.L.rtl, lang: x.lang };
  if (post.ui_card === "ui-group-captions") return { text: x.L.warm[0][0], cls: x.L.cls, rtl: x.L.rtl, lang: x.lang };
  return null;
}
