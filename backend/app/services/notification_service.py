from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

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

  def send_to_user(self, *, user_id: str, payload: NotificationPayload) -> None:
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

