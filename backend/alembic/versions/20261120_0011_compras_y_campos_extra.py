"""compras (tipo en donaciones) y campos_extra JSONB para formularios personalizables

Revisión: 0011
Anterior: 0010
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "donaciones",
        sa.Column("tipo", sa.Text(), server_default="donacion", nullable=False),
    )
    op.create_check_constraint(
        "ck_donaciones_tipo_valido", "donaciones", "tipo IN ('donacion', 'compra')"
    )
    op.create_index(op.f("ix_donaciones_tipo"), "donaciones", ["tipo"])

    for tabla in ("donaciones", "prestamos", "mantenimientos", "sedes"):
        op.add_column(
            tabla,
            sa.Column(
                "campos_extra",
                postgresql.JSONB(),
                server_default=sa.text("'{}'::jsonb"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    for tabla in ("sedes", "mantenimientos", "prestamos", "donaciones"):
        op.drop_column(tabla, "campos_extra")
    op.drop_index(op.f("ix_donaciones_tipo"), table_name="donaciones")
    op.drop_constraint("ck_donaciones_tipo_valido", "donaciones", type_="check")
    op.drop_column("donaciones", "tipo")
