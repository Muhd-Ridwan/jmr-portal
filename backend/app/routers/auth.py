# Testing a CICD5
import logging
import bcrypt
import jwt
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.database import get_db
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REFRESH_TOKEN_EXPIRE_DAYS
from app.emails import send_password_reset_email
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

class SetupRequest(BaseModel):
    name: str
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

router = APIRouter(prefix="/auth", tags=["auth"])


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), conn=Depends(get_db)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = %s",
            (form_data.username,)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        if not user["password"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not activated yet")

        if not bcrypt.checkpw(form_data.password.encode(), user["password"].encode()):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        cursor.execute("SELECT is_active FROM parents WHERE user_id = %s", (user["id"],))
        parent = cursor.fetchone()
        if parent and not parent["is_active"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account has been deactivated. Please contact the administrator.")

        payload = {"sub": str(user["id"]), "email": user["email"], "name": user["name"], "role": user["role"]}
        access_token = create_access_token(payload)
        refresh_token = create_refresh_token(payload)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Login failed for %s", form_data.username)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed. Please try again.")


@router.post("/refresh")
def refresh(token: str, conn=Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

        cursor = conn.cursor()
        cursor.execute(
            "SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = %s",
            (payload["sub"],)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        new_payload = {"sub": str(user["id"]), "email": user["email"], "name": user["name"], "role": user["role"]}
        return {
            "access_token": create_access_token(new_payload),
            "token_type": "bearer"
        }
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")
    except Exception:
        logger.exception("Token refresh failed")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Session refresh failed. Please log in again.")

@router.post("/setup")
def setup_admin(data: SetupRequest, conn=Depends(get_db)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users LIMIT 1")
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Setup already completed")
        cursor.execute("SELECT id FROM roles WHERE name = 'superadmin'")
        admin_role = cursor.fetchone()

        hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

        cursor.execute(
            "INSERT INTO users (name, email, password, role_id) VALUES (%s, %s, %s, %s)",
            (data.name, data.email, hashed, admin_role["id"])
        )
        conn.commit()

        return {"message": "Admin account created successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to create superadmin account")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create admin account. Please try again.")


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, conn=Depends(get_db)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT u.*, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = %s",
            (data.email,)
        )
        user = cursor.fetchone()

        if not user:
            return {"message": "If that email exists, a reset link has been sent"}

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user["id"],))
        cursor.execute(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user["id"], token, expires_at)
        )
        conn.commit()

        send_password_reset_email(user["email"], user["name"], token)
        return {"message": "If that email exists, a reset link has been sent"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to process forgot password for %s", data.email)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send reset email. Please try again.")


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, conn=Depends(get_db)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM password_reset_tokens WHERE token = %s",
            (data.token,)
        )
        reset_token = cursor.fetchone()

        if not reset_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

        if reset_token["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            cursor.execute("DELETE FROM password_reset_tokens WHERE token = %s", (data.token,))
            conn.commit()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token has expired")

        hashed = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()

        cursor.execute("UPDATE users SET password = %s WHERE id = %s", (hashed, reset_token["user_id"]))
        cursor.execute("DELETE FROM password_reset_tokens WHERE token = %s", (data.token,))
        conn.commit()
        return {"message": "Password reset successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to reset password")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reset password. Please try again.")
