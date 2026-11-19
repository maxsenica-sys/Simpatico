import ar from "@/i18n/ar.json";
import bn from "@/i18n/bn.json";
import en from "@/i18n/en.json";
import es from "@/i18n/es.json";
import fr from "@/i18n/fr.json";
import hi from "@/i18n/hi.json";
import id from "@/i18n/id.json";
import pt from "@/i18n/pt.json";
import ru from "@/i18n/ru.json";
import tr from "@/i18n/tr.json";
import ur from "@/i18n/ur.json";
import zh from "@/i18n/zh.json";
import { BRAND } from "@/shared/brand";

/** How long the opening stays on screen, and its fade (keep in step with .splash in globals.css). */
const SHOW_MS = 1700;
const FADE_MS = 250;

/** The slogan in every app language, split into its lines ("Different languages." / "Same conversation."). */
const SLOGANS: Record<string, string[]> = Object.fromEntries(
  Object.entries({ ar, bn, en, es, fr, hi, id, pt, ru, tr, ur, zh }).map(([code, d]) => [code, String((d as { slogan?: string }).slogan ?? BRAND.tagline).split(/(?<=[.。!?؟।])\s+/u)]),
);

/**
 * The opening: logo, name and slogan appear together the moment the page arrives (it's part of
 * the page itself, so it doesn't wait for the app's code), stay long enough to read, then fade
 * to the home screen. Once per app open; skipped for people who asked their phone for less
 * motion; a tap skips it. The small script runs before the first paint: it puts the slogan in
 * the person's language and decides whether to show it at all.
 */
export function StartSplash() {
  const all = SLOGANS;
  // Every language's slogan is in the page, hidden; the script marks which one to show (on <html>,
  // which the app never redraws), so the app starting up can't put the English one back.
  const codes = Object.keys(all);
  const css = codes.map((c) => `html[data-splash="${c}"] .splash-slogan[data-l="${c}"]`).join(",") + "{display:block}";
  const script = `(function(){var d=document.documentElement;
function done(){d.classList.add("splash-seen")}
try{if(sessionStorage.getItem("talk.splash")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)return done();sessionStorage.setItem("talk.splash","1")}catch(e){}
var code="en";try{var p=JSON.parse(localStorage.getItem("talk.lang.v1")||"null");code=((p&&(p.ui||p.reads))||(navigator.languages||[])[0]||navigator.language||"en")}catch(e){code=navigator.language||"en"}
code=String(code).toLowerCase().split("-")[0];d.setAttribute("data-splash",${JSON.stringify(codes)}.indexOf(code)<0?"en":code);
var el=document.getElementById("splash");if(el)el.onclick=function(){d.classList.add("splash-skip");setTimeout(done,${FADE_MS})};
setTimeout(done,${SHOW_MS + FADE_MS});})();`;
  return (
    <>
      <div id="splash" className="splash" aria-hidden="true">
        <div className="splash-card">
          <svg viewBox="0 0 48 48" width="112" height="112">
            <g className="splash-bubble left">
              <path d="M17 7h3c7.2 0 13 5.4 13 12s-5.8 12-13 12h-2.5l-6.5 5.5V30A12 12 0 0 1 4 19C4 12.4 9.8 7 17 7z" fill={BRAND.blue} />
            </g>
            <g className="splash-bubble right">
              <path d="M28 15h3c7.2 0 13 5.4 13 12a12 12 0 0 1-7 10.9v5.6L30.5 39H28c-7.2 0-13-5.4-13-12s5.8-12 13-12z" fill={BRAND.mint} fillOpacity="0.88" />
            </g>
          </svg>
          <span className="splash-name">{BRAND.appName.toLowerCase()}</span>
        </div>
        {codes.map((c) => (
          <p key={c} className="splash-slogan" data-l={c} lang={c} dir={/^(ar|ur|he|fa)$/.test(c) ? "rtl" : undefined}>
            {all[c].map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </p>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
