"""Esquemas de la configuración global."""

from typing import Annotated, Any

from pydantic import Field, StringConstraints

from app.schemas.base import Entrada, Salida

Clave = Annotated[str, StringConstraints(min_length=1, max_length=40)]
Valor = Annotated[str, StringConstraints(max_length=300)]
Grupo = Annotated[dict[Clave, Valor], Field(max_length=40)]


class ConfiguracionCambios(Entrada):
    theme_config: Grupo | None = None
    settings: Grupo | None = None
    form_schemas: dict[str, Any] | None = None


class ConfiguracionSalida(Salida):
    theme_config: dict[str, str]
    settings: dict[str, str]
    form_schemas: dict[str, Any] = Field(default_factory=dict)
