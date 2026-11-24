"""Produits numériques : la case du vendeur n'est qu'une demande, AMAZER valide."""

from app.services import digital_products as dp


def test_seller_checkbox_alone_does_not_skip_delivery() -> None:
    specs: dict = {}
    dp.apply_seller_choice(specs, True)
    assert dp.is_requested(specs) and dp.is_pending(specs)
    assert dp.is_digital(specs) is False  # un iPhone coché « numérique » reste livré


def test_admin_validation_makes_it_digital_and_unchecking_resets() -> None:
    specs = {"is_digital": True, "digital_verified": True}
    assert dp.is_digital(specs) and not dp.is_pending(specs)
    dp.apply_seller_choice(specs, False)
    assert specs == {}


def test_old_products_marked_digital_are_pending_again() -> None:
    assert dp.is_pending({"is_digital": True}) and not dp.is_digital({"is_digital": True})
    assert not dp.is_requested({}) and not dp.is_digital(None)
