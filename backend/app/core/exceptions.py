class DomainError(Exception):
    def __init__(self, message: str, status_code: int, code: str) -> None:
        self.message = message
        self.status_code = status_code
        self.code = code
        super().__init__(message)


class ValidationDomainError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=422, code="validation_error")


class NotFoundError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=404, code="not_found")


class ConflictError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=409, code="conflict")


class UnauthorizedError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=401, code="unauthorized")


class ForbiddenError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=403, code="forbidden")


class TooManyRequestsError(DomainError):
    def __init__(self, message: str) -> None:
        super().__init__(message=message, status_code=429, code="too_many_requests")


class AuthError(DomainError):
    def __init__(self, message: str, status_code: int = 401) -> None:
        super().__init__(message=message, status_code=status_code, code="auth_error")
