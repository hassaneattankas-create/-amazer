"""Taux de change : parites CFA exactes, repli si le service externe tombe."""

from app.routes import locale as route


def test_live_rates_keep_exact_cfa_pegs(monkeypatch) -> None:
    monkeypatch.setattr(route, "_fetch_live_rates", lambda: ({"USD": 0.0017, "EUR": 0.0015, "BTC": 1.0}, "hier"))
    result = route.build_rates()
    assert result.rates["USD"] == 0.0017
    assert result.rates["EUR"] == 1 / 655.957  # parite officielle, pas le taux arrondi
    assert result.source == "open.er-api.com"


def test_network_failure_falls_back_to_fixed_pegs(monkeypatch) -> None:
    def boom():
        raise OSError("hors ligne")

    monkeypatch.setattr(route, "_fetch_live_rates", boom)
    result = route.build_rates()
    assert set(result.rates) == {"XOF", "XAF", "EUR"} and result.source == "parites-fixes"
