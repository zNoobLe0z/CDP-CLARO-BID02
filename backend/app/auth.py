from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .errors import DomainError
from .models import Membership

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Identity:
    user_id: UUID


def identity(request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise DomainError(401, "AUTH_REQUIRED", "Entre na sua conta para acessar a obra.")
    settings = request.app.state.settings
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise DomainError(
            503, "AUTH_UNAVAILABLE", "O serviço de autenticação não está configurado."
        )
    try:
        response = request.app.state.auth_http.get(
            settings.supabase_url.rstrip("/") + "/auth/v1/user",
            headers={
                "apikey": settings.supabase_publishable_key.get_secret_value(),
                "Authorization": "Bearer " + credentials.credentials,
            },
        )
    except httpx.RequestError:
        raise DomainError(503, "AUTH_UNAVAILABLE", "Não foi possível verificar a sessão.") from None
    if response.status_code in (400, 401, 403):
        raise DomainError(401, "AUTH_REQUIRED", "Sessão inválida ou expirada. Entre novamente.")
    if response.status_code != 200:
        raise DomainError(503, "AUTH_UNAVAILABLE", "Não foi possível verificar a sessão.")
    try:
        return Identity(UUID(response.json()["id"]))
    except (ValueError, TypeError, KeyError):
        raise DomainError(503, "AUTH_UNAVAILABLE", "Resposta de autenticação inválida.") from None


def db(request: Request):
    engine = request.app.state.engine
    if engine is None:
        raise DomainError(503, "DATABASE_UNAVAILABLE", "O banco de dados não está configurado.")
    with Session(engine) as session, session.begin():
        if request.method == "GET":
            session.connection(execution_options={"isolation_level": "REPEATABLE READ"})
        yield session


def membership(
    project_id: str,
    user: Identity = Depends(identity),
    session: Session = Depends(db, scope="function"),
):
    member = session.get(Membership, (project_id, user.user_id))
    if not member:
        raise DomainError(403, "FORBIDDEN", "Você não possui acesso a esta obra.")
    return member


def editor(member: Membership = Depends(membership)):
    if member.role not in ("admin", "editor"):
        raise DomainError(403, "FORBIDDEN", "Seu perfil permite somente consulta.")
    return member


def administrator(member: Membership = Depends(membership, scope="function")):
    if member.role != "admin":
        raise DomainError(403, "FORBIDDEN", "Esta operação exige perfil de administrador da obra.")
    return member
