"""Position GPS de livraison : facultative, vérifiée au Niger, itinéraire exact."""

import pytest

from app.core.exceptions import ValidationDomainError
from app.services import delivery_position


def test_no_position_is_fine() -> None:
    assert delivery_position.checked(None, None) == (None, None)
    assert delivery_position.directions_url(None, None) is None


def test_position_in_niamey_is_kept_and_rounded() -> None:
    assert delivery_position.checked(13.5137123456, 2.1098123456) == (13.513712, 2.109812)
    assert delivery_position.directions_url(13.513712, 2.109812) == "https://www.google.com/maps/dir/?api=1&destination=13.513712,2.109812"


@pytest.mark.parametrize("lat,lng", [(48.85, 2.35), (13.51, None), (None, 2.1), (0.0, 0.0)])
def test_position_outside_niger_or_incomplete_is_refused(lat, lng) -> None:
    with pytest.raises(ValidationDomainError):
        delivery_position.checked(lat, lng)
