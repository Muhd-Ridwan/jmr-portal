from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.database import get_db
from app.routers.dependencies import require_superadmin, require_admin
import bcrypt

router = APIRouter(prefix="/users", tags=["users"])

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    phone_num: str | None = None
    address: str | None = None

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")

@router.post("/admin", status_code=status.HTTP_201_CREATED)
def create_admin(data: UserCreate, conn=Depends(get_db), current_user=Depends(require_superadmin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = %s", (data.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

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
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")

@router.post("/user", status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM users WHERE email = %s", (data.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

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
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")

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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")
