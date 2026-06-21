import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from psycopg2 import errors as pg_errors
from app.database import get_db
from app.routers.dependencies import require_admin, require_superadmin, get_current_user
from app.routers.children import _attach_services
from app.emails import send_onboarding_email
import secrets
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/parents", tags=["parents"])

class ParentCreate(BaseModel):
    parent_name: str
    email: str | None = None
    address: str | None = None
    phone_numbers: list[str]

    @field_validator("phone_numbers")
    @classmethod
    def must_have_at_least_one(cls, v):
        if not v or len(v) < 1:
            raise ValueError("At least one phone number is required")
        return v

class ParentUpdate(BaseModel):
    parent_name: str | None = None
    email: str | None = None
    address: str | None = None
    phone_numbers: list[str] | None = None

    @field_validator("phone_numbers")
    @classmethod
    def must_have_at_least_one(cls, v):
        if v is not None and len(v) < 1:
            raise ValueError("At least one phone number is required")
        return v

@router.get("/")
def get_parents(include_inactive: bool = False, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        if include_inactive:
            cursor.execute("SELECT * FROM parents ORDER BY parent_name")
        else:
            cursor.execute("SELECT * FROM parents WHERE is_active = TRUE ORDER BY parent_name")
        return cursor.fetchall()
    except Exception:
        logger.exception("Failed to retrieve parents")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve parents. Please try again.")

@router.get("/me")
def get_my_profile(conn=Depends(get_db), current_user=Depends(get_current_user)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM parents WHERE user_id = %s", (current_user["id"],))
        parent = cursor.fetchone()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No parent profile linked to this account")

        cursor.execute("SELECT * FROM phone_numbers WHERE parent_id = %s", (parent["id"],))
        phones = cursor.fetchall()

        cursor.execute(
            "SELECT * FROM children WHERE parent_id = %s AND is_active = TRUE ORDER BY name",
            (parent["id"],)
        )
        children = _attach_services(cursor, cursor.fetchall())

        enriched = []
        for child in children:
            cursor.execute("SELECT id FROM registration_payments WHERE child_id = %s", (child["id"],))
            enriched.append({**child, "registration_paid": cursor.fetchone() is not None})

        return {**parent, "phone_numbers": phones, "children": enriched}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve profile for user %s", current_user["id"])
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve your profile. Please try again.")


@router.get("/{parent_id}")
def get_parent(parent_id: int, include_inactive: bool = False, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM parents WHERE id = %s", (parent_id,))
        parent = cursor.fetchone()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        cursor.execute("SELECT * FROM phone_numbers WHERE parent_id = %s", (parent_id,))
        phones = cursor.fetchall()

        children_query = "SELECT * FROM children WHERE parent_id = %s"
        if not include_inactive:
            children_query += " AND is_active = TRUE"
        children_query += " ORDER BY name"
        cursor.execute(children_query, (parent_id,))
        children = _attach_services(cursor, cursor.fetchall())

        return {**parent, "phone_numbers": phones, "children": children}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve parent %s", parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve parent details. Please try again.")

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_parent(data: ParentCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM roles WHERE name = 'user'")
        user_role = cursor.fetchone()

        cursor.execute(
            "INSERT INTO users (name, email, password, role_id) VALUES (%s, %s, %s, %s) RETURNING id",
            (data.parent_name, data.email, None, user_role["id"])
        )
        user_id = cursor.fetchone()["id"]

        cursor.execute(
            "INSERT INTO parents (parent_name, email, address, user_id) VALUES (%s, %s, %s, %s) RETURNING id",
            (data.parent_name, data.email, data.address, user_id)
        )
        parent_id = cursor.fetchone()["id"]

        for phone in data.phone_numbers:
            cursor.execute(
                "INSERT INTO phone_numbers (parent_id, phone_num) VALUES (%s, %s)",
                (parent_id, phone)
            )
        conn.commit()
        return {"id": parent_id, "message": "Parent registered successfully"}
    except HTTPException:
        raise
    except pg_errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A parent with this email is already registered.")
    except Exception:
        conn.rollback()
        logger.exception("Failed to create parent")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to register parent. Please try again.")

@router.put("/{parent_id}")
def update_parent(parent_id: int, data: ParentUpdate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM parents WHERE id = %s", (parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        cursor.execute(
            """
            UPDATE parents SET
            parent_name = COALESCE(%s, parent_name),
            email = COALESCE(%s, email),
            address = COALESCE(%s, address)
            WHERE id = %s
            """,
            (data.parent_name, data.email, data.address, parent_id)
        )
        if data.email:
            cursor.execute(
                "UPDATE users SET email = %s WHERE id = (SELECT user_id FROM parents WHERE id = %s)",
                (data.email, parent_id)
            )
        if data.phone_numbers is not None:
            cursor.execute("DELETE FROM phone_numbers WHERE parent_id = %s", (parent_id,))
            for phone in data.phone_numbers:
                cursor.execute(
                    "INSERT INTO phone_numbers (parent_id, phone_num) VALUES (%s, %s)",
                    (parent_id, phone)
                )
        conn.commit()
        return {"message": "Parent updated successfully"}
    except HTTPException:
        raise
    except pg_errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A parent with this email is already registered.")
    except Exception:
        conn.rollback()
        logger.exception("Failed to update parent %s", parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update parent. Please try again.")

@router.delete("/{parent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_parent(parent_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM parents WHERE id = %s", (parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        cursor.execute("DELETE FROM parents WHERE id = %s", (parent_id,))
        conn.commit()
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to delete parent %s", parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete parent. Please try again.")

@router.patch("/{parent_id}/toggle-active")
def toggle_parent_active(parent_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, is_active FROM parents WHERE id = %s", (parent_id,))
        parent = cursor.fetchone()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        new_status = not parent["is_active"]
        cursor.execute("UPDATE parents SET is_active = %s WHERE id = %s", (new_status, parent_id))

        if not new_status:
            cursor.execute("UPDATE children SET is_active = FALSE WHERE parent_id = %s", (parent_id,))

        conn.commit()
        action = "activated" if new_status else "deactivated"
        return {"message": f"Parent {action} successfully", "is_active": new_status}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to toggle status for parent %s", parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update parent status. Please try again.")

@router.post("/{parent_id}/send-onboarding")
def send_onboarding(parent_id: int, conn=Depends(get_db), current_user=Depends(require_superadmin)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT p.*, u.email as user_email FROM parents p JOIN users u ON p.user_id = u.id WHERE p.id = %s",
            (parent_id,)
        )
        parent = cursor.fetchone()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

        cursor.execute(
            "DELETE FROM password_reset_tokens WHERE user_id = (SELECT user_id FROM parents WHERE id = %s)",
            (parent_id,)
        )
        cursor.execute(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (parent["user_id"], token, expires_at)
        )
        conn.commit()

        send_onboarding_email(parent["user_email"], parent["parent_name"], token)
        return {"message": "Onboarding email sent successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to send onboarding email for parent %s", parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send onboarding email. Please try again.")
