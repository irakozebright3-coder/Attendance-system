// The 3D needle watch shown in the landing hero.
//
// An analogue watch built from layered CSS 3D: a thick case, bezel, dial with
// hour markers, three needles (hour, minute, second) that show the real time,
// a domed glass highlight, a crown and lugs. It tilts toward the pointer and
// settles gently. Touch devices and "reduce motion" get a still, readable watch.

const NS = "af-watch";

// 12 hour markers: the four quarter hours are longer.
function markers() {
  let out = "";
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    const quarter = i % 15 === 0;
    const cls = quarter ? NS + "-tick is-quarter" : hour ? NS + "-tick is-hour" : NS + "-tick";
    out += '<i class="' + cls + '" style="--a:' + i * 6 + 'deg"></i>';
  }
  return out;
}

function numerals() {
  const marks = [[12, 0], [3, 90], [6, 180], [9, 270]];
  return marks
    .map(([n, a]) => '<b class="' + NS + '-num" style="--a:' + a + 'deg">' + n + "</b>")
    .join("");
}

/** Markup for the watch. aria-hidden: it is decorative, the page text carries the meaning. */
export function watchMarkup() {
  return (
    '<div class="' + NS + '-scene" aria-hidden="true">' +
      '<div class="' + NS + '-shadow"></div>' +
      '<div class="' + NS + '" data-watch>' +
        // strap, behind the case
        '<div class="' + NS + '-strap is-top"></div>' +
        '<div class="' + NS + '-strap is-bottom"></div>' +
        // lugs that hold the strap
        '<i class="' + NS + '-lug lug-tl"></i><i class="' + NS + '-lug lug-tr"></i>' +
        '<i class="' + NS + '-lug lug-bl"></i><i class="' + NS + '-lug lug-br"></i>' +
        // crown on the right side
        '<div class="' + NS + '-crown"></div>' +
        // stacked layers give the case real thickness
        '<div class="' + NS + '-layer l1"></div>' +
        '<div class="' + NS + '-layer l2"></div>' +
        '<div class="' + NS + '-layer l3"></div>' +
        '<div class="' + NS + '-layer l4"></div>' +
        '<div class="' + NS + '-bezel">' +
          '<div class="' + NS + '-dial">' +
            markers() +
            numerals() +
            '<span class="' + NS + '-brand">ATTENDANCEFLOW</span>' +
            '<span class="' + NS + '-sub">LIVE · SYNCED</span>' +
            '<i class="' + NS + '-needle is-hour" data-hand="hour"></i>' +
            '<i class="' + NS + '-needle is-minute" data-hand="minute"></i>' +
            '<i class="' + NS + '-needle is-second" data-hand="second"><u></u></i>' +
            '<i class="' + NS + '-pin"></i>' +
          "</div>" +
          '<div class="' + NS + '-glass"></div>' +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

/** Needle angles in degrees for a given moment. Exported so it can be tested. */
export function handAngles(date) {
  const ms = date.getMilliseconds();
  const s = date.getSeconds() + ms / 1000;
  const m = date.getMinutes() + s / 60;
  const h = (date.getHours() % 12) + m / 60;
  return { hour: h * 30, minute: m * 6, second: s * 6 };
}

function setHands(root, date) {
  const a = handAngles(date);
  root.style.setProperty("--hour", a.hour.toFixed(2) + "deg");
  root.style.setProperty("--minute", a.minute.toFixed(2) + "deg");
  root.style.setProperty("--second", a.second.toFixed(2) + "deg");
}

/**
 * Start the clock and the pointer tilt. Safe to call more than once: it binds a
 * given watch only once, and stops its own timers if the watch leaves the page.
 */
export function bindWatch() {
  const watch = document.querySelector("[data-watch]");
  if (!watch || watch.dataset.watchBound === "1") return;
  watch.dataset.watchBound = "1";

  const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const coarse = matchMedia("(pointer:coarse)").matches;

  setHands(watch, new Date());

  // Smooth sweep for the second hand; a once-per-second tick when motion is reduced.
  let frame = 0;
  let timer = 0;
  const tick = () => {
    if (!document.body.contains(watch)) { cancelAnimationFrame(frame); clearTimeout(timer); return; }
    setHands(watch, new Date());
    if (reduce) timer = setTimeout(tick, 1000);
    else frame = requestAnimationFrame(tick);
  };
  tick();

  if (reduce || coarse) return;

  // Pointer tilt, driven across the whole hero so it feels connected.
  const stage = watch.closest(".hero-stage") || watch.parentElement;
  const scene = watch.closest("." + NS + "-scene");
  const reset = () => {
    scene.style.setProperty("--tilt-x", "0deg");
    scene.style.setProperty("--tilt-y", "0deg");
  };
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    scene.style.setProperty("--tilt-y", (px * 26).toFixed(2) + "deg");
    scene.style.setProperty("--tilt-x", (-py * 20).toFixed(2) + "deg");
  });
  stage.addEventListener("pointerleave", reset);
  reset();
}
