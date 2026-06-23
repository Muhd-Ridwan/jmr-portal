import logging
import re
import uuid
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import boto3
from botocore.config import Config as BotocoreConfig
from app.database import get_db
from app.routers.dependencies import require_admin, get_current_user
from app.config import R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET

logger = logging.getLogger(__name__)

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
    receipt_key: Optional[str] = None

class RegistrationPaymentCreate(BaseModel):
    amount: float
    payment_method: str
    paid_at: datetime.datetime

class ReceiptUploadRequest(BaseModel):
    filename: str
    content_type: str


@router.post("/upload-url")
def get_receipt_upload_url(data: ReceiptUploadRequest, current_user=Depends(require_admin)):
    allowed_types = {"application/pdf", "image/png", "image/jpeg"}
    if data.content_type not in allowed_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF, PNG, and JPG files are allowed")

    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", data.filename)[:100]
    now = datetime.datetime.now()
    key = f"receipts/{now.year}/{now.month:02d}/{uuid.uuid4().hex}-{safe_name}"

    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=BotocoreConfig(signature_version="s3v4"),
            region_name="auto",
        )
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": R2_BUCKET, "Key": key, "ContentType": data.content_type},
            ExpiresIn=300,
        )
        return {"upload_url": upload_url, "key": key}
    except Exception:
        logger.exception("Failed to generate R2 upload URL")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate upload URL. Please try again.")


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

            cursor.execute("SELECT id, name FROM children WHERE id = %s AND parent_id = %s", (item.child_id, data.parent_id))
            child_row = cursor.fetchone()
            if not child_row:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Child {item.child_id} does not belong to this parent")

            cursor.execute(
                "SELECT id FROM fee_payments WHERE child_id = %s AND month = %s AND year = %s",
                (item.child_id, item.month, item.year)
            )
            if cursor.fetchone():
                month_names = ["January", "February", "March", "April", "May", "June",
                               "July", "August", "September", "October", "November", "December"]
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"{month_names[item.month - 1]} {item.year} payment for {child_row['name']} has already been recorded"
                )

        cursor.execute(
            """INSERT INTO payment_sessions (parent_id, total_amount, payment_method, notes, paid_at, created_by, receipt_key)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (data.parent_id, data.total_amount, data.payment_method, data.notes, data.paid_at, current_user["id"], data.receipt_key)
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
        logger.exception("Failed to create payment session for parent %s", data.parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to record payment. Please try again.")


@router.post("/registration/{child_id}", status_code=status.HTTP_201_CREATED)
def create_registration_payment(child_id: int, data: RegistrationPaymentCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM children WHERE id = %s", (child_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Child not found")

        cursor.execute("SELECT id FROM registration_payments WHERE child_id = %s", (child_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Registration fee has already been paid for this child")

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
        logger.exception("Failed to create registration payment for child %s", child_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to record registration payment. Please try again.")


@router.get("/pending/{child_id}")
def get_pending_months(child_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()

        cursor.execute(
            """SELECT c.id, c.name, c.created_at,
                      COALESCE(SUM(st.monthly_fee), 0) as monthly_fee
               FROM children c
               LEFT JOIN child_services cs ON c.id = cs.child_id
               LEFT JOIN service_types st ON cs.service_type_id = st.id
               WHERE c.id = %s
               GROUP BY c.id, c.name, c.created_at""",
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

        cursor.execute(
            """SELECT COALESCE(SUM(st.registration_fee), 0) as total_reg_fee
               FROM child_services cs
               JOIN service_types st ON cs.service_type_id = st.id
               WHERE cs.child_id = %s""",
            (child_id,)
        )
        reg_fee_row = cursor.fetchone()
        total_reg_fee = reg_fee_row["total_reg_fee"] if reg_fee_row else 0

        cursor.execute(
            """SELECT rp.id, rp.paid_at, rp.amount, rp.payment_method, u.name as recorded_by
               FROM registration_payments rp
               JOIN users u ON rp.created_by = u.id
               WHERE rp.child_id = %s""",
            (child_id,)
        )
        reg = cursor.fetchone()
        registration_paid = reg is not None or total_reg_fee == 0
        registration_payment = dict(reg) if reg else None

        return {
            "child_id": child_id,
            "child_name": child["name"],
            "registration_paid": registration_paid,
            "registration_payment": registration_payment,
            "pending_months": pending
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve pending months for child %s", child_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve pending payments. Please try again.")


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

        cursor.execute(
            """SELECT rp.id, rp.child_id, c.name as child_name, rp.amount,
                      rp.payment_method, rp.paid_at, u.name as recorded_by
               FROM registration_payments rp
               JOIN children c ON rp.child_id = c.id
               JOIN users u ON rp.created_by = u.id
               WHERE c.parent_id = %s
               ORDER BY rp.paid_at DESC""",
            (parent_id,)
        )
        registration_payments = [dict(rp) for rp in cursor.fetchall()]

        return {"sessions": result, "registration_payments": registration_payments}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve payment history for parent %s", parent_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve payment history. Please try again.")


@router.get("/registration/unpaid")
def get_unpaid_registration(conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT c.id as child_id, c.name as child_name,
                      p.id as parent_id, p.parent_name,
                      COALESCE(SUM(st.registration_fee), 0) as registration_fee
               FROM children c
               JOIN parents p ON c.parent_id = p.id
               LEFT JOIN child_services cs ON c.id = cs.child_id
               LEFT JOIN service_types st ON cs.service_type_id = st.id
               WHERE c.is_active = TRUE AND p.is_active = TRUE
                 AND NOT EXISTS (
                     SELECT 1 FROM registration_payments rp WHERE rp.child_id = c.id
                 )
               GROUP BY c.id, c.name, p.id, p.parent_name
               HAVING COALESCE(SUM(st.registration_fee), 0) > 0
               ORDER BY p.parent_name, c.name"""
        )
        return cursor.fetchall()
    except Exception:
        logger.exception("Failed to retrieve children with unpaid registration")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve unpaid registrations. Please try again.")


