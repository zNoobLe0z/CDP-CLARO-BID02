"""initial_production_schema

Revision ID: a559fc91c3c5
Revises:
"""

from alembic import op

revision = "a559fc91c3c5"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "\nCREATE TABLE cdp.projects (\n\tid VARCHAR(100) NOT NULL, \n\tname VARCHAR(200) NOT NULL, \n\tPRIMARY KEY (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.companies (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid VARCHAR(100) NOT NULL, \n\tname VARCHAR(200) NOT NULL, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id) REFERENCES cdp.projects (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.disciplines (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid VARCHAR(100) NOT NULL, \n\tname VARCHAR(200) NOT NULL, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id) REFERENCES cdp.projects (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.floors (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid VARCHAR(100) NOT NULL, \n\tname VARCHAR(200) NOT NULL, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id) REFERENCES cdp.projects (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.idempotency (\n\tproject_id VARCHAR(100) NOT NULL, \n\tuser_id UUID NOT NULL, \n\toperation VARCHAR(200) NOT NULL, \n\tkey UUID NOT NULL, \n\tfingerprint VARCHAR(64) NOT NULL, \n\tresponse JSONB, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (project_id, user_id, operation, key), \n\tFOREIGN KEY(project_id) REFERENCES cdp.projects (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.memberships (\n\tproject_id VARCHAR(100) NOT NULL, \n\tuser_id UUID NOT NULL, \n\tdisplay_name VARCHAR(200) NOT NULL, \n\trole VARCHAR(20) NOT NULL, \n\tPRIMARY KEY (project_id, user_id), \n\tFOREIGN KEY(project_id) REFERENCES cdp.projects (id), \n\tCONSTRAINT membership_role CHECK (role IN ('admin', 'editor', 'viewer'))\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.activities (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid VARCHAR(100) NOT NULL, \n\tdiscipline_id VARCHAR(100) NOT NULL, \n\tname VARCHAR(200) NOT NULL, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id, discipline_id) REFERENCES cdp.disciplines (project_id, id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.environments (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid VARCHAR(100) NOT NULL, \n\tfloor_id VARCHAR(100) NOT NULL, \n\tname VARCHAR(200) NOT NULL, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id, floor_id) REFERENCES cdp.floors (project_id, id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.workforce (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid UUID NOT NULL, \n\tcompany_id VARCHAR(100) NOT NULL, \n\texecution_date DATE NOT NULL, \n\theadcount INTEGER NOT NULL, \n\tobservation TEXT NOT NULL, \n\tauthor_name VARCHAR(200) NOT NULL, \n\tauthor_id UUID NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tversion INTEGER NOT NULL, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id, company_id) REFERENCES cdp.companies (project_id, id), \n\tUNIQUE (project_id, execution_date, company_id), \n\tCONSTRAINT workforce_values CHECK (headcount BETWEEN 0 AND 100000 AND version > 0)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.elements (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid VARCHAR(100) NOT NULL, \n\tenvironment_id VARCHAR(100) NOT NULL, \n\tcode VARCHAR(100) NOT NULL, \n\tname VARCHAR(200) NOT NULL, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id, environment_id) REFERENCES cdp.environments (project_id, id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.workforce_revisions (\n\tproject_id VARCHAR(100) NOT NULL, \n\tworkforce_id UUID NOT NULL, \n\tversion INTEGER NOT NULL, \n\theadcount INTEGER NOT NULL, \n\tobservation TEXT NOT NULL, \n\tauthor_name VARCHAR(200) NOT NULL, \n\tupdated_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tPRIMARY KEY (project_id, workforce_id, version), \n\tFOREIGN KEY(project_id, workforce_id) REFERENCES cdp.workforce (project_id, id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.scope_items (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid VARCHAR(100) NOT NULL, \n\telement_id VARCHAR(100) NOT NULL, \n\tactivity_id VARCHAR(100) NOT NULL, \n\tmeasurement_type VARCHAR(20) NOT NULL, \n\tunit VARCHAR(10) NOT NULL, \n\tplanned_quantity NUMERIC(18, 6) NOT NULL, \n\texecuted_quantity NUMERIC(18, 6) NOT NULL, \n\tproduction_weight NUMERIC(18, 6) NOT NULL, \n\tversion INTEGER NOT NULL, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id, element_id) REFERENCES cdp.elements (project_id, id), \n\tFOREIGN KEY(project_id, activity_id) REFERENCES cdp.activities (project_id, id), \n\tUNIQUE (project_id, element_id, activity_id), \n\tCONSTRAINT scope_quantities CHECK (planned_quantity > 0 AND executed_quantity >= 0 AND executed_quantity <= planned_quantity), \n\tCONSTRAINT scope_weight_version CHECK (production_weight > 0 AND version > 0), \n\tCONSTRAINT scope_measurement CHECK (measurement_type IN ('percentage', 'unit') AND unit IN ('m2', 'm', 'un')), \n\tCONSTRAINT scope_binary CHECK (measurement_type <> 'unit' OR (unit = 'un' AND planned_quantity = 1 AND executed_quantity IN (0,1)))\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE cdp.production_records (\n\tproject_id VARCHAR(100) NOT NULL, \n\tid UUID NOT NULL, \n\tscope_item_id VARCHAR(100) NOT NULL, \n\tbatch_id UUID NOT NULL, \n\texecution_date DATE NOT NULL, \n\tquantity NUMERIC(18, 6) NOT NULL, \n\tauthor_id UUID NOT NULL, \n\tauthor_name VARCHAR(200) NOT NULL, \n\tobservation TEXT NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tstatus VARCHAR(20) NOT NULL, \n\tversion INTEGER NOT NULL, \n\treplaces_id UUID, \n\tcorrection_reason TEXT, \n\tPRIMARY KEY (project_id, id), \n\tFOREIGN KEY(project_id, scope_item_id) REFERENCES cdp.scope_items (project_id, id), \n\tFOREIGN KEY(project_id, replaces_id) REFERENCES cdp.production_records (project_id, id), \n\tUNIQUE (project_id, replaces_id), \n\tCONSTRAINT record_values CHECK (quantity >= 0 AND version > 0 AND status IN ('active', 'corrected'))\n)\n\n"
    )
    op.execute("CREATE INDEX activity_discipline ON cdp.activities (project_id, discipline_id)")
    op.execute("CREATE INDEX environment_floor ON cdp.environments (project_id, floor_id)")
    op.execute("CREATE INDEX workforce_company ON cdp.workforce (project_id, company_id)")
    op.execute("CREATE INDEX element_environment ON cdp.elements (project_id, environment_id)")
    op.execute("CREATE INDEX scope_activity ON cdp.scope_items (project_id, activity_id)")
    op.execute("CREATE INDEX record_scope ON cdp.production_records (project_id, scope_item_id)")
    op.execute(
        "CREATE INDEX record_date ON cdp.production_records (project_id, execution_date, created_at, id)"
    )
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA cdp FROM PUBLIC")


def downgrade():
    op.execute("DROP TABLE cdp.production_records")
    op.execute("DROP TABLE cdp.scope_items")
    op.execute("DROP TABLE cdp.workforce_revisions")
    op.execute("DROP TABLE cdp.elements")
    op.execute("DROP TABLE cdp.workforce")
    op.execute("DROP TABLE cdp.environments")
    op.execute("DROP TABLE cdp.activities")
    op.execute("DROP TABLE cdp.memberships")
    op.execute("DROP TABLE cdp.idempotency")
    op.execute("DROP TABLE cdp.floors")
    op.execute("DROP TABLE cdp.disciplines")
    op.execute("DROP TABLE cdp.companies")
    op.execute("DROP TABLE cdp.projects")
