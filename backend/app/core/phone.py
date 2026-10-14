"""Numeros de telephone / WhatsApp internationaux, au format E.164 (+<indicatif><numero>).

Un numero a 8 chiffres sans indicatif est considere comme nigerien (+227), le marche principal.
Les autres pays doivent saisir leur indicatif (+33..., 00221...).
"""

import re

DEFAULT_DIAL_CODE = "227"
_SEPARATORS = re.compile(r"[\s\-.()/]")


def normalize_phone(raw: str | None) -> str | None:
    """Retourne « +<chiffres> » ou None si le numero est invalide."""
    if not raw:
        return None
    compact = _SEPARATORS.sub("", raw.strip())
    if compact.startswith("+"):
        digits = compact[1:]
    elif compact.startswith("00"):
        digits = compact[2:]
    else:
        digits = compact
        if len(digits) == 8:
            digits = DEFAULT_DIAL_CODE + digits
        elif not (digits.startswith(DEFAULT_DIAL_CODE) and len(digits) == 11):
            return None  # numero local etranger sans indicatif : ambigu
    if not digits.isdigit() or not 8 <= len(digits) <= 15 or digits.startswith("0"):
        return None
    if digits.startswith(DEFAULT_DIAL_CODE) and len(digits) != 11:
        return None
    return f"+{digits}"


def looks_like_phone(value: str) -> bool:
    return "@" not in value and normalize_phone(value) is not None
