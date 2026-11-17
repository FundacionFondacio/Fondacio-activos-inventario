"""Reglas de las ubicaciones físicas dentro de cada sede."""

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.errores import Conflicto
from app.models import Equipo, Ubicacion, Usuario
from app.schemas.ubicacion import COLUMNAS, UbicacionCambios, UbicacionNueva
from app.services.auditoria import registrar
from app.services.comun import aplicar_cambios, marcar_autor, resolver_sede, valores


def _exigir_nombre_libre(
    bd: Session, sede_id: str, nombre: str, salvo: Ubicacion | None = None
) -> None:
    otra = bd.scalar(
        select(Ubicacion).where(
            Ubicacion.sede_id == sede_id,
            func.lower(Ubicacion.nombre) == nombre.lower(),
        )
    )
    if otra is not None and otra is not salvo:
        raise Conflicto(f"Ya existe una ubicación llamada {otra.nombre!r} en esa sede")


def crear_ubicacion(bd: Session, datos: UbicacionNueva, autor: Usuario | None) -> Ubicacion:
    sede = resolver_sede(bd, datos.sede)
    _exigir_nombre_libre(bd, sede.id, datos.name)
    ubicacion = Ubicacion(sede_id=sede.id, **valores(datos, COLUMNAS))
    marcar_autor(ubicacion, autor, nuevo=True)
    bd.add(ubicacion)
    bd.flush()
    registrar(
        bd,
        autor,
        "crear",
        "ubicaciones",
        ubicacion.id,
        {"nombre": ubicacion.nombre, "sede": sede.nombre},
    )
    return ubicacion


def actualizar_ubicacion(
    bd: Session, ubicacion: Ubicacion, datos: UbicacionCambios, autor: Usuario
) -> Ubicacion:
    sede_nueva = resolver_sede(bd, datos.sede) if datos.sede is not None else ubicacion.sede
    nombre_objetivo = datos.name if datos.name is not None else ubicacion.nombre
    if datos.name is not None or sede_nueva.id != ubicacion.sede_id:
        _exigir_nombre_libre(bd, sede_nueva.id, nombre_objetivo, salvo=ubicacion)

    cambios = aplicar_cambios(ubicacion, datos, COLUMNAS)
    if sede_nueva.id != ubicacion.sede_id:
        cambios["sede"] = [ubicacion.sede.nombre, sede_nueva.nombre]
        ubicacion.sede = sede_nueva

    if "nombre" in cambios:
        # Mantiene sincronizado el texto de ubicación en los equipos vinculados a este espacio.
        bd.execute(
            update(Equipo)
            .where(Equipo.ubicacion_id == ubicacion.id)
            .values(ubicacion=ubicacion.nombre)
        )

    if cambios:
        marcar_autor(ubicacion, autor)
        registrar(bd, autor, "actualizar", "ubicaciones", ubicacion.id, cambios)
    return ubicacion


def borrar_ubicacion(bd: Session, ubicacion: Ubicacion, autor: Usuario) -> None:
    # Los equipos vinculados quedan con ubicacion_id = NULL (ON DELETE SET NULL), conservando el texto.
    registrar(
        bd,
        autor,
        "borrar",
        "ubicaciones",
        ubicacion.id,
        {"nombre": ubicacion.nombre, "sede": ubicacion.sede.nombre},
    )
    bd.delete(ubicacion)
