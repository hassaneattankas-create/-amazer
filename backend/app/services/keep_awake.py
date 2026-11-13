"""Garde le serveur éveillé sur l'offre gratuite de Render, sans service extérieur.

Render endort un service gratuit après 15 min sans requête entrante ; le réveil
prend alors 60 à 90 s pour le premier client. La tâche GitHub « keep-alive »
(toutes les 14 min en théorie) n'est lancée par GitHub que toutes les 4 à 7 h.

Ici, le serveur appelle sa propre adresse publique (RENDER_EXTERNAL_URL, fournie
par Render) toutes les 10 min : la requête repasse par l'entrée de Render et
compte comme une visite. /ping lance aussi les tâches horaires des stations.

La nuit (1 h - 6 h à Niamey, 0 h - 5 h UTC), on le laisse dormir : l'offre
gratuite donne 750 h par mois pour tout le compte Render, et un service éveillé
24 h/24 en consomme jusqu'à 744 h. Le premier passage de la journée le réveille.
"""

from datetime import UTC, datetime
import logging
import os
import threading

import httpx

logger = logging.getLogger(__name__)

_started = False
NIGHT_START_UTC = 0
NIGHT_END_UTC = 5


def _is_night(now: datetime) -> bool:
    return NIGHT_START_UTC <= now.hour < NIGHT_END_UTC


def start_keep_awake_worker(interval_seconds: int = 10 * 60) -> None:
    """Un seul fil par processus ; ne fait rien hors de Render (local, tests)."""
    global _started
    base_url = os.environ.get("RENDER_EXTERNAL_URL", "").rstrip("/")
    if _started or not base_url:
        return
    _started = True

    def loop() -> None:
        stop = threading.Event()
        while not stop.wait(interval_seconds):
            if _is_night(datetime.now(UTC)):
                continue
            try:
                httpx.get(f"{base_url}/ping", timeout=30)
            except Exception:  # noqa: BLE001 - un appel raté ne doit jamais arrêter la boucle
                logger.warning("Réveil automatique : /ping injoignable, nouvel essai dans 10 min.")

    threading.Thread(target=loop, name="keep-awake", daemon=True).start()
