import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.database import get_db
from app.routers.dependencies import require_admin
from typing import Optional
import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/children", tags=["children"])


def _attach_services(cursor, children: list) -> list:
    """Fetch services for a list of children and merge them in, computing monthly_fee sum."""
    if not children:
        return children
    child_ids = [c["id"] for c in children]
    cursor.execute(
        """SELECT cs.child_id, st.id, st.name, st.monthly_fee, st.registration_fee, st.is_active
           FROM child_services cs
           JOIN service_types st ON cs.service_type_id = st.id
           WHERE cs.child_id = ANY(%s)
           ORDER BY st.id""",
        (child_ids,)
    )
    services_map: dict = {}
    for row in cursor.fetchall():
        cid = row["child_id"]
        services_map.setdefault(cid, []).append({
            "id": row["id"], "name": row["name"],
            "monthly_fee": float(row["monthly_fee"]),
            "registration_fee": float(row["registration_fee"]),
            "is_active": row["is_active"],
        })
    result = []
    for child in children:
        svcs = services_map.get(child["id"], [])
        result.append({
            **child,
            "service_types": svcs,
            "monthly_fee": sum(s["monthly_fee"] for s in svcs),
        })
    return result


# ── Service type endpoints ────────────────────────────────────────────────────

class ServiceTypeCreate(BaseModel):
    name: str
    monthly_fee: float
    registration_fee: float

class ServiceTypeUpdate(BaseModel):
    name: Optional[str] = None
    monthly_fee: Optional[float] = None
    registration_fee: Optional[float] = None

@router.get("/service-types")
def get_service_types(include_inactive: bool = False, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        query = "SELECT * FROM service_types"
        if not include_inactive:
            query += " WHERE is_active = TRUE"
        query += " ORDER BY id"
        cursor.execute(query)
        return cursor.fetchall()
    except Exception:
        logger.exception("Failed to retrieve service types")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve service types. Please try again.")

@router.post("/service-types", status_code=status.HTTP_201_CREATED)
def create_service_type(data: ServiceTypeCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM service_types WHERE name = %s", (data.name,))
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A service with this name already exists.")
        cursor.execute(
            "INSERT INTO service_types (name, monthly_fee, registration_fee) VALUES (%s, %s, %s) RETURNING id",
            (data.name, data.monthly_fee, data.registration_fee)
        )
        service_id = cursor.fetchone()["id"]
        conn.commit()
        return {"id": service_id, "message": "Service type created successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to create service type")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create service type. Please try again.")

@router.put("/service-types/{service_id}")
def update_service_type(service_id: int, data: ServiceTypeUpdate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM service_types WHERE id = %s", (service_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service type not found")
        if data.name:
            cursor.execute("SELECT id FROM service_types WHERE name = %s AND id != %s", (data.name, service_id))
            if cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A service with this name already exists.")
        cursor.execute(
            """UPDATE service_types SET
               name = COALESCE(%s, name),
               monthly_fee = COALESCE(%s, monthly_fee),
               registration_fee = COALESCE(%s, registration_fee)
               WHERE id = %s""",
            (data.name, data.monthly_fee, data.registration_fee, service_id)
        )
        conn.commit()
        return {"message": "Service type updated successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to update service type %s", service_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update service type. Please try again.")

@router.patch("/service-types/{service_id}/status")
def toggle_service_type_status(service_id: int, is_active: bool, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM service_types WHERE id = %s", (service_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service type not found")
        cursor.execute("UPDATE service_types SET is_active = %s WHERE id = %s", (is_active, service_id))
        conn.commit()
        status_str = "activated" if is_active else "deactivated"
        return {"message": f"Service {status_str} successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to toggle status for service type %s", service_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update service status. Please try again.")


# ── Child endpoints ───────────────────────────────────────────────────────────

class ChildCreate(BaseModel):
    parent_id: int
    name: str
    dob: Optional[datetime.date] = None
    service_type_ids: list[int]

class ChildUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[datetime.date] = None
    service_type_ids: Optional[list[int]] = None

@router.get("/parent/{parent_id}")
def get_children_by_parent(parent_id: int, include_inactive: bool = False, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM parents WHERE id = %s", (parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        query = "SELECT * FROM children WHERE parent_id = %s"
        if not include_inactive:
            query += " AND is_active = TRUE"
        query += " ORDER BY name"
        cursor.execute(query, (parent_id,))
        children = cursor.fetchall()
        return _attach_services(cursor, children)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve children for parent %s", parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve children. Please try again.")

@router.get("/{child_id}")
def get_child(child_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM children WHERE id = %s", (child_id,))
        child = cursor.fetchone()
        if not child:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
        return _attach_services(cursor, [child])[0]
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve child %s", child_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve child details. Please try again.")

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_child(data: ChildCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        if not data.service_type_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one service type is required.")
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM parents WHERE id = %s", (data.parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        for sid in data.service_type_ids:
            cursor.execute("SELECT id FROM service_types WHERE id = %s AND is_active = TRUE", (sid,))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service type {sid} not found or inactive.")

        cursor.execute(
            "INSERT INTO children (parent_id, name, dob) VALUES (%s, %s, %s) RETURNING id",
            (data.parent_id, data.name, data.dob)
        )
        child_id = cursor.fetchone()["id"]

        for sid in data.service_type_ids:
            cursor.execute(
                "INSERT INTO child_services (child_id, service_type_id) VALUES (%s, %s)",
                (child_id, sid)
            )
        conn.commit()
        return {"id": child_id, "message": "Child added successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to create child for parent %s", data.parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to add child. Please try again.")

@router.put("/{child_id}")
def update_child(child_id: int, data: ChildUpdate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM children WHERE id = %s", (child_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")

        if data.service_type_ids is not None:
            if not data.service_type_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one service type is required.")
            for sid in data.service_type_ids:
                cursor.execute("SELECT id FROM service_types WHERE id = %s AND is_active = TRUE", (sid,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Service type {sid} not found or inactive.")
            cursor.execute("DELETE FROM child_services WHERE child_id = %s", (child_id,))
            for sid in data.service_type_ids:
                cursor.execute(
                    "INSERT INTO child_services (child_id, service_type_id) VALUES (%s, %s)",
                    (child_id, sid)
                )

        cursor.execute(
            "UPDATE children SET name = COALESCE(%s, name), dob = COALESCE(%s, dob) WHERE id = %s",
            (data.name, data.dob, child_id)
        )
        conn.commit()
        return {"message": "Child updated successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to update child %s", child_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update child. Please try again.")

@router.patch("/{child_id}/status")
def toggle_child_status(child_id: int, is_active: bool, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM children WHERE id = %s", (child_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
        cursor.execute("UPDATE children SET is_active = %s WHERE id = %s", (is_active, child_id))
        conn.commit()
        status_str = "activated" if is_active else "deactivated"
        return {"message": f"Child {status_str} successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to toggle status for child %s", child_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update child status. Please try again.")
