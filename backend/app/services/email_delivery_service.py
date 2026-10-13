"""Envoi d'e-mails transactionnels par SMTP (bibliotheque standard, aucun service impose).

Compatible avec tout fournisseur SMTP (Brevo, Resend, Gmail Workspace, etc.).
Tant que SMTP_HOST et SMTP_FROM ne sont pas definis, rien n'est envoye et
`send_email` retourne False : un message n'est jamais presente comme envoye
s'il ne l'a pas ete.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.config import get_settings

logger = logging.getLogger(__name__)


def email_delivery_configured() -> bool:
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_from)


def send_email(to_address: str, subject: str, text_body: str) -> bool:
    settings = get_settings()
    if not email_delivery_configured():
        logger.warning("SMTP non configure : e-mail non envoye (%s).", subject)
        return False

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(text_body)

    context = ssl.create_default_context()
    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(
                settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds, context=context
            ) as server:
                _login_and_send(server, message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=settings.smtp_timeout_seconds) as server:
                server.starttls(context=context)
                _login_and_send(server, message)
    except (smtplib.SMTPException, OSError) as exc:
        logger.warning("Echec d'envoi SMTP (%s) : %s", subject, exc.__class__.__name__)
        return False
    return True


def _login_and_send(server: smtplib.SMTP, message: EmailMessage) -> None:
    settings = get_settings()
    if settings.smtp_username and settings.smtp_password:
        server.login(settings.smtp_username, settings.smtp_password)
    server.send_message(message)


def send_verification_code_email(to_address: str, code: str, *, purpose: str) -> bool:
    ttl = get_settings().verification_code_ttl_minutes
    if purpose == "reset":
        subject = "AMAZER — Reinitialisation de votre mot de passe"
        intro = "Vous avez demande a reinitialiser votre mot de passe AMAZER."
        outro = "Si vous n'etes pas a l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchange."
    else:
        subject = "AMAZER — Code de verification de votre compte"
        intro = "Bienvenue sur AMAZER. Voici le code pour verifier votre compte."
        outro = "Si vous n'avez pas cree de compte AMAZER, ignorez cet e-mail."
    body = (
        f"Bonjour,\n\n{intro}\n\n"
        f"Votre code : {code}\n\n"
        f"Il est valable {ttl} minutes et ne doit etre communique a personne, "
        "pas meme a l'equipe AMAZER.\n\n"
        f"{outro}\n\n— L'equipe AMAZER\nhttps://amazer.store\n"
    )
    return send_email(to_address, subject, body)
