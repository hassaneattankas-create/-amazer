"""Private outbound gateway for AMAZER payment providers."""

from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field

from app.config import Settings, get_settings
from app.security import require_backend
from app.providers.amana import AmanaClient, AmanaConfigurationError, AmanaPayment, AmanaRequestError

app = FastAPI(title="AMAZER Payment Gateway", version="1.0.0", docs_url=None, redoc_url=None)


class HealthResponse(BaseModel):
    """Safe gateway health payload."""

    status: str


class PaymentRequest(BaseModel):
    """Provider-neutral payment request accepted from the Amazer backend."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    provider: str = Field(pattern="^(amana)$")
    reference: str = Field(min_length=8, max_length=80)
    amount_xof: int = Field(gt=0, le=10_000_000)
    description: str = Field(min_length=1, max_length=255)
    payer_phone: str = Field(min_length=8, max_length=32)


class PaymentStatusResponse(BaseModel):
    """Provider status returned only to the trusted Amazer backend."""

    status: str


class PaymentCreateResponse(BaseModel):
    """Minimal provider result exposed to the trusted AMAZER backend."""

    provider_reference: str


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Return an unauthenticated liveness check without configuration details."""
    return HealthResponse(status="ok")


@app.post("/v1/payments", response_model=PaymentCreateResponse)
def create_payment(
    payload: PaymentRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> dict[str, object]:
    """Create a payment with the selected provider through the fixed gateway."""
    require_backend(request, settings)
    if payload.provider != "amana":
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported payment provider")
    try:
        response = AmanaClient(settings).create_payment(
            AmanaPayment(
                reference=payload.reference,
                amount_xof=payload.amount_xof,
                description=payload.description,
                payer_phone=payload.payer_phone,
            )
        )
        return PaymentCreateResponse(provider_reference=AmanaClient.provider_reference(response))
    except AmanaConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Amana is not configured") from exc
    except AmanaRequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Amana rejected the payment request") from exc


@app.get("/v1/payments/{provider_reference}", response_model=PaymentStatusResponse)
def get_payment_status(
    provider_reference: str,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> PaymentStatusResponse:
    """Return the normalized, provider-authoritative status of one payment."""
    require_backend(request, settings)
    try:
        response = AmanaClient(settings).payment_status(provider_reference)
        payment = response.get("paiement")
        provider_status = payment.get("statut_transaction") if isinstance(payment, dict) else None
        if not isinstance(provider_status, str):
            raise AmanaRequestError("Amana did not return a transaction status")
        return PaymentStatusResponse(status=provider_status.upper())
    except AmanaConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Amana is not configured") from exc
    except AmanaRequestError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Amana status check failed") from exc
