"""Taux de change d'affichage (prix indicatifs dans la devise du visiteur ; paiement en XOF)."""

import json
import logging
from datetime import UTC, datetime
from urllib import request

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.cache import cache_get_json, cache_set_json
from app.core.locale import SUPPORTED_CURRENCIES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/locale", tags=["locale"])

CACHE_KEY = "locale:exchange-rates:v1"
CACHE_TTL_SECONDS = 6 * 3600
RATES_URL = "https://open.er-api.com/v6/latest/XOF"
# Parites fixes officielles (franc CFA) : toujours exactes, meme si le service de taux est indisponible.
FIXED_RATES = {"XOF": 1.0, "XAF": 1.0, "EUR": 1 / 655.957}


class ExchangeRatesResponse(BaseModel):
    base: str = "XOF"
    rates: dict[str, float]
    updated_at: str | None = None
    source: str


def _fetch_live_rates() -> tuple[dict[str, float], str | None]:
    with request.urlopen(RATES_URL, timeout=8) as response:  # noqa: S310 - URL fixe en https
        data = json.loads(response.read().decode("utf-8"))
    if data.get("result") != "success":
        raise ValueError("reponse invalide")
    raw = data.get("rates") or {}
    rates = {code: float(raw[code]) for code in SUPPORTED_CURRENCIES if isinstance(raw.get(code), (int, float))}
    return rates, data.get("time_last_update_utc")


def build_rates() -> ExchangeRatesResponse:
    try:
        live, updated_at = _fetch_live_rates()
        return ExchangeRatesResponse(rates={**live, **FIXED_RATES}, updated_at=updated_at, source="open.er-api.com")
    except Exception as exc:  # noqa: BLE001 - reseau : on garde les parites fixes
        logger.warning("Taux de change indisponibles : %s", exc.__class__.__name__)
        return ExchangeRatesResponse(
            rates=dict(FIXED_RATES), updated_at=datetime.now(UTC).isoformat(), source="parites-fixes"
        )


@router.get("/exchange-rates", response_model=ExchangeRatesResponse)
def exchange_rates() -> ExchangeRatesResponse:
    cached = cache_get_json(CACHE_KEY)
    if isinstance(cached, dict):
        return ExchangeRatesResponse(**cached)
    result = build_rates()
    # Echec reseau : cache court pour reessayer bientot.
    cache_set_json(CACHE_KEY, result.model_dump(), CACHE_TTL_SECONDS if result.source != "parites-fixes" else 600)
    return result
