"""Messagerie privee client <-> boutique.

Regles d'acces (verifiees cote serveur a chaque appel) :
- une conversation n'est visible que par son client et par le vendeur de la boutique ;
- tout autre utilisateur recoit 404 (on ne revele pas l'existence de la conversation) ;
- un vendeur ne peut pas ouvrir de conversation avec sa propre boutique.
"""


import logging
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.csrf import enforce_csrf
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundError, ValidationDomainError
from app.core.permissions import ROLE_ADMIN
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.database import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.models.seller_profile import SellerProfile
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.conversation import (
    ConversationDetailResponse,
    ConversationReportRequest,
    ConversationStartRequest,
    ConversationSummaryResponse,
    MessageCreateRequest,
    MessageResponse,
)
from app.services.audit_log_service import append_audit_log
from app.services.notification_service import NotificationPayload, NotificationService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conversations", tags=["conversations"])

Role = Literal["customer", "seller"]
PREVIEW_LENGTH = 160
MAX_MESSAGES_RETURNED = 200


def _own_vendor_id(db: Session, user: User) -> str | None:
    return db.scalar(select(SellerProfile.vendor_id).where(SellerProfile.user_id == user.id))


def _role_in(conversation: Conversation, user: User, own_vendor_id: str | None) -> Role:
    if conversation.customer_user_id == user.id:
        return "customer"
    if own_vendor_id is not None and conversation.vendor_id == own_vendor_id:
        return "seller"
    raise NotFoundError("Conversation introuvable")


def _load_for_participant(db: Session, conversation_id: str, user: User) -> tuple[Conversation, Role]:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise NotFoundError("Conversation introuvable")
    return conversation, _role_in(conversation, user, _own_vendor_id(db, user))


def _append_message(conversation: Conversation, sender: User, body: str) -> ConversationMessage:
    message = ConversationMessage(sender_user_id=sender.id, body=body)
    conversation.messages.append(message)
    conversation.last_message_at = datetime.now(UTC)
    conversation.last_message_preview = body[:PREVIEW_LENGTH]
    return message


def _notify(
    db: Session, *, user_id: str | None, title: str, body: str, conversation_id: str, href: str | None = None
) -> None:
    """Notification dans l'application ; un echec ne doit jamais annuler le message deja enregistre."""
    if not user_id:
        return
    try:
        NotificationService(db).send_to_user(
            user_id=user_id,
            payload=NotificationPayload(
                title=title,
                body=body[:180],
                data={
                    "tag": f"conversation-{conversation_id}",
                    "href": href or f"/messages?c={conversation_id}",
                    "kind": "message",
                },
            ),
        )
    except Exception:  # pragma: no cover - depend du canal de notification
        logger.exception("Notification de message non envoyee (conversation %s)", conversation_id)
        db.rollback()


def _seller_user_id(db: Session, vendor_id: str) -> str | None:
    return db.scalar(select(SellerProfile.user_id).where(SellerProfile.vendor_id == vendor_id))


def _counterpart_name(db: Session, conversation: Conversation, role: Role) -> str:
    if role == "customer":
        vendor = db.get(Vendor, conversation.vendor_id)
        return vendor.name if vendor is not None else "Boutique"
    customer = db.get(User, conversation.customer_user_id)
    return customer.full_name if customer is not None and customer.full_name else "Client AMAZER"


def _unread_count(db: Session, conversation_id: str, user: User) -> int:
    return int(
        db.scalar(
            select(func.count(ConversationMessage.id)).where(
                ConversationMessage.conversation_id == conversation_id,
                ConversationMessage.sender_user_id != user.id,
                ConversationMessage.read_at.is_(None),
            )
        )
        or 0
    )


def _summary(db: Session, conversation: Conversation, role: Role, user: User) -> ConversationSummaryResponse:
    return ConversationSummaryResponse(
        id=conversation.id,
        vendor_id=conversation.vendor_id,
        counterpart_name=_counterpart_name(db, conversation, role),
        role=role,
        last_message=conversation.last_message_preview,
        last_message_at=conversation.last_message_at,
        unread_count=_unread_count(db, conversation.id, user),
    )


def _detail(db: Session, conversation: Conversation, role: Role, user: User) -> ConversationDetailResponse:
    summary = _summary(db, conversation, role, user)
    messages = conversation.messages[-MAX_MESSAGES_RETURNED:]
    return ConversationDetailResponse(
        **summary.model_dump(),
        messages=[
            MessageResponse(
                id=message.id,
                body=message.body,
                created_at=message.created_at,
                is_mine=message.sender_user_id == user.id,
                read=message.read_at is not None,
            )
            for message in messages
        ],
    )


