import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from psycopg2 import errors as pg_errors
from app.database import get_db
from app.routers.dependencies import require_superadmin, require_admin, get_current_user
import bcrypt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    phone_num: str | None = None
    address: str | None = None

class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    current_password: str | None = None
    new_password: str | None = None

@router.get("/me")
def get_me(conn=Depends(get_db), current_user=Depends(get_current_user)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT u.id, u.name, u.email, u.phone_num, u.address, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = %s",
            (current_user["id"],)
        )
        return cursor.fetchone()
    except Exception:
        logger.exception("Failed to retrieve profile for user %s", current_user["id"])
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve profile. Please try again.")

@router.put("/me")
def update_me(data: ProfileUpdate, conn=Depends(get_db), current_user=Depends(get_current_user)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = %s", (current_user["id"],))
        user = cursor.fetchone()

        if data.new_password:
            if not data.current_password:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is required to set a new password.")
            if not user["password"] or not bcrypt.checkpw(data.current_password.encode(), user["password"].encode()):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

        if data.email and data.email != user["email"]:
            cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (data.email, current_user["id"]))
            if cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

        new_password_hash = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode() if data.new_password else None

        cursor.execute(
            """UPDATE users SET
               name = COALESCE(%s, name),
               email = COALESCE(%s, email),
               password = COALESCE(%s, password)
               WHERE id = %s""",
            (data.name, data.email, new_password_hash, current_user["id"])
        )
        conn.commit()
        return {"message": "Profile updated successfully"}
    except HTTPException:
        raise
    except pg_errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    except Exception:
        conn.rollback()
        logger.exception("Failed to update profile for user %s", current_user["id"])
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update profile. Please try again.")

@router.get("/")
def get_users(conn=Depends(get_db), current_user=Depends(require_superadmin)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT u.id, u.name, u.email, u.phone_num, u.address, u.created_at, r.name as role
               FROM users u JOIN roles r ON u.role_id = r.id
               ORDER BY u.created_at DESC"""
        )
        return cursor.fetchall()
    except Exception:
        logger.exception("Failed to retrieve users")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve users. Please try again.")

@router.post("/admin", status_code=status.HTTP_201_CREATED)
def create_admin(data: UserCreate, conn=Depends(get_db), current_user=Depends(require_superadmin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = %s", (data.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

        cursor.execute("SELECT id FROM roles WHERE name = 'admin'")
        role = cursor.fetchone()

        hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

        cursor.execute(
            "INSERT INTO users (name, email, password, phone_num, address, role_id) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (data.name, data.email, hashed, data.phone_num, data.address, role["id"])
        )
        user_id = cursor.fetchone()["id"]
        conn.commit()
        return {"id": user_id, "message": "Admin created successfully"}
    except HTTPException:
        raise
    except pg_errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    except Exception:
        conn.rollback()
        logger.exception("Failed to create admin account")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create admin account. Please try again.")

@router.post("/user", status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = %s", (data.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

        cursor.execute("SELECT id FROM roles WHERE name = 'user'")
        role = cursor.fetchone()

        hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

        cursor.execute(
            "INSERT INTO users (name, email, password, phone_num, address, role_id) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (data.name, data.email, hashed, data.phone_num, data.address, role["id"])
        )
        user_id = cursor.fetchone()["id"]
        conn.commit()
        return {"id": user_id, "message": "User created successfully"}
    except HTTPException:
        raise
    except pg_errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    except Exception:
        conn.rollback()
        logger.exception("Failed to create user account")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user account. Please try again.")

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, conn=Depends(get_db), current_user=Depends(require_superadmin)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT u.id, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = %s",
            (user_id,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user["role"] == "superadmin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete superadmin")

        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to delete user %s", user_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete user. Please try again.")