@router.get("/session/{session_id}/receipt")
def get_receipt_url(session_id: int, download: bool = False, conn=Depends(get_db), current_user=Depends(get_current_user)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT receipt_key, parent_id FROM payment_sessions WHERE id = %s", (session_id,))
        session = cursor.fetchone()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment session not found")

        if current_user["role"] == "user":
            cursor.execute("SELECT id FROM parents WHERE user_id = %s", (current_user["id"],))
            parent = cursor.fetchone()
            if not parent or parent["id"] != session["parent_id"]:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        if not session["receipt_key"]:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No receipt for this payment")

        s3 = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=BotocoreConfig(signature_version="s3v4"),
            region_name="auto",
        )
        params: dict = {"Bucket": R2_BUCKET, "Key": session["receipt_key"]}
        if download:
            filename = session["receipt_key"].split("/")[-1]
            display_name = filename.split("-", 1)[1] if "-" in filename else filename
            params["ResponseContentDisposition"] = f'attachment; filename="{display_name}"'

        url = s3.generate_presigned_url("get_object", Params=params, ExpiresIn=900)
        return {"url": url}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to generate receipt URL for session %s", session_id)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate receipt URL. Please try again.")


@router.get("/overdue/me")
def get_my_overdue_payments(conn=Depends(get_db), current_user=Depends(get_current_user)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM parents WHERE user_id = %s", (current_user["id"],))
        parent = cursor.fetchone()
        if not parent:
            return []

        today = datetime.date.today()
        cursor.execute(
            """SELECT c.id as child_id, c.name as child_name, c.created_at,
                      p.id as parent_id, p.parent_name,
                      COALESCE(SUM(st.monthly_fee), 0) as monthly_fee
               FROM children c
               JOIN parents p ON c.parent_id = p.id
               LEFT JOIN child_services cs ON c.id = cs.child_id
               LEFT JOIN service_types st ON cs.service_type_id = st.id
               WHERE c.is_active = TRUE AND p.id = %s
               GROUP BY c.id, c.name, c.created_at, p.id, p.parent_name""",
            (parent["id"],)
        )
        children = cursor.fetchall()

        overdue = []
        for child in children:
            cursor.execute("SELECT month, year FROM fee_payments WHERE child_id = %s", (child["child_id"],))
            paid = {(row["month"], row["year"]) for row in cursor.fetchall()}

            cursor.execute(
                """SELECT COALESCE(SUM(st.registration_fee), 0) as total_reg_fee
                   FROM child_services cs
                   JOIN service_types st ON cs.service_type_id = st.id
                   WHERE cs.child_id = %s""",
                (child["child_id"],)
            )
            reg_fee_row = cursor.fetchone()
            total_reg_fee = reg_fee_row["total_reg_fee"] if reg_fee_row else 0

            cursor.execute("SELECT id FROM registration_payments WHERE child_id = %s", (child["child_id"],))
            registration_pending = cursor.fetchone() is None and total_reg_fee > 0

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

            if pending_months or registration_pending:
                overdue.append({
                    "child_id": child["child_id"],
                    "child_name": child["child_name"],
                    "parent_id": child["parent_id"],
                    "parent_name": child["parent_name"],
                    "monthly_fee": child["monthly_fee"],
                    "overdue_months": pending_months,
                    "overdue_count": len(pending_months),
                    "registration_pending": registration_pending,
                })

        return overdue
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve overdue payments for user %s", current_user["id"])
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve overdue payments. Please try again.")


@router.get("/overdue")
def get_overdue_payments(conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        today = datetime.date.today()

        cursor.execute(
            """SELECT c.id as child_id, c.name as child_name, c.created_at,
                      p.id as parent_id, p.parent_name,
                      COALESCE(SUM(st.monthly_fee), 0) as monthly_fee
               FROM children c
               JOIN parents p ON c.parent_id = p.id
               LEFT JOIN child_services cs ON c.id = cs.child_id
               LEFT JOIN service_types st ON cs.service_type_id = st.id
               WHERE c.is_active = TRUE AND p.is_active = TRUE
               GROUP BY c.id, c.name, c.created_at, p.id, p.parent_name"""
        )
        children = cursor.fetchall()

        overdue = []
        for child in children:
            cursor.execute(
                "SELECT month, year FROM fee_payments WHERE child_id = %s",
                (child["child_id"],)
            )
            paid = {(row["month"], row["year"]) for row in cursor.fetchall()}

            cursor.execute(
                """SELECT COALESCE(SUM(st.registration_fee), 0) as total_reg_fee
                   FROM child_services cs
                   JOIN service_types st ON cs.service_type_id = st.id
                   WHERE cs.child_id = %s""",
                (child["child_id"],)
            )
            reg_fee_row = cursor.fetchone()
            total_reg_fee = reg_fee_row["total_reg_fee"] if reg_fee_row else 0

            cursor.execute("SELECT id FROM registration_payments WHERE child_id = %s", (child["child_id"],))
            registration_pending = cursor.fetchone() is None and total_reg_fee > 0

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

            if pending_months or registration_pending:
                overdue.append({
                    "child_id": child["child_id"],
                    "child_name": child["child_name"],
                    "parent_id": child["parent_id"],
                    "parent_name": child["parent_name"],
                    "monthly_fee": child["monthly_fee"],
                    "overdue_months": pending_months,
                    "overdue_count": len(pending_months),
                    "registration_pending": registration_pending,
                })

        return overdue
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to retrieve overdue payments")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve overdue payments. Please try again.")
