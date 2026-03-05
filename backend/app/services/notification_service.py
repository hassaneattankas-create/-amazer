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
    from_email = settings.smtp_from_email or settings.smtp_username
    if not settings.smtp_host or not from_email:
        logger.warning("EMAIL_NOT_CONFIGURED recipient=%s subject=%s", recipient, subject)
        return False

    email = EmailMessage()
    email["Subject"] = subject
    email["From"] = from_email
    email["To"] = recipient
    email.set_content(message)
    if qr_payload:
        email.add_attachment(
            _build_qr_png(qr_payload),
            maintype="image",
            subtype="png",
            filename=qr_filename,
        )

    primary_mode = (settings.smtp_use_starttls, settings.smtp_port)
    fallback_mode = (
        (not settings.smtp_use_starttls),
        465 if settings.smtp_use_starttls else 587,
    )
    attempts = [primary_mode]
    if fallback_mode != primary_mode:
        attempts.append(fallback_mode)

    errors: list[str] = []
    for use_starttls, port in attempts:
        try:
            if use_starttls:
                with smtplib.SMTP(settings.smtp_host, port, timeout=15) as smtp:
                    smtp.starttls()
                    if settings.smtp_username and settings.smtp_password:
                        smtp.login(settings.smtp_username, settings.smtp_password)
                    smtp.send_message(email)
            else:
                with smtplib.SMTP_SSL(settings.smtp_host, port, timeout=15) as smtp:
                    if settings.smtp_username and settings.smtp_password:
                        smtp.login(settings.smtp_username, settings.smtp_password)
                    smtp.send_message(email)
            if (use_starttls, port) != primary_mode:
                logger.info(
                    "EMAIL_SEND_FALLBACK_SUCCESS recipient=%s mode=%s port=%s",
                    recipient,
                    "starttls" if use_starttls else "ssl",
                    port,
                )
            return True
        except Exception as exc:
            errors.append(f"mode={'starttls' if use_starttls else 'ssl'} port={port}: {exc}")

    logger.warning("EMAIL_SEND_FAILED recipient=%s attempts=%s", recipient, " | ".join(errors))
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
