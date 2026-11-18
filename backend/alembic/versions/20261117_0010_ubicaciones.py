"""ubicaciones fisicas dentro de las sedes y vinculo con equipos

Revisión: 0010
Anterior: 0009
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ubicaciones",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("sede_id", sa.Text(), nullable=False),
        sa.Column("nombre", sa.Text(), nullable=False),
        sa.Column("descripcion", sa.Text(), server_default="", nullable=False),
        sa.Column("activa", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("creado_por", sa.Text(), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("actualizado_por", sa.Text(), nullable=True),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["sede_id"],
            ["sedes.id"],
            name=op.f("fk_ubicaciones_sede_id_sedes"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actualizado_por"],
            ["usuarios.id"],
            name=op.f("fk_ubicaciones_actualizado_por_usuarios"),
        ),
        sa.ForeignKeyConstraint(
            ["creado_por"], ["usuarios.id"], name=op.f("fk_ubicaciones_creado_por_usuarios")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ubicaciones")),
    )
    op.create_index(op.f("ix_ubicaciones_sede_id"), "ubicaciones", ["sede_id"])
    op.create_index(
        "uq_ubicaciones_sede_nombre_lower",
        "ubicaciones",
        ["sede_id", sa.text("lower(nombre)")],
        unique=True,
    )

    op.add_column("equipos", sa.Column("ubicacion_id", sa.Text(), nullable=True))
    op.create_index(op.f("ix_equipos_ubicacion_id"), "equipos", ["ubicacion_id"])
    op.create_foreign_key(
        op.f("fk_equipos_ubicacion_id_ubicaciones"),
        "equipos",
        "ubicaciones",
        ["ubicacion_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_equipos_ubicacion_id_ubicaciones"), "equipos", type_="foreignkey")
    op.drop_index(op.f("ix_equipos_ubicacion_id"), table_name="equipos")
    op.drop_column("equipos", "ubicacion_id")
    op.drop_index("uq_ubicaciones_sede_nombre_lower", table_name="ubicaciones")
    op.drop_index(op.f("ix_ubicaciones_sede_id"), table_name="ubicaciones")
    op.drop_table("ubicaciones")
