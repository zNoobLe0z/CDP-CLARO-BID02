import logging
from contextlib import asynccontextmanager
from typing import Annotated, Literal
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from . import dashboard_queries, mutations, queries
from .auth import db, editor, membership
from .errors import DomainError, invalid, missing
from .models import Company, Membership, Workforce, WorkforceRevision
from .schemas import Correction, IsoDate, ProductionBatch, WorkforceInput, today
from .settings import Settings, database_engine

logger = logging.getLogger("cdp.api")
Db = Annotated[Session, Depends(db, scope="function")]
Member = Annotated[Membership, Depends(membership, scope="function")]
Editor = Annotated[Membership, Depends(editor, scope="function")]
IdempotencyKey = Annotated[UUID, Header(alias="Idempotency-Key")]


def scope_filters(
    floor_id: str = Query("", max_length=100),
    environment_id: str = Query("", max_length=100),
    discipline_id: str = Query("", max_length=100),
    activity_id: str = Query("", max_length=100),
    scope_item_id: str = Query("", max_length=100),
):
    return {
        "floor_id": floor_id,
        "environment_id": environment_id,
        "discipline_id": discipline_id,
        "activity_id": activity_id,
        "scope_item_id": scope_item_id,
    }


Filters = Annotated[dict, Depends(scope_filters)]


def create_app(settings: Settings | None = None, engine=None, auth_http=None):
    settings = settings or Settings()
    owned_engine = engine is None
    if engine is None and settings.database_url:
        engine = database_engine(settings.database_url.get_secret_value())

    @asynccontextmanager
    async def lifespan(app):
        app.state.auth_http = auth_http or httpx.Client(timeout=10, follow_redirects=False)
        yield
        if auth_http is None:
            app.state.auth_http.close()
        if owned_engine and engine is not None:
            engine.dispose()

    app = FastAPI(title="CDP CLARO API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = engine
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )

    @app.exception_handler(DomainError)
    async def domain_error(_request: Request, error: DomainError):
        return JSONResponse(
            status_code=error.status,
            content={
                "error": {"code": error.code, "message": error.message, "fields": error.fields}
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError):
        fields = {}
        for issue in error.errors():
            location = [
                str(part)
                for part in issue["loc"]
                if part not in ("body", "query", "path", "header", "percentage", "unit")
            ]
            fields[".".join(location)] = issue["msg"]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Revise os campos informados.",
                    "fields": fields,
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, error: HTTPException):
        return JSONResponse(
            status_code=error.status_code,
            content={
                "error": {
                    "code": "NOT_FOUND" if error.status_code == 404 else "REQUEST_FAILED",
                    "message": "Recurso ou operação indisponível.",
                    "fields": {},
                }
            },
        )

    @app.exception_handler(Exception)
    async def internal_error(_request: Request, _error: Exception):
        logger.error("Falha interna em uma operação da API", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Não foi possível concluir a operação. Tente novamente.",
                    "fields": {},
                }
            },
        )

    @app.get("/health/live", tags=["Health"])
    def live():
        return {"status": "ok"}

    @app.get("/health/ready", tags=["Health"])
    def ready():
        if engine is None or not settings.supabase_url or not settings.supabase_publishable_key:
            raise DomainError(503, "NOT_READY", "Configuração de banco ou autenticação pendente.")
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1 FROM cdp.projects LIMIT 1"))
        except Exception:
            raise DomainError(
                503, "NOT_READY", "Banco de dados indisponível ou não migrado."
            ) from None
        return {"status": "ready"}

    prefix = "/api/v1/projects/{project_id}"

    @app.get(prefix + "/me", tags=["Access"])
    def me(member: Member):
        return {
            "user_id": str(member.user_id),
            "display_name": member.display_name,
            "role": member.role,
        }

    @app.get(prefix + "/floors", tags=["Cascade"])
    def floors(project_id: str, session: Db, _member: Member):
        return {"items": queries.options(session, project_id, "floors", {})}

    @app.get(prefix + "/environments", tags=["Cascade"])
    def environments(
        project_id: str,
        session: Db,
        _member: Member,
        floor_id: str = Query(min_length=1, max_length=100),
    ):
        return {
            "items": queries.options(session, project_id, "environments", {"floor_id": floor_id})
        }

    @app.get(prefix + "/disciplines", tags=["Cascade"])
    def disciplines(
        project_id: str,
        session: Db,
        _member: Member,
        environment_id: str = Query(min_length=1, max_length=100),
    ):
        return {
            "items": queries.options(
                session, project_id, "disciplines", {"environment_id": environment_id}
            )
        }

    @app.get(prefix + "/activities", tags=["Cascade"])
    def activities(
        project_id: str,
        session: Db,
        _member: Member,
        environment_id: str = Query(min_length=1, max_length=100),
        discipline_id: str = Query(min_length=1, max_length=100),
    ):
        return {
            "items": queries.options(
                session,
                project_id,
                "activities",
                {"environment_id": environment_id, "discipline_id": discipline_id},
            )
        }

    @app.get(prefix + "/scope-items", tags=["Cascade"])
    def scope_items(
        project_id: str,
        session: Db,
        _member: Member,
        environment_id: str = Query(min_length=1, max_length=100),
        activity_id: str = Query(min_length=1, max_length=100),
    ):
        return {
            "items": queries.options(
                session,
                project_id,
                "scope-items",
                {"environment_id": environment_id, "activity_id": activity_id},
            )
        }

    @app.get(prefix + "/scope-catalog", tags=["Scope"])
    def scope_catalog(project_id: str, session: Db, _member: Member, filters: Filters):
        return {"items": queries.catalog(session, project_id, filters)}

    @app.post(prefix + "/production-batches", tags=["Production"])
    def save_batch(body: ProductionBatch, key: IdempotencyKey, session: Db, member: Editor):
        result, status = mutations.production(session, member, body, key)
        return JSONResponse(result, status_code=status)

    @app.get(prefix + "/production-records", tags=["Production"])
    def history(
        project_id: str,
        session: Db,
        _member: Member,
        filters: Filters,
        page: int = Query(1, ge=1),
        page_size: int = Query(10, ge=1, le=100),
        start_date: IsoDate | None = None,
        end_date: IsoDate | None = None,
        search: str = Query("", max_length=200),
        status: Literal["", "active", "corrected"] = "",
    ):
        return queries.history(
            session, project_id, filters, page, page_size, start_date, end_date, search, status
        )

    @app.post(prefix + "/production-records/{record_id}/corrections", tags=["Production"])
    def correction(
        record_id: UUID, body: Correction, key: IdempotencyKey, session: Db, member: Editor
    ):
        result, status = mutations.correct(session, member, record_id, body, key)
        return JSONResponse(result, status_code=status)

    @app.get(prefix + "/dashboard", tags=["Dashboard"])
    def dashboard(
        project_id: str, reference_date: IsoDate, session: Db, _member: Member, filters: Filters
    ):
        if reference_date > today():
            invalid("A data de referência não pode estar no futuro.")
        return queries.dashboard(session, project_id, filters, reference_date)

    @app.get(prefix + "/dashboard/timeline", tags=["Dashboard"])
    def dashboard_timeline(
        project_id: str,
        reference_date: IsoDate,
        session: Db,
        _member: Member,
        filters: Filters,
        start_date: IsoDate | None = None,
    ):
        if reference_date > today():
            invalid("A data de referência não pode estar no futuro.")
        return dashboard_queries.timeline(session, project_id, filters, reference_date, start_date)

    @app.get(prefix + "/dashboard/stages", tags=["Dashboard"])
    def dashboard_stages(
        project_id: str, reference_date: IsoDate, session: Db, _member: Member, filters: Filters
    ):
        if reference_date > today():
            invalid("A data de referência não pode estar no futuro.")
        return dashboard_queries.stages(session, project_id, filters, reference_date)

    @app.get(prefix + "/companies", tags=["Workforce"])
    def companies(project_id: str, session: Db, _member: Member):
        return {
            "items": [
                {"id": company.id, "name": company.name}
                for company in session.scalars(
                    select(Company).where(Company.project_id == project_id).order_by(Company.name)
                )
            ]
        }

    @app.get(prefix + "/workforce", tags=["Workforce"])
    def workforce(
        project_id: str,
        start_date: IsoDate,
        end_date: IsoDate,
        session: Db,
        _member: Member,
        company_id: str = Query("", max_length=100),
    ):
        if start_date > end_date:
            invalid("Informe um período válido.")
        statement = (
            select(Workforce, Company)
            .join(
                Company,
                (Workforce.project_id == Company.project_id) & (Workforce.company_id == Company.id),
            )
            .where(Workforce.project_id == project_id)
        )
        if company_id:
            if session.get(Company, (project_id, company_id)) is None:
                missing()
            statement = statement.where(Workforce.company_id == company_id)
        statement = statement.where(
            Workforce.execution_date.between(start_date, end_date)
        ).order_by(Workforce.execution_date.desc(), Company.name)
        return {
            "items": [
                mutations.workforce_view(row, company)
                for row, company in session.execute(statement)
            ]
        }

    @app.put(prefix + "/workforce/{execution_date}/{company_id}", tags=["Workforce"])
    def save_workforce(
        execution_date: IsoDate,
        company_id: str,
        body: WorkforceInput,
        key: IdempotencyKey,
        session: Db,
        member: Editor,
    ):
        if execution_date > today():
            invalid("A data da contagem não pode estar no futuro.")
        result, status = mutations.workforce_save(
            session, member, execution_date, company_id, body, key
        )
        return JSONResponse(result, status_code=status)

    @app.get(prefix + "/workforce-records/{record_id}/revisions", tags=["Workforce"])
    def revisions(project_id: str, record_id: UUID, session: Db, _member: Member):
        if session.get(Workforce, (project_id, record_id)) is None:
            missing()
        rows = session.scalars(
            select(WorkforceRevision)
            .where(
                WorkforceRevision.project_id == project_id,
                WorkforceRevision.workforce_id == record_id,
            )
            .order_by(WorkforceRevision.version)
        )
        return {
            "items": [
                {
                    "version": row.version,
                    "headcount": row.headcount,
                    "observation": row.observation,
                    "author_name": row.author_name,
                    "updated_at": row.updated_at.isoformat(),
                }
                for row in rows
            ]
        }

    from .catalog_admin import router as catalog_router

    app.include_router(catalog_router())
    return app


app = create_app()
