/* toon-film.js — assemble un film à personnages à partir d'un script (window.TOON_SCRIPT) et de la voix off
 * (window.GUIDE_TIMING, écrite par audio/voice.py). Chaque scène commence juste avant sa phrase.
 *
 * TOON_SCRIPT = { id, tenue: 1.6, scenes: [ { type: 'rue_chaleur', vo: 'hook', transition: 'balayage', ...paramètres } ] }
 */
(function (A) {
  const S = window.TOON_SCRIPT, TM = (window.GUIDE_TIMING && window.GUIDE_TIMING.segments) || {};
  const dur = (window.GUIDE_TIMING && window.GUIDE_TIMING.duration) || 30;
  const LEADIN = .25, OVER = .45; // la scène suivante entre en mouvement par-dessus la précédente
  const cues = [];
  const X = { cue: (t, s, g = .6, p = 0) => cues.push({ t: +Math.max(0, t).toFixed(3), s, g, p }) };
  const starts = S.scenes.map((sc, i) => (i === 0 ? 0 : Math.max(0, (TM[sc.vo] ? TM[sc.vo].start : 0) - LEADIN)));
  const end = dur + (S.tenue ?? 1.6);
  const scenes = [], overlays = [];
  S.scenes.forEach((sc, i) => {
    const a = starts[i], b = i + 1 < starts.length ? starts[i + 1] + OVER : end;
    const make = A.TS.scenes[sc.type];
    if (!make) throw new Error('Scène inconnue : ' + sc.type);
    scenes.push(make(sc, a, b, { ...X, vo: TM[sc.vo] }));
    if (sc.transition === 'balayage' && i > 0) overlays.push(A.TS.scenes.balayage({}, a - .3, a + .3, X)); // écran entièrement couvert à l'instant de la coupe
  });
  window.FILM = { id: S.id, duration: +end.toFixed(3), cues, scenes: [...scenes, ...overlays] };
})(window.A);
