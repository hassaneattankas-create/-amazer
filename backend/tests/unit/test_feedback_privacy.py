"""Avis publics : l'e-mail et le compte de l'auteur ne sont jamais exposes."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

from app.routes import feedback as route


def test_public_feedback_hides_email_and_account() -> None:
    row = SimpleNamespace(id="f1", user_id="u1", full_name="Awa", email="awa@example.test", message="Très bien", rating=5, created_at=datetime.now(UTC))
    db = Mock()
    db.scalars.return_value = SimpleNamespace(all=lambda: [row])
    [item] = route.list_feedback(db, 60)
    assert item.email is None and item.user_id is None and item.full_name == "Awa"
