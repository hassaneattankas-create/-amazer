"""Trusted server-to-server client for the fixed-IP payment gateway."""

from dataclasses import dataclass

import httpx

from app.config import Settings


class PaymentGatewayError(RuntimeError):
    """Raised when the payment gateway cannot complete an operation."""


@dataclass(frozen=True)
class GatewayPayment:
    reference: str
    amount_xof: int
    description: str
    payer_phone: str


def _headers(settings: Settings) -> dict[str, str]:
    if not settings.payment_gateway_url or not settings.payment_gateway_secret:
        raise PaymentGatewayError("Payment gateway is not configured")
    return {"X-Amazer-Gateway-Secret": settings.payment_gateway_secret}


def create_amana_payment(settings: Settings, payment: GatewayPayment) -> str:
    """Start a payment and return Amana's authoritative transaction reference."""
    try:
        response = httpx.post(
            f"{settings.payment_gateway_url.rstrip('/')}/v1/payments",
            headers=_headers(settings),
            json={
                "provider": "amana",
                "reference": payment.reference,
                "amount_xof": payment.amount_xof,
                "description": payment.description,
                "payer_phone": payment.payer_phone,
            },
            timeout=25,
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise PaymentGatewayError("Unable to initialize Amana payment") from exc
    provider_reference = data.get("provider_reference") if isinstance(data, dict) else None
    if not isinstance(provider_reference, str) or not provider_reference.strip():
        raise PaymentGatewayError("Invalid payment gateway response")
    return provider_reference.strip()


def get_amana_payment_status(settings: Settings, provider_reference: str) -> str:
    """Read the provider-authoritative status for a transaction."""
    try:
        response = httpx.get(
            f"{settings.payment_gateway_url.rstrip('/')}/v1/payments/{provider_reference}",
            headers=_headers(settings),
            timeout=25,
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise PaymentGatewayError("Unable to verify Amana payment") from exc
    provider_status = data.get("status") if isinstance(data, dict) else None
    if not isinstance(provider_status, str):
        raise PaymentGatewayError("Invalid payment status response")
    return provider_status.upper()
