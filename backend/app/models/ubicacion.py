"""Ubicaciones físicas o espacios dentro de cada sede (salas, oficinas, bodegas...)."""

from sqlalchemy import ForeignKey, Index, Text, text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.comun import Trazable, nuevo_id
from app.models.sede import Sede


class Ubicacion(Trazable, Base):
    __tablename__ = "ubicaciones"
    __table_args__ = (
        Index(
            "uq_ubicaciones_sede_nombre_lower",
            "sede_id",
            text("lower(nombre)"),
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True, default=nuevo_id)
    sede_id: Mapped[str] = mapped_column(
        ForeignKey("sedes.id", ondelete="CASCADE"), index=True
    )
    nombre: Mapped[str] = mapped_column(Text)
    descripcion: Mapped[str] = mapped_column(Text, server_default="")
    activa: Mapped[bool] = mapped_column(default=True, server_default=true())

    sede: Mapped[Sede] = relationship(lazy="selectin")

    @property
    def sede_nombre(self) -> str:
        return self.sede.nombre
