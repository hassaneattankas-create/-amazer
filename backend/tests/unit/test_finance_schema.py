from app.schemas.finance import FinanceSettingsResponse


def test_finance_settings_response_includes_global_tariff_fields() -> None:
    payload = FinanceSettingsResponse(
        commission_rate=0.05,
        service_fee=200,
        default_delivery_fee=1500,
        seller_subscription_fee=5000,
        ad_boost_price=2000,
        ad_boost_duration_days=7,
        urban_delivery_fee=1500,
        peripheral_delivery_fee=2200,
        ad_boost_price_24h=1000,
        ad_boost_price_7d=2000,
        launch_mode_zero_commission=False,
    )
    assert payload.urban_delivery_fee == 1500
    assert payload.peripheral_delivery_fee == 2200
