from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.database import get_db
from app.routers.dependencies import require_admin
from typing import Optional
import datetime

router = APIRouter(prefix="/payments", tags=["payments"])

class FeePaymentItem(BaseModel):
    child_id: int
    month: int
    year: int
    amount: float

class PaymentSessionCreate(BaseModel):
    parent_id: int
    total_amount: float
    payment_method: str
    notes: Optional[str] = None
    paid_at: datetime.datetime
    fee_payments: list[FeePaymentItem]

class RegistrationPaymentCreate(BaseModel):
    amount: float
    payment_method: str
    paid_at: datetime.datetime


@router.post("/session", status_code=status.HTTP_201_CREATED)
def create_payment_session(data: PaymentSessionCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM parents WHERE id = %s", (data.parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        if not data.fee_payments:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one fee payment is required")

        for item in data.fee_payments:
            if not (1 <= item.month <= 12):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid month {item.month}")

            cursor.execute("SELECT id FROM children WHERE id = %s AND parent_id = %s", (item.child_id, data.parent_id))
            if not cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Child {item.child_id} does not belong to this parent")

            cursor.execute(
                "SELECT id FROM fee_payments WHERE child_id = %s AND month = %s AND year = %s",
                (item.child_id, item.month, item.year)
            )
            if cursor.fetchone():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Payment already exists for child {item.child_id} on {item.month}/{item.year}")

        cursor.execute(
            """INSERT INTO payment_sessions (parent_id, total_amount, payment_method, notes, paid_at, created_by)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (data.parent_id, data.total_amount, data.payment_method, data.notes, data.paid_at, current_user["id"])
        )
        session_id = cursor.fetchone()["id"]

        for item in data.fee_payments:
            cursor.execute(
                """INSERT INTO fee_payments (session_id, child_id, month, year, amount)
                   VALUES (%s, %s, %s, %s, %s)""",
                (session_id, item.child_id, item.month, item.year, item.amount)
            )

        conn.commit()
        return {"id": session_id, "message": "Payment recorded successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")


@router.post("/registration/{child_id}", status_code=status.HTTP_201_CREATED)
def create_registration_payment(child_id: int, data: RegistrationPaymentCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM children WHERE id = %s", (child_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")

        cursor.execute("SELECT id FROM registration_payments WHERE child_id = %s", (child_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Registration fee already paid for this child")

        cursor.execute(
            """INSERT INTO registration_payments (child_id, amount, payment_method, paid_at, created_by)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (child_id, data.amount, data.payment_method, data.paid_at, current_user["id"])
        )
        payment_id = cursor.fetchone()["id"]
        conn.commit()
        return {"id": payment_id, "message": "Registration payment recorded successfully"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")


@router.get("/pending/{child_id}")
def get_pending_months(child_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute(
            """SELECT c.id, c.name, c.created_at, st.monthly_fee
               FROM children c
               JOIN service_types st ON c.service_type_id = st.id
               WHERE c.id = %s""",
            (child_id,)
        )
        child = cursor.fetchone()
        if not child:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")

        cursor.execute("SELECT month, year FROM fee_payments WHERE child_id = %s", (child_id,))
        paid = {(row["month"], row["year"]) for row in cursor.fetchall()}

        start = child["created_at"].date().replace(day=1)
        today = datetime.date.today().replace(day=1)

        pending = []
        current = start
        while current <= today:
            if (current.month, current.year) not in paid:
                pending.append({"month": current.month, "year": current.year, "amount": child["monthly_fee"]})
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)

        cursor.execute("SELECT id FROM registration_payments WHERE child_id = %s", (child_id,))
        registration_paid = cursor.fetchone() is not None

        return {
            "child_id": child_id,
            "child_name": child["name"],
            "registration_paid": registration_paid,
            "pending_months": pending
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")


@router.get("/history/{parent_id}")
def get_payment_history(parent_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM parents WHERE id = %s", (parent_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")

        cursor.execute(
            """SELECT ps.*, u.name as recorded_by
               FROM payment_sessions ps
               JOIN users u ON ps.created_by = u.id
               WHERE ps.parent_id = %s
               ORDER BY ps.paid_at DESC""",
            (parent_id,)
        )
        sessions = cursor.fetchall()

        result = []
        for session in sessions:
            cursor.execute(
                """SELECT fp.*, c.name as child_name
                   FROM fee_payments fp
                   JOIN children c ON fp.child_id = c.id
                   WHERE fp.session_id = %s""",
                (session["id"],)
            )
            result.append({**session, "fee_payments": cursor.fetchall()})

        return result
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")


@router.get("/overdue")
def get_overdue_payments(conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        today = datetime.date.today()

        cursor.execute(
            """SELECT c.id as child_id, c.name as child_name, c.created_at,
                      p.id as parent_id, p.parent_name, st.monthly_fee
               FROM children c
               JOIN parents p ON c.parent_id = p.id
               JOIN service_types st ON c.service_type_id = st.id
               WHERE c.is_active = TRUE"""
        )
        children = cursor.fetchall()

        overdue = []
        for child in children:
            cursor.execute(
                "SELECT month, year FROM fee_payments WHERE child_id = %s",
                (child["child_id"],)
            )
            paid = {(row["month"], row["year"]) for row in cursor.fetchall()}

            start = child["created_at"].date().replace(day=1)
            current = start
            pending_months = []

            while current < today.replace(day=1):
                if (current.month, current.year) not in paid:
                    pending_months.append({"month": current.month, "year": current.year})
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)

            if pending_months:
                overdue.append({
                    "child_id": child["child_id"],
                    "child_name": child["child_name"],
                    "parent_id": child["parent_id"],
                    "parent_name": child["parent_name"],
                    "monthly_fee": child["monthly_fee"],
                    "overdue_months": pending_months,
                    "overdue_count": len(pending_months)
                })

        return overdue
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error")
