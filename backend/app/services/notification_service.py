from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

import httpx

from app.config import get_settings

logger = logging.getLogger("amazer.notification")
settings = get_settings()


def send_payment_confirmation(*, recipient: str, order_id: str, amount: float, channel: str = "email") -> None:
    # Placeholder for real provider integration (SMTP/SMS/WhatsApp/API).
    logger.info(
        "PAYMENT_CONFIRMATION channel=%s recipient=%s order_id=%s amount=%.2f",
        channel,
        recipient,
        order_id,
        amount,
    )


def _send_email(recipient: str, subject: str, message: str) -> bool:
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.info("EMAIL_FALLBACK recipient=%s subject=%s message=%s", recipient, subject, message)
        return False

    try:
        email = EmailMessage()
        email["Subject"] = subject
        email["From"] = settings.smtp_from_email
        email["To"] = recipient
        email.set_content(message)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_starttls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(email)
        return True
    except Exception as exc:
        logger.warning("EMAIL_SEND_FAILED recipient=%s error=%s", recipient, exc)
        return False


def _send_sms(phone: str, message: str) -> bool:
    provider = (settings.sms_provider or "none").strip().lower()
    if provider == "twilio":
        if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_from_number:
            logger.warning("TWILIO_NOT_CONFIGURED phone=%s", phone)
            return False
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
            payload = {
                "To": phone,
                "From": settings.twilio_from_number,
                "Body": message,
            }
            with httpx.Client(timeout=15.0) as client:
                response = client.post(
                    url,
                    data=payload,
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                )
                response.raise_for_status()
            return True
        except Exception as exc:
            logger.warning("TWILIO_SEND_FAILED phone=%s error=%s", phone, exc)
            return False

    if provider in {"custom", "webhook"}:
        if not settings.sms_api_url:
            logger.warning("SMS_CUSTOM_NOT_CONFIGURED phone=%s", phone)
            return False
        try:
            headers = {"Content-Type": "application/json"}
            if settings.sms_api_token:
                headers["Authorization"] = f"Bearer {settings.sms_api_token}"
            payload = {"to": phone, "message": message}
            with httpx.Client(timeout=15.0) as client:
                response = client.post(settings.sms_api_url, headers=headers, json=payload)
                response.raise_for_status()
            return True
        except Exception as exc:
            logger.warning("SMS_CUSTOM_SEND_FAILED phone=%s error=%s", phone, exc)
            return False

    logger.info("SMS_PROVIDER_DISABLED phone=%s provider=%s", phone, provider)
    return False


def send_login_verification_code(*, channel: str, destination: str, code: str) -> bool:
    message = f"Votre code de connexion AMAZER est {code}. Ce code expire dans 5 minutes."
    if channel == "sms":
        return _send_sms(destination, message)
    return _send_email(destination, "Code de connexion AMAZER", message)
