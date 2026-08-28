"""Server-side client for the AmanaTa payment API."""

import hashlib
import hmac
import json
import time
from dataclasses import dataclass

import httpx

from app.config import Settings


class AmanaConfigurationError(ValueError):
    """Raised when required Amana settings are absent."""


class AmanaRequestError(RuntimeError):
    """Raised when Amana rejects or cannot process a request."""


@dataclass(frozen=True)
class AmanaPayment:
    """Normalized request data for a new Amana payment."""

    reference: str
    amount_xof: int
    description: str
    payer_phone: str


class AmanaClient:
    """Call Amana from the fixed-IP gateway only."""

    def __init__(self, settings: Settings, client: httpx.Client | None = None) -> None:
        """Configure the client without exposing credentials outside the gateway."""
        if not all(
            [
                settings.amana_base_url,
                settings.amana_user_login,
                settings.amana_user_password,
                settings.amana_api_key,
            ]
        ):
            raise AmanaConfigurationError("Amana sandbox credentials are not configured")
        self._base_url = settings.amana_base_url.rstrip("/")
        self._login = settings.amana_user_login
        self._password = settings.amana_user_password
        self._api_key = settings.amana_api_key
        self._client = client or httpx.Client(timeout=httpx.Timeout(20.0))

    def _signed_headers(self, method: str, path: str, body: bytes, token: str | None = None) -> dict[str, str]:
        """Build the HMAC-SHA256 headers required by the Amana documentation."""
        timestamp = str(int(time.time()))
        message = f"{timestamp}{method.upper()}{path}".encode() + body
        signature = hmac.new(self._api_key.encode(), message, hashlib.sha256).hexdigest()
        headers = {
            "Content-Type": "application/json",
            "X-Timestamp": timestamp,
            "X-APIKey": self._api_key,
            "X-Signature": signature,
        }
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _post(self, path: str, payload: dict[str, object], token: str | None = None) -> dict[str, object]:
        """Send one signed JSON request and normalize provider failures."""
        body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
        response = self._client.post(
            f"{self._base_url}{path}",
            content=body,
            headers=self._signed_headers("POST", path, body, token),
        )
        try:
            data = response.json()
        except ValueError as exc:
            raise AmanaRequestError("Amana returned an invalid response") from exc
        if response.is_error:
            message = data.get("message", "Amana request rejected") if isinstance(data, dict) else "Amana request rejected"
            raise AmanaRequestError(str(message))
        if not isinstance(data, dict):
            raise AmanaRequestError("Amana returned an invalid response")
        return data

    def _token(self) -> str:
        """Authenticate and return the short-lived Amana access token."""
        data = self._post("/v1/auth", {"userlogin": self._login, "userpass": self._password})
        token = data.get("token") or data.get("access_token")
        if not isinstance(token, str) or not token:
            raise AmanaRequestError("Amana authentication response did not include a token")
        return token

    def create_payment(self, payment: AmanaPayment) -> dict[str, object]:
        """Create a payment after obtaining a fresh provider token."""
        return self._post(
            "/v1/make-payment",
            {
                "montantPaiement": payment.amount_xof,
                "descriptionPaiement": payment.description,
                "externalReference": payment.reference,
                "telephonePayeur": payment.payer_phone,
                "fraisInclus": "NON",
            },
            self._token(),
        )

    @staticmethod
    def provider_reference(data: dict[str, object]) -> str:
        """Extract the provider transaction reference from a documented API response."""
        expected = {"referencetransaction", "providerreference", "transactionreference"}
        pending: list[object] = [data]
        while pending:
            current = pending.pop()
            if isinstance(current, dict):
                for key, value in current.items():
                    normalized = "".join(char for char in key.lower() if char.isalnum())
                    if normalized in expected and isinstance(value, str) and value.strip():
                        return value.strip()
                    pending.append(value)
            elif isinstance(current, list):
                pending.extend(current)
        raise AmanaRequestError("Amana response did not include a transaction reference")

    def payment_status(self, provider_reference: str) -> dict[str, object]:
        """Fetch the authoritative payment status from Amana."""
        return self._post(
            "/v1/check-status-payment",
            {"referenceTransaction": provider_reference},
            self._token(),
        )
