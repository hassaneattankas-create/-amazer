from __future__ import annotations

import logging
import re
from typing import Any


_SENSITIVE_PATTERNS = [
    re.compile(r"(?i)(password|passcode)\s*=\s*[^,\s]+"),
    re.compile(r'(?i)"(password|passcode)"\s*:\s*"[^"]*"'),
    re.compile(r"(?i)(secret|api_key|token|refresh_token|access_token)\s*=\s*[^,\s]+"),
    re.compile(r'(?i)"(secret|api_key|token|refresh_token|access_token)"\s*:\s*"[^"]*"'),
    re.compile(r"(?i)(admin_finance_pin|payment_encryption_key)\s*=\s*[^,\s]+"),
    re.compile(r'(?i)"(admin_finance_pin|payment_encryption_key)"\s*:\s*"[^"]*"'),
]


def _sanitize_text(text: str) -> str:
  """Redact sensitive substrings from log text."""
  sanitized = text
  for pattern in _SENSITIVE_PATTERNS:
    sanitized = pattern.sub(lambda m: re.sub(r"=.+$", "=***", m.group(0)), sanitized)
  return sanitized


class RedactingFilter(logging.Filter):
  """Logging filter that masks secrets in log messages and extra details."""

  def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401
    if isinstance(record.msg, str):
      record.msg = _sanitize_text(record.msg)

    if record.args:
      new_args: list[Any] = []
      for arg in record.args if isinstance(record.args, tuple) else (record.args,):
        if isinstance(arg, str):
          new_args.append(_sanitize_text(arg))
        else:
          new_args.append(arg)
      record.args = tuple(new_args)

    return True

