"""Messagerie client <-> boutique : seuls les deux participants accedent a la conversation."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.core.exceptions import NotFoundError, ValidationDomainError
from app.models.conversation import Conversation, ConversationMessage
from app.routes import conversations as route
from app.schemas.conversation import ConversationReportRequest, ConversationStartRequest, MessageCreateRequest


def _user(user_id: str, name: str = "Utilisateur") -> SimpleNamespace:
    return SimpleNamespace(id=user_id, full_name=name, email=f"{user_id}@example.test")


CUSTOMER = _user("client-1", "Awa")
SELLER = _user("seller-1", "Moussa")
STRANGER = _user("intrus-1", "Intrus")


def _request() -> SimpleNamespace:
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), url=SimpleNamespace(path="/conversations"), headers={})


def _conversation() -> Conversation:
    conversation = Conversation(id="conv-1", customer_user_id="client-1", vendor_id="vendor-1")
    conversation.last_message_at = datetime.now(UTC)
    conversation.messages = [
        ConversationMessage(id="m1", sender_user_id="client-1", body="Bonjour, avez-vous du stock ?", created_at=datetime.now(UTC)),
        ConversationMessage(id="m2", sender_user_id="seller-1", body="Oui, 3 pieces.", created_at=datetime.now(UTC)),
    ]
    return conversation


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    monkeypatch.setattr(route, "enforce_csrf", lambda _r: None)
    monkeypatch.setattr(route, "enforce_rate_limit", lambda *a, **k: None)
    monkeypatch.setattr(route, "_counterpart_name", lambda _db, _c, role: "Boutique" if role == "customer" else "Awa")
    monkeypatch.setattr(route, "_unread_count", lambda _db, _cid, _u: 0)
    sent: list[dict] = []
    monkeypatch.setattr(route, "_notify", lambda _db, **kwargs: sent.append(kwargs))
    return sent


def _db(*, conversation=None, own_vendor=None, seller_user="seller-1", vendor=None) -> Mock:
    db = Mock()
    db.get.side_effect = lambda model, _id: conversation if model is Conversation else vendor

    def _scalar(query):
        text = str(query)
        if "seller_profiles.vendor_id" in text and "seller_profiles.user_id =" in text:
            return own_vendor
        if "seller_profiles.user_id" in text:
            return seller_user
        if "FROM conversations" in text:
            return None
        return None

    db.scalar.side_effect = _scalar

    def _refresh(obj) -> None:
        # Comme la base : identifiants et dates attribues a l'enregistrement.
        obj.id = obj.id or "conv-new"
        obj.last_message_at = obj.last_message_at or datetime.now(UTC)
        for index, message in enumerate(obj.messages):
            message.id = message.id or f"m-new-{index}"
            message.created_at = message.created_at or datetime.now(UTC)

    db.refresh.side_effect = _refresh
    return db


# --- Acces -----------------------------------------------------------------------------

def test_customer_reads_own_conversation_and_marks_seller_messages_read() -> None:
    conversation = _conversation()
    detail = route.get_conversation("conv-1", _db(conversation=conversation), CUSTOMER)
    assert detail.role == "customer"
    assert [m.is_mine for m in detail.messages] == [True, False]
    assert conversation.messages[1].read_at is not None  # message du vendeur lu
    assert conversation.messages[0].read_at is None  # son propre message n'est pas "lu" par lui-meme


def test_seller_of_the_shop_reads_conversation() -> None:
    detail = route.get_conversation("conv-1", _db(conversation=_conversation(), own_vendor="vendor-1"), SELLER)
    assert detail.role == "seller"


@pytest.mark.parametrize("own_vendor", [None, "vendor-AUTRE"])
def test_stranger_or_other_seller_gets_404(own_vendor) -> None:
    with pytest.raises(NotFoundError):
        route.get_conversation("conv-1", _db(conversation=_conversation(), own_vendor=own_vendor), STRANGER)


def test_stranger_cannot_post_or_report(_isolate) -> None:
    db = _db(conversation=_conversation())
    with pytest.raises(NotFoundError):
        route.send_message("conv-1", MessageCreateRequest(body="spam"), _request(), db, STRANGER)
    with pytest.raises(NotFoundError):
        route.report_conversation("conv-1", ConversationReportRequest(reason="test"), _request(), db, STRANGER)
    assert _isolate == []


# --- Envoi -----------------------------------------------------------------------------

def test_start_conversation_with_shop_notifies_seller(_isolate) -> None:
    vendor = SimpleNamespace(id="vendor-1", is_active=True, name="Boutique")
    db = _db(vendor=vendor)

    detail = route.start_conversation(
        ConversationStartRequest(vendor_id="vendor-1", body="Bonjour !"), _request(), db, CUSTOMER
    )

    created = db.add.call_args.args[0]
    assert created.customer_user_id == "client-1" and created.vendor_id == "vendor-1"
    assert created.last_message_preview == "Bonjour !"
    assert detail.messages[-1].body == "Bonjour !"
    assert _isolate[0]["user_id"] == "seller-1"


def test_seller_cannot_message_own_shop() -> None:
    vendor = SimpleNamespace(id="vendor-1", is_active=True, name="Boutique")
    with pytest.raises(ValidationDomainError):
        route.start_conversation(
            ConversationStartRequest(vendor_id="vendor-1", body="test"),
            _request(),
            _db(vendor=vendor, own_vendor="vendor-1"),
            SELLER,
        )


def test_inactive_shop_cannot_be_contacted() -> None:
    vendor = SimpleNamespace(id="vendor-1", is_active=False, name="Boutique")
    with pytest.raises(NotFoundError):
        route.start_conversation(
            ConversationStartRequest(vendor_id="vendor-1", body="test"), _request(), _db(vendor=vendor), CUSTOMER
        )


def test_seller_reply_notifies_customer(_isolate) -> None:
    conversation = _conversation()
    route.send_message("conv-1", MessageCreateRequest(body="Livraison demain"), _request(),
                       _db(conversation=conversation, own_vendor="vendor-1"), SELLER)
    assert conversation.messages[-1].sender_user_id == "seller-1"
    assert conversation.last_message_preview == "Livraison demain"
    assert _isolate[0]["user_id"] == "client-1"


def test_message_length_is_bounded() -> None:
    with pytest.raises(ValueError):
        MessageCreateRequest(body="x" * 2001)
    with pytest.raises(ValueError):
        MessageCreateRequest(body="   ")


def test_preview_is_truncated() -> None:
    conversation = _conversation()
    route._append_message(conversation, CUSTOMER, "a" * 500)
    assert len(conversation.last_message_preview) == route.PREVIEW_LENGTH


# --- Signalement ---------------------------------------------------------------------------

def test_participant_report_is_audited(monkeypatch, _isolate) -> None:
    audit: list[dict] = []
    monkeypatch.setattr(route, "append_audit_log", lambda *a, **k: audit.append(k))
    db = _db(conversation=_conversation())
    db.scalars.return_value.all.return_value = [_user("admin-1")]

    route.report_conversation("conv-1", ConversationReportRequest(reason="Propos insultants"), _request(), db, CUSTOMER)

    assert audit[0]["event_type"] == "conversation_reported"
    assert audit[0]["details"]["reason"] == "Propos insultants"
    assert _isolate[0]["user_id"] == "admin-1" and _isolate[0]["href"] == "/admin"
