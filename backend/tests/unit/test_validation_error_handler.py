"""Non-regression : une erreur de validation doit rester un 422 lisible.

Incident de production du 2026-07-05 sur POST /api/v1/auth/login :

    TypeError: Object of type ValueError is not JSON serializable

Cause : `exc.errors()` de Pydantic v2 place l'exception d'origine dans `ctx`.
`json.dumps` echouait DANS le gestionnaire 422, l'erreur remontait au
gestionnaire generique et le client recevait un 500 opaque a la place d'un
message exploitable.

Second probleme, silencieux celui-la : `errors()` expose aussi `input`, soit la
valeur soumise. Sur une route d'authentification, cela renvoyait le mot de passe
en clair au client et dans les journaux.
"""

import json

import pytest
from pydantic import BaseModel, SecretStr, ValidationError, field_validator

from app.main import _safe_validation_errors


class _LoginLike(BaseModel):
    """Reproduit la forme de LoginRequest : un champ valide, un SecretStr."""

    identifier: str
    password: SecretStr

    @field_validator("identifier")
    @classmethod
    def _check(cls, value: str) -> str:
        if len(value) < 3:
            raise ValueError("identifiant trop court")
        return value


@pytest.fixture
def validation_error() -> ValidationError:
    with pytest.raises(ValidationError) as excinfo:
        _LoginLike(identifier="ab", password="mot-de-passe-tres-secret")
    return excinfo.value


def test_errors_bruts_ne_sont_pas_serialisables(validation_error: ValidationError) -> None:
    """Garde-fou : si Pydantic cessait de mettre l'exception dans `ctx`, ce test
    echouerait et nous dirait que le contournement n'est plus necessaire."""
    with pytest.raises(TypeError, match="not JSON serializable"):
        json.dumps(validation_error.errors())


def test_erreurs_nettoyees_sont_serialisables(validation_error: ValidationError) -> None:
    payload = json.dumps(_safe_validation_errors(validation_error))
    assert "identifiant trop court" in payload


def test_le_mot_de_passe_ne_fuit_jamais(validation_error: ValidationError) -> None:
    payload = json.dumps(_safe_validation_errors(validation_error))
    assert "mot-de-passe-tres-secret" not in payload
    assert all("input" not in err for err in _safe_validation_errors(validation_error))


def test_champs_utiles_conserves(validation_error: ValidationError) -> None:
    errors = _safe_validation_errors(validation_error)
    assert errors, "au moins une erreur attendue"
    first = errors[0]
    # Le client doit pouvoir dire QUEL champ corriger et POURQUOI.
    assert first["loc"] == ("identifier",) or list(first["loc"]) == ["identifier"]
    assert "msg" in first and "type" in first
    assert "url" not in first  # lien de doc Pydantic : inutile au client


def test_ctx_reduit_a_du_texte(validation_error: ValidationError) -> None:
    ctx = _safe_validation_errors(validation_error)[0].get("ctx")
    if ctx is not None:
        assert all(isinstance(v, str) for v in ctx.values())
