from app.services.ranking_service import RankingService


def test_lower_price_gets_higher_score() -> None:
    service = RankingService()
    cheaper = service.score_offer(
        amount=10.0,
        min_amount=10.0,
        max_amount=50.0,
        stock_quantity=50,
        text_relevance=0.5,
        vendor_is_active=True,
    )
    expensive = service.score_offer(
        amount=50.0,
        min_amount=10.0,
        max_amount=50.0,
        stock_quantity=50,
        text_relevance=0.5,
        vendor_is_active=True,
    )
    assert cheaper.score_total > expensive.score_total


def test_out_of_stock_is_penalized() -> None:
    service = RankingService()
    in_stock = service.score_offer(
        amount=20.0,
        min_amount=20.0,
        max_amount=40.0,
        stock_quantity=80,
        text_relevance=0.6,
        vendor_is_active=True,
    )
    out_of_stock = service.score_offer(
        amount=20.0,
        min_amount=20.0,
        max_amount=40.0,
        stock_quantity=0,
        text_relevance=0.6,
        vendor_is_active=True,
    )
    assert in_stock.score_total > out_of_stock.score_total
