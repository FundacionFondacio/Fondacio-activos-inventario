"""Esquemas de ubicaciones físicas dentro de las sedes."""

from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, Field

from app.schemas.base import Entrada, Salida
from app.schemas.comunes import NoNulo, TextoLargo, TextoObligatorio


def _un_solo_espacio(valor: str) -> str:
    return " ".join(valor.split())


NombreUbicacion = Annotated[TextoObligatorio, AfterValidator(_un_solo_espacio)]

COLUMNAS = {"name": "nombre", "description": "descripcion", "active": "activa"}


class UbicacionNueva(Entrada):
    sede: TextoObligatorio
    name: NombreUbicacion
    description: TextoLargo = ""
    active: bool = True


class UbicacionCambios(Entrada):
    sede: Annotated[TextoObligatorio | None, NoNulo] = None
    name: Annotated[NombreUbicacion | None, NoNulo] = None
    description: TextoLargo = ""
    active: Annotated[bool | None, NoNulo] = None


class UbicacionSalida(Salida):
    id: str
    sede_id: str
    sede: str = Field(validation_alias="sede_nombre")
    name: str = Field(validation_alias="nombre")
    description: str = Field(validation_alias="descripcion")
    active: bool = Field(validation_alias="activa")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")
