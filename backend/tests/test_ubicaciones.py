from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Auditoria


def _crear_sede(cliente: TestClient, nombre: str) -> dict:
    r = cliente.post("/api/sedes", json={"name": nombre, "city": "Bogotá"})
    assert r.status_code == 201, r.text
    return r.json()


def _crear_ubicacion(
    cliente: TestClient, sede: str, name: str = "Sala de Sistemas 1", **extra
) -> dict:
    r = cliente.post("/api/ubicaciones", json={"sede": sede, "name": name, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_crear_listar_y_ver_ubicacion(cliente_admin: TestClient) -> None:
    sede = _crear_sede(cliente_admin, "YLDC Potosí")
    ubicacion = _crear_ubicacion(
        cliente_admin, sede["name"], "Sala de Sistemas 1", description="Piso 2"
    )

    vista = cliente_admin.get(f"/api/ubicaciones/{ubicacion['id']}").json()
    assert vista["name"] == "Sala de Sistemas 1"
    assert vista["sede"] == "YLDC Potosí"
    assert vista["sedeId"] == sede["id"]
    assert vista["description"] == "Piso 2"
    assert vista["active"] is True

    lista = cliente_admin.get("/api/ubicaciones", params={"sede": sede["name"]}).json()
    assert [u["name"] for u in lista["items"]] == ["Sala de Sistemas 1"]


def test_mismo_nombre_permitido_en_sedes_distintas_y_no_en_la_misma(
    cliente_admin: TestClient,
) -> None:
    sede_a = _crear_sede(cliente_admin, "Sede A")
    sede_b = _crear_sede(cliente_admin, "Sede B")

    _crear_ubicacion(cliente_admin, sede_a["name"], "Bodega Principal")
    # En otra sede sí se permite el mismo nombre.
    _crear_ubicacion(cliente_admin, sede_b["name"], "Bodega Principal")

    # En la misma sede, incluso con distinta capitalización o espacios, falla con 409.
    duplicada = cliente_admin.post(
        "/api/ubicaciones",
        json={"sede": sede_a["name"], "name": "  bodega   PRINCIPAL "},
    )
    assert duplicada.status_code == 409


def test_editar_ubicacion_sincroniza_equipos_vinculados(
    cliente_admin: TestClient, bd: Session
) -> None:
    sede = _crear_sede(cliente_admin, "Altos del Cabo")
    ubicacion = _crear_ubicacion(cliente_admin, sede["name"], "Oficina Proyectos")

    eq = cliente_admin.post(
        "/api/equipos",
        json={
            "code": "FC-LOC-001",
            "sede": sede["name"],
            "locationId": ubicacion["id"],
        },
    )
    assert eq.status_code == 201, eq.text
    equipo = eq.json()
    assert equipo["locationId"] == ubicacion["id"]
    assert equipo["location"] == "Oficina Proyectos"

    edit = cliente_admin.patch(
        f"/api/ubicaciones/{ubicacion['id']}",
        json={"name": "Oficina de Innovación"},
    )
    assert edit.status_code == 200, edit.text

    equipo_actualizado = cliente_admin.get(f"/api/equipos/{equipo['id']}").json()
    assert equipo_actualizado["location"] == "Oficina de Innovación"

    auditoria = bd.scalars(
        select(Auditoria).where(Auditoria.entidad == "ubicaciones")
    ).all()
    assert {a.accion for a in auditoria} >= {"crear", "actualizar"}


def test_equipo_rechaza_ubicacion_de_otra_sede(cliente_admin: TestClient) -> None:
    sede_a = _crear_sede(cliente_admin, "Sede Norte")
    sede_b = _crear_sede(cliente_admin, "Sede Sur")
    ubicacion_b = _crear_ubicacion(cliente_admin, sede_b["name"], "Laboratorio")

    r = cliente_admin.post(
        "/api/equipos",
        json={
            "code": "FC-LOC-002",
            "sede": sede_a["name"],
            "locationId": ubicacion_b["id"],
        },
    )
    assert r.status_code == 422


def test_borrar_ubicacion_conserva_equipo_y_solo_admin_modifica(
    cliente_admin: TestClient, cliente_consulta: TestClient
) -> None:
    sede = _crear_sede(cliente_admin, "Administrativa")
    ubicacion = _crear_ubicacion(cliente_admin, sede["name"], "Recepción")

    assert (
        cliente_consulta.post(
            "/api/ubicaciones", json={"sede": sede["name"], "name": "Otra"}
        ).status_code
        == 403
    )
    assert cliente_consulta.get("/api/ubicaciones").status_code == 200

    eq = cliente_admin.post(
        "/api/equipos",
        json={
            "code": "FC-LOC-003",
            "sede": sede["name"],
            "locationId": ubicacion["id"],
        },
    ).json()

    del_resp = cliente_admin.delete(f"/api/ubicaciones/{ubicacion['id']}")
    assert del_resp.status_code == 204

    equipo = cliente_admin.get(f"/api/equipos/{eq['id']}").json()
    assert equipo["locationId"] is None
    assert equipo["location"] == "Recepción"
