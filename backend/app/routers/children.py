from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.database import get_db
from app.routers.dependencies import require_admin
from typing import Optional
import datetime

router = APIRouter(prefix="/children", tags=["children"])

class ChildCreate(BaseModel):
    parent_id: int
    name: str
    dob: Optional[datetime.date] = None
    service_type_id: int

class ChildUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[datetime.date] = None
    service_type_id: Optional[int] = None

@router.get("/parent/{parent_id}")
def get_children_by_parent(parent_id: int, include_inactive: bool = False, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM parents WHERE id = %s", (parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")
        
        query = """SELECT c.*, st.name as service_name, st.monthly_fee
                    FROM children c
                    JOIN service_types st ON c.service_type_id = st.id
                    WHERE c.parent_id = %s"""
        if not include_inactive:
            query += " AND c.is_active = TRUE"
        query += " ORDER by c.name"

        cursor.execute(query, (parent_id,))
        return cursor.fetchall()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")
    
@router.get("/{child_id}")
def get_child(child_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT c.*, st.name as service_name, st.monthly_fee
            FROM children c
            JOIN service_types st ON c.service_type_id = st.id
            WHERE c.id = %s
            """,
            (child_id,)
        )
        child = cursor.fetchone()
        if not child:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
        return child
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")
    
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_child(data: ChildCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM parents WHERE id = %s", (data.parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")
        
        cursor.execute("SELECT id FROM service_types WHERE id = %s", (data.service_type_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service type not found")
        
        cursor.execute(
            "INSERT INTO children (parent_id, name, dob, service_type_id) VALUES (%s, %s, %s, %s) RETURNING id",
            (data.parent_id, data.name, data.dob, data.service_type_id)
        )
        child_id = cursor.fetchone()["id"]
        conn.commit()
        return {"id": child_id, "message": "Child created successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")

@router.put("/{child_id}")
def update_child(child_id: int, data: ChildUpdate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM children WHERE id = %s", (child_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
        
        if data.service_type_id is not None:
            cursor.execute("SELECT id FROM service_types WHERE id = %s", (data.service_type_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service type not found")
            
        cursor.execute(
            """
            UPDATE children SET
            name = COALESCE(%s, name),
            dob = COALESCE(%s, dob),
            service_type_id = COALESCE(%s, service_type_id)
            WHERE id= %s
            """,
            (data.name, data.dob, data.service_type_id, child_id)
        )
        conn.commit()
        return {"message": "Child updated successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")

@router.patch("/{child_id}/status")
def toggle_child_status(child_id: int, is_active: bool, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM children WHERE id = %s", (child_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")
        
        cursor.execute(
            "UPDATE children SET is_active = %s WHERE id = %s",
            (is_active, child_id)
        )
        conn.commit()
        status_str = "activated" if is_active else "deactivated"
        return {"message": f"Child {status_str} successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database Error")