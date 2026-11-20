"""Carga fictícia explícita para desenvolvimento, nunca executada ao iniciar a API."""

import argparse
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from .models import (
    Activity,
    Company,
    Discipline,
    Element,
    Environment,
    Floor,
    Membership,
    ProductionRecord,
    Project,
    Scope,
)
from .schemas import today
from .settings import Settings, database_engine


def seed_demo(session: Session, user_id: UUID, project_id="claro-bi02"):
    if session.get(Project, project_id):
        raise ValueError("A obra já existe. A carga de demonstração não altera obras existentes.")
    session.add(Project(id=project_id, name="CDP BI02 · CLARO · demonstração"))
    session.flush()
    session.add_all(
        [
            Membership(
                project_id=project_id,
                user_id=user_id,
                display_name="Engenharia de demonstração",
                role="admin",
            ),
            Floor(project_id=project_id, id="floor-2", name="2º andar"),
            Floor(project_id=project_id, id="floor-3", name="3º andar"),
            Discipline(project_id=project_id, id="finishes", name="Acabamentos"),
            Company(project_id=project_id, id="company-a", name="Equipe Alfa"),
            Company(project_id=project_id, id="company-b", name="Equipe Beta"),
        ]
    )
    session.flush()
    session.add(
        Environment(
            project_id=project_id, id="meeting-1", floor_id="floor-2", name="Sala de reunião 01"
        )
    )
    session.add_all(
        [
            Activity(
                project_id=project_id, id="painting", discipline_id="finishes", name="Pintura"
            ),
            Activity(
                project_id=project_id,
                id="doors",
                discipline_id="finishes",
                name="Instalação de portas",
            ),
        ]
    )
    session.flush()
    elements = [
        ("wall-east", "PAR-01", "Parede leste", "painting", "percentage", "m2", "10", "4", "30"),
        ("wall-west", "PAR-02", "Parede oeste", "painting", "percentage", "m2", "12", "0", "30"),
        ("door-1", "POR-01", "Porta de entrada", "doors", "unit", "un", "1", "0", "20"),
        ("door-2", "POR-02", "Porta de serviço", "doors", "unit", "un", "1", "1", "20"),
    ]
    for item_id, code, name, *_rest in elements:
        session.add(
            Element(
                project_id=project_id, id=item_id, environment_id="meeting-1", code=code, name=name
            )
        )
    session.flush()
    for item_id, _code, _name, activity, kind, unit, planned, executed, weight in elements:
        session.add(
            Scope(
                project_id=project_id,
                id=item_id,
                element_id=item_id,
                activity_id=activity,
                measurement_type=kind,
                unit=unit,
                planned_quantity=Decimal(planned),
                executed_quantity=Decimal(executed),
                production_weight=Decimal(weight),
            )
        )
    session.flush()
    for item_id, _code, _name, _activity, _kind, _unit, _planned, executed, _weight in elements:
        if Decimal(executed):
            session.add(
                ProductionRecord(
                    project_id=project_id,
                    scope_item_id=item_id,
                    batch_id=uuid4(),
                    execution_date=today(),
                    quantity=Decimal(executed),
                    author_id=user_id,
                    author_name="Engenharia de demonstração",
                    observation="Medição inicial de demonstração",
                )
            )
    session.flush()


def main():
    parser = argparse.ArgumentParser(
        description="Cria somente uma obra fictícia nova para teste local."
    )
    parser.add_argument(
        "--user-id",
        required=True,
        type=UUID,
        help="ID do usuário de autenticação para a obra fictícia",
    )
    parser.add_argument("--project-id", default="claro-bi02")
    parser.add_argument("--confirm-demo", action="store_true", required=True)
    args = parser.parse_args()
    settings = Settings()
    if not settings.database_url:
        parser.error("Configure DATABASE_URL com uma conexão administrativa para a carga.")
    engine = database_engine(settings.database_url.get_secret_value())
    with Session(engine) as session, session.begin():
        seed_demo(session, args.user_id, args.project_id)
    engine.dispose()
    print("Obra fictícia criada. Nenhum usuário de autenticação foi criado ou modificado.")


if __name__ == "__main__":
    main()
