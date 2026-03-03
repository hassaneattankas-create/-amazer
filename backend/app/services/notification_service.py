from __future__ import annotations

import logging

logger = logging.getLogger("amazer.notification")


def send_payment_confirmation(*, recipient: str, order_id: str, amount: float, channel: str = "email") -> None:
    # Placeholder for real provider integration (SMTP/SMS/WhatsApp/API).
    logger.info(
        "PAYMENT_CONFIRMATION channel=%s recipient=%s order_id=%s amount=%.2f",
        channel,
        recipient,
        order_id,
        amount,
    )
