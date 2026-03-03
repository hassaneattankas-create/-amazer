from __future__ import annotations

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings


def _derive_key() -> bytes:
    raw = get_settings().payment_encryption_key.encode("utf-8")
    try:
        decoded = base64.urlsafe_b64decode(raw + b"=" * (-len(raw) % 4))
        if len(decoded) == 32:
            return decoded
    except Exception:
        pass
    return hashlib.sha256(raw).digest()


def encrypt_payment_code(code: str) -> str:
    key = _derive_key()
    aes = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aes.encrypt(nonce, code.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_payment_code(token: str) -> str:
    key = _derive_key()
    aes = AESGCM(key)
    payload = base64.urlsafe_b64decode(token.encode("utf-8"))
    nonce, ciphertext = payload[:12], payload[12:]
    plain = aes.decrypt(nonce, ciphertext, None)
    return plain.decode("utf-8")


def payment_code_hash(code: str) -> str:
    return hashlib.sha256(code.strip().lower().encode("utf-8")).hexdigest()
