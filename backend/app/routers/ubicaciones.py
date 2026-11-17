"""Ubicaciones físicas dentro de cada sede."""

from fastapi import APIRouter, status
from sqlalchemy import select

from app.db import BD
from app.errores import NoEncontrado
from app.models import Ubicacion
from app.paginacion import Pag, paginar
from app.schemas.base import Pagina
from app.schemas.ubicacion import UbicacionCambios, UbicacionNueva, UbicacionSalida
from app.security import Admin, UsuarioActual
from app.services import ubicaciones as servicio
from app.services.comun import resolver_sede

router = APIRouter(prefix="/api/ubicaciones", tags=["ubicaciones"])


def _buscar(bd: BD, ubicacion_id: str) -> Ubicacion:
    ubicacion = bd.get(Ubicacion, ubicacion_id)
    if ubicacion is None:
        raise NoEncontrado("Ubicación no encontrada")
    return ubicacion


@router.get("", response_model=Pagina[UbicacionSalida])
def listar(
    bd: BD,
    _: UsuarioActual,
    pag: Pag,
    sede: str | None = None,
    active: bool | None = None,
) -> dict:
    """Lista ubicaciones, opcionalmente filtradas por sede (id o nombre) y estado activo."""
    consulta = select(Ubicacion).order_by(Ubicacion.nombre)
    if sede:
        sede_obj = resolver_sede(bd, sede)
        consulta = consulta.where(Ubicacion.sede_id == sede_obj.id)
    if active is not None:
        consulta = consulta.where(Ubicacion.activa == active)
    return paginar(bd, consulta, pag)


@router.post("", response_model=UbicacionSalida, status_code=status.HTTP_201_CREATED)
def crear(datos: UbicacionNueva, bd: BD, admin: Admin) -> Ubicacion:
    ubicacion = servicio.crear_ubicacion(bd, datos, admin)
    bd.commit()
    return ubicacion


@router.get("/{ubicacion_id}", response_model=UbicacionSalida)
def ver(ubicacion_id: str, bd: BD, _: UsuarioActual) -> Ubicacion:
    return _buscar(bd, ubicacion_id)


@router.patch("/{ubicacion_id}", response_model=UbicacionSalida)
def actualizar(ubicacion_id: str, datos: UbicacionCambios, bd: BD, admin: Admin) -> Ubicacion:
    ubicacion = servicio.actualizar_ubicacion(bd, _buscar(bd, ubicacion_id), datos, admin)
    bd.commit()
    return ubicacion


@router.delete("/{ubicacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar(ubicacion_id: str, bd: BD, admin: Admin) -> None:
    servicio.borrar_ubicacion(bd, _buscar(bd, ubicacion_id), admin)
    bd.commit()
