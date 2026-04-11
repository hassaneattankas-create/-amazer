from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models.app_notification import AppNotification
from app.models.notification import NotificationToken


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

  def create_notification(
    self,
    *,
    user_id: str,
    payload: NotificationPayload,
    tag: str,
    href: str | None = None,
  ) -> AppNotification:
    row = AppNotification(
      user_id=user_id,
      title=payload.title,
      body=payload.body,
      tag=tag,
      href=href,
      data=payload.data or None,
      unread=True,
    )
    self.db.add(row)
    self.db.flush()
    return row

  def list_notifications_for_user(self, user_id: str, *, limit: int = 100) -> list[AppNotification]:
    rows = self.db.scalars(
      select(AppNotification)
      .where(AppNotification.user_id == user_id)
      .order_by(AppNotification.created_at.desc())
      .limit(max(1, min(limit, 500)))
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
    tokens = self.list_tokens_for_user(user_id)
    if not tokens:
      return
    # In production, integrate with FCM/APNS here.
    # For now, we simply log the intent; this keeps the system opt-in and ready.
    details = {
      "user_id": user_id,
      "device_tokens": [row.device_token for row in tokens],
      "title": payload.title,
      "body": payload.body,
      "data": payload.data or {},
    }
    # Deferred to existing logging pipeline; avoids side-effects in tests.
    print(f"[notification] {details}")

