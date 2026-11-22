"""Prix des compagnies de transport : abonnement par lignes, commission par billet, au choix de l'admin."""

from types import SimpleNamespace

from app.services import transport_pricing as tp

SETTINGS = SimpleNamespace(
    transport_base_subscription=15000,
    transport_included_lines=5,
    transport_extra_line_price=1000,
    transport_ticket_commission_percent=8,
)


def company(lines: int, mode: str = "subscription", own: float | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        offers_transport=True,
        activity_type="enterprise",
        billing_mode=mode,
        ticket_commission_percent=own,
        room_types=[{"id": f"t{i}"} for i in range(lines)],
    )


def test_subscription_includes_five_lines_then_1000_per_line() -> None:
    assert tp.subscription_fee(SETTINGS, company(3)) == 15000
    assert tp.subscription_fee(SETTINGS, company(5)) == 15000
    assert tp.subscription_fee(SETTINGS, company(12)) == 22000


def test_commission_only_has_no_subscription() -> None:
    profile = company(12, "commission")
    assert tp.subscription_fee(SETTINGS, profile) == 0
    assert tp.commission_percent(SETTINGS, profile) == 8


def test_both_modes_and_own_rate() -> None:
    profile = company(6, "both", own=5)
    assert tp.subscription_fee(SETTINGS, profile) == 16000
    assert tp.commission_percent(SETTINGS, profile) == 5


def test_subscription_only_takes_no_commission() -> None:
    assert tp.commission_percent(SETTINGS, company(2, "subscription", own=12)) == 0


def test_unknown_mode_falls_back_to_subscription() -> None:
    assert tp.billing_mode(company(1, "bizarre")) == "subscription"
