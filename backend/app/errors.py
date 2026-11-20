class DomainError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: dict | None = None):
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields or {}


def invalid(message: str, fields: dict | None = None):
    raise DomainError(422, "VALIDATION_ERROR", message, fields)


def missing():
    raise DomainError(404, "NOT_FOUND", "Recurso não encontrado nesta obra.")


def conflict(code="SCOPE_VERSION_CONFLICT"):
    raise DomainError(
        409, code, "O registro ou saldo foi alterado. Atualize os dados e revise o envio."
    )
