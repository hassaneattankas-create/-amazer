"""Position GPS de livraison donnée par le client (bouton « Ma position » du panier ou de la commande de repas).

Les adresses de Niamey se décrivent par des repères : la position exacte évite au livreur de chercher.
"""

from __future__ import annotations

from app.core.exceptions import ValidationDomainError
from app.services import local_services as svc

POSITION_ERROR = (
    "Cette position n'est pas au Niger. Touchez « Utiliser ma position » une fois sur place, "
    "ou laissez seulement l'adresse et le repère."
)


def checked(latitude: float | None, longitude: float | None) -> tuple[float, float] | tuple[None, None]:
    """(lat, lng) arrondis si la position est donnée et plausible au Niger ; (None, None) sans position."""
    if latitude is None and longitude is None:
        return None, None
    if latitude is None or longitude is None or not svc.valid_position(latitude, longitude):
        raise ValidationDomainError(POSITION_ERROR)
    return round(latitude, 6), round(longitude, 6)


def directions_url(latitude: float | None, longitude: float | None) -> str | None:
    """Itinéraire Google Maps jusqu'à la position exacte du client."""
    if latitude is None or longitude is None:
        return None
    return f"https://www.google.com/maps/dir/?api=1&destination={latitude:.6f},{longitude:.6f}"
