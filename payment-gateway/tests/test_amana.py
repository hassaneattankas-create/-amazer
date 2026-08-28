"""Amana signing tests."""

from app.config import Settings
from app.providers.amana import AmanaClient


def test_amana_signature_uses_timestamp_method_path_and_body(monkeypatch) -> None:
    monkeypatch.setattr("app.providers.amana.time.time", lambda: 1_700_000_000)
    settings = Settings(
        gateway_shared_secret="a" * 32,
        amana_base_url="https://example.test",
        amana_user_login="login",
        amana_user_password="password",
        amana_api_key="key",
    )

    headers = AmanaClient(settings)._signed_headers("POST", "/v1/auth", b'{"x":1}')

    assert headers["X-Timestamp"] == "1700000000"
    assert headers["X-Signature"] == "3f6c5ebfd5224d05f8f4bb5ba6ee9b3afaaada6ddfa42e28c14f81e71290a940"


def test_amana_token_is_sent_as_a_bearer_token() -> None:
    settings = Settings(
        gateway_shared_secret="a" * 32,
        amana_base_url="https://example.test",
        amana_user_login="login",
        amana_user_password="password",
        amana_api_key="key",
    )

    assert AmanaClient(settings)._signed_headers("POST", "/v1/make-payment", b"{}", "token")["Authorization"] == "Bearer token"


def test_amana_provider_reference_is_extracted_from_nested_response() -> None:
    assert AmanaClient.provider_reference({"paiement": {"referenceTransaction": "B2B-123"}}) == "B2B-123"