@router.post("", response_model=ConversationDetailResponse, status_code=status.HTTP_201_CREATED)
def start_conversation(
    payload: ConversationStartRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConversationDetailResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="conversation_start", limit=10, window_seconds=600)
    vendor = db.get(Vendor, payload.vendor_id)
    if vendor is None or not vendor.is_active:
        raise NotFoundError("Boutique introuvable")
    if _own_vendor_id(db, current_user) == vendor.id:
        raise ValidationDomainError("Vous ne pouvez pas ecrire a votre propre boutique.")

    conversation = db.scalar(
        select(Conversation).where(
            Conversation.customer_user_id == current_user.id, Conversation.vendor_id == vendor.id
        )
    )
    if conversation is None:
        conversation = Conversation(customer_user_id=current_user.id, vendor_id=vendor.id)
        db.add(conversation)
    _append_message(conversation, current_user, payload.body)
    db.commit()
    db.refresh(conversation)

    _notify(
        db,
        user_id=_seller_user_id(db, vendor.id),
        title=f"Nouveau message de {current_user.full_name or 'un client'}",
        body=payload.body,
        conversation_id=conversation.id,
    )
    return _detail(db, conversation, "customer", current_user)


@router.get("", response_model=list[ConversationSummaryResponse])
def list_conversations(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ConversationSummaryResponse]:
    own_vendor_id = _own_vendor_id(db, current_user)
    filters = [Conversation.customer_user_id == current_user.id]
    if own_vendor_id is not None:
        filters.append(Conversation.vendor_id == own_vendor_id)
    rows = db.scalars(
        select(Conversation).where(or_(*filters)).order_by(Conversation.last_message_at.desc()).limit(50)
    ).all()
    return [_summary(db, row, _role_in(row, current_user, own_vendor_id), current_user) for row in rows]


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConversationDetailResponse:
    conversation, role = _load_for_participant(db, conversation_id, current_user)
    now = datetime.now(UTC)
    changed = False
    for message in conversation.messages:
        if message.sender_user_id != current_user.id and message.read_at is None:
            message.read_at = now
            changed = True
    if changed:
        db.commit()
        db.refresh(conversation)
    return _detail(db, conversation, role, current_user)


@router.post("/{conversation_id}/messages", response_model=ConversationDetailResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: str,
    payload: MessageCreateRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ConversationDetailResponse:
    enforce_csrf(request)
    enforce_rate_limit(request, key="conversation_message", limit=30, window_seconds=300)
    conversation, role = _load_for_participant(db, conversation_id, current_user)
    _append_message(conversation, current_user, payload.body)
    db.commit()
    db.refresh(conversation)

    if role == "customer":
        recipient = _seller_user_id(db, conversation.vendor_id)
        title = f"Nouveau message de {current_user.full_name or 'un client'}"
    else:
        recipient = conversation.customer_user_id
        title = f"Reponse de {_counterpart_name(db, conversation, 'customer')}"
    _notify(db, user_id=recipient, title=title, body=payload.body, conversation_id=conversation.id)
    return _detail(db, conversation, role, current_user)


@router.post("/{conversation_id}/report", status_code=status.HTTP_204_NO_CONTENT)
def report_conversation(
    conversation_id: str,
    payload: ConversationReportRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Signalement d'abus : trace dans le journal d'audit et alerte des administrateurs."""
    enforce_csrf(request)
    enforce_rate_limit(request, key="conversation_report", limit=5, window_seconds=3600)
    conversation, role = _load_for_participant(db, conversation_id, current_user)
    append_audit_log(
        db,
        event_type="conversation_reported",
        actor=current_user,
        ip_address=client_ip(request),
        path=str(request.url.path),
        entity_type="conversation",
        entity_id=conversation.id,
        details={"role": role, "reason": payload.reason, "vendor_id": conversation.vendor_id},
    )
    db.commit()
    admins = db.scalars(select(User).where(User.role == ROLE_ADMIN, User.is_active.is_(True))).all()
    for admin_user in admins:
        _notify(
            db,
            user_id=admin_user.id,
            title="Conversation signalee",
            body=f"Motif : {payload.reason}",
            conversation_id=conversation.id,
            href="/admin",
        )
