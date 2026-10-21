from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.app_notification import AppNotification
from app.models.notification import NotificationToken
from app.models.user import User
from app.models.user_preferences import UserPreferences
from app.services.notification_relay_service import relay_notification
from app.services.push_delivery_service import send_fcm_push


def _fit(value: str, limit: int) -> str:
  value = value or ""
  return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


@dataclass(frozen=True)
class NotificationPayload:
  title: str
  body: str
  data: dict[str, Any] | None = None


class NotificationService:
  def __init__(self, db: Session) -> None:
    self.db = db

  def register_token(self, *, user_id: str, device_token: str) -> NotificationToken:
    token = (
      self.db.scalar(
        select(NotificationToken).where(
          NotificationToken.user_id == user_id,
          NotificationToken.device_token == device_token,
        )
      )
      or NotificationToken(user_id=user_id, device_token=device_token)
    )
    self.db.add(token)
    self.db.flush()
    return token

  def list_tokens_for_user(self, user_id: str) -> list[NotificationToken]:
    rows = self.db.scalars(
      select(NotificationToken).where(NotificationToken.user_id == user_id)
    ).all()
    return list(rows)

  def delete_tokens(self, *, user_id: str, device_tokens: list[str]) -> int:
    if not device_tokens:
      return 0
    result = self.db.execute(
      delete(NotificationToken).where(
        NotificationToken.user_id == user_id,
        NotificationToken.device_token.in_(device_tokens),
      )
    )
    return int(result.rowcount or 0)

  def create_notification(
    self,
    *,
    user_id: str,
    payload: NotificationPayload,
    tag: str,
    href: str | None = None,
  ) -> AppNotification:
    # Les longueurs suivent les colonnes : un texte trop long est raccourci au lieu de faire echouer l'envoi.
    row = AppNotification(
      user_id=user_id,
      title=_fit(payload.title, 160),
      body=_fit(payload.body, 2000),
      tag=_fit(tag, 160),
      href=href if href and len(href) <= 260 else None,
      data=payload.data or None,
      unread=True,
    )
    self.db.add(row)
    self.db.flush()
    return row

  def list_notifications_for_user(
    self, user_id: str, *, limit: int = 100, offset: int = 0
  ) -> list[AppNotification]:
    rows = self.db.scalars(
      select(AppNotification)
      .where(AppNotification.user_id == user_id)
      .order_by(AppNotification.created_at.desc())
      .limit(max(1, min(limit, 200)))
      .offset(max(0, offset))
    ).all()
    return list(rows)

  def mark_notification_read(self, *, user_id: str, notification_id: str) -> bool:
    row = self.db.scalar(
      select(AppNotification).where(
        AppNotification.id == notification_id,
        AppNotification.user_id == user_id,
      )
    )
    if row is None:
      return False
    row.unread = False
    self.db.flush()
    return True

  def mark_all_notifications_read(self, *, user_id: str) -> int:
    result = self.db.execute(
      update(AppNotification)
      .where(AppNotification.user_id == user_id, AppNotification.unread.is_(True))
      .values(unread=False)
    )
    return int(result.rowcount or 0)

  def clear_notifications(self, *, user_id: str) -> int:
    result = self.db.execute(delete(AppNotification).where(AppNotification.user_id == user_id))
    return int(result.rowcount or 0)

  def send_to_user(self, *, user_id: str, payload: NotificationPayload) -> None:
    tag = str((payload.data or {}).get("tag") or f"notif-{user_id}")
    href = (payload.data or {}).get("href")
    if href is not None and not isinstance(href, str):
      href = None
    self.create_notification(user_id=user_id, payload=payload, tag=tag, href=href)
    # Copie par e-mail / WhatsApp pour que l'utilisateur la recoive directement.
    user = self.db.get(User, user_id)
    if user is not None and getattr(user, "is_active", True):
      prefs = self.db.get(UserPreferences, user_id)
      relay_notification(
        user_id=user_id,
        email=getattr(user, "email", None) if getattr(prefs, "notify_email", True) is not False else None,
        phone=getattr(user, "whatsapp_phone", None) if getattr(prefs, "notify_whatsapp", True) is not False else None,
        title=payload.title,
        body=payload.body,
        href=href,
        tag=tag,
      )
    tokens = self.list_tokens_for_user(user_id)
    if not tokens:
      return
    push_result = send_fcm_push(
      device_tokens=[row.device_token for row in tokens],
      title=payload.title,
      body=payload.body,
      data=payload.data or {},
    )
    if push_result.invalid_tokens:
      self.delete_tokens(user_id=user_id, device_tokens=list(push_result.invalid_tokens))
    print(
      f"[notification] user={user_id} title={payload.title!r} "
      f"attempted={push_result.attempted} delivered={push_result.delivered} "
      f"invalid={len(push_result.invalid_tokens)} skipped={push_result.skipped}"
    )
