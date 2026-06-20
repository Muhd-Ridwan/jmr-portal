from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from app.database import get_db
from app.routers.dependencies import require_admin, require_superadmin
from app.emails import send_onboarding_email
import secrets
from datetime import datetime, timedelta, timezone

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

@router.get("/")
def get_parents(conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM parents ORDER BY parent_name")
        parents = cursor.fetchall()
        return parents
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")
    
@router.get("/{parent_id}")
def get_parent(parent_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM parents WHERE id = %s", (parent_id,))
        parent = cursor.fetchone()
        if not parent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")
        
        cursor.execute("SELECT * FROM phone_numbers WHERE parent_id = %s", (parent_id,))
        phones = cursor.fetchall()

        cursor.execute("SELECT * FROM children WHERE parent_id = %s AND is_active = TRUE", (parent_id,))
        children = cursor.fetchall()

        return {**parent, "phone_numbers": phones, "children": children}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")

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
        return {"id": parent_id, "message": "Parent created successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")

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
        conn.commit()
        return {"message": "Parent updated successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")