from __future__ import annotations

from io import BytesIO
import logging
import smtplib
from email.message import EmailMessage

import qrcode

from app.config import get_settings

logger = logging.getLogger("amazer.notification")
settings = get_settings()


def _build_qr_png(payload: str) -> bytes:
    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _send_email(
    recipient: str,
    subject: str,
    message: str,
    *,
    qr_payload: str | None = None,
    qr_filename: str = "amazer-receipt-qr.png",
) -> bool:
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning("EMAIL_NOT_CONFIGURED recipient=%s subject=%s", recipient, subject)
        return False

    try:
        email = EmailMessage()
        email["Subject"] = subject
        email["From"] = settings.smtp_from_email
        email["To"] = recipient
        email.set_content(message)
        if qr_payload:
            email.add_attachment(
                _build_qr_png(qr_payload),
                maintype="image",
                subtype="png",
                filename=qr_filename,
            )

        if settings.smtp_use_starttls:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                smtp.starttls()
                if settings.smtp_username and settings.smtp_password:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(email)
        else:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                if settings.smtp_username and settings.smtp_password:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(email)
        return True
    except Exception as exc:
        logger.warning("EMAIL_SEND_FAILED recipient=%s error=%s", recipient, exc)
        return False


def send_login_verification_code(*, destination: str, code: str) -> bool:
    message = f"Votre code de connexion AMAZER est {code}. Ce code expire dans 5 minutes."
    return _send_email(destination, "Code de connexion AMAZER", message)


def send_payment_confirmation(
    *,
    recipient: str,
    order_id: str,
    amount: float,
    channel: str = "email",
    receipt_url: str | None = None,
    qr_payload: str | None = None,
) -> None:
    if channel != "email":
        logger.warning("PAYMENT_CONFIRMATION_UNSUPPORTED_CHANNEL channel=%s order_id=%s", channel, order_id)
        return

    receipt_line = f"Recu securise: {receipt_url}" if receipt_url else "Recu securise: indisponible"
    message = (
        "Paiement confirme sur AMAZER.\n\n"
        f"Commande: {order_id}\n"
        f"Montant: {amount:.0f} XOF\n"
        f"{receipt_line}\n\n"
        "Le QR Code de verification est joint a cet e-mail."
    )
    delivered = _send_email(
        recipient,
        "AMAZER - Recu de paiement securise",
        message,
        qr_payload=qr_payload,
        qr_filename=f"amazer-receipt-{order_id}.png",
    )
    if delivered:
        logger.info("PAYMENT_CONFIRMATION_SENT recipient=%s order_id=%s", recipient, order_id)
    else:
        logger.warning("PAYMENT_CONFIRMATION_FAILED recipient=%s order_id=%s", recipient, order_id)
