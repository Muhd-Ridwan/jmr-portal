import logging
import uuid
import datetime
import boto3
from botocore.config import Config as BotocoreConfig
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.routers.dependencies import require_admin, get_current_user
from app.config import R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/donations", tags=["donations"])

class DonationCreate(BaseModel):
    type: str
    amount: float
    description: Optional[str] = None
    receipt_key: Optional[str] = None
    transaction_date: datetime.date

class DonationUpdate(BaseModel):
    type: str
    amount: float
    description: Optional[str] = None
    receipt_key: Optional[str] = None
    transaction_date: datetime.date

class ReceiptUploadRequest(BaseModel):
    filename: str
    content_type: str

@router.get("")
def get_donations(
    type: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    conn=Depends(get_db),
    current_user=Depends(get_current_user)
):
    try:
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                COALESCE(SUM(amount) FILTER (WHERE type = 'credit'), 0) AS total_credit,
                COALESCE(SUM(amount) FILTER (WHERE type = 'debit'), 0) AS total_debit
            FROM donation_transactions
        """)
        summary = cursor.fetchone()

        filters = []
        params = []
        if type in ("credit", "debit"):
            filters.append("d.type = %s")
            params.append(type)
        if year:
            filters.append("EXTRACT(YEAR FROM d.transaction_date) = %s")
            params.append(year)
        if month:
            filters.append("EXTRACT(MONTH FROM d.transaction_date) = %s")
            params.append(month)

        where = ("WHERE " + " AND ".join(filters)) if filters else ""

        cursor.execute(f"""
            SELECT d.id, d.type, d.amount, d.description, d.receipt_key,
                   d.transaction_date, d.created_at, u.name AS created_by_name
            FROM donation_transactions d
            JOIN users u ON u.id = d.created_by
            {where}
            ORDER BY d.transaction_date DESC, d.created_at DESC
        """, params)
        transactions = cursor.fetchall()

        return {
            "transactions": [dict(t) for t in transactions],
            "total_credit": float(summary["total_credit"]),
            "total_debit": float(summary["total_debit"]),
            "balance": float(summary["total_credit"]) - float(summary["total_debit"]),
        }
    except Exception:
        logger.exception("Failed to fetch donations")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to fetch donations")
    
@router.post("/upload-url")
def get_receipt_upload_url(data: ReceiptUploadRequest, current_user=Depends(require_admin)):
    allowed_types = {"application/pdf", "image/png", "image/jpeg"}
    if data.content_type not in allowed_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF, PNG, JPG files are allowed")
    
    now = datetime.datetime.now(datetime.timezone.utc)
    safe_filename = "".join(c if c.isalnum() or c in "._-" else "_" for c in data.filename)
    key = f"donations/{now.year}/{now.month:02d}/{uuid.uuid4().hex}-{safe_filename}"

    try:
        s3 = boto3.client(
            "s3",
            endpoint_url = R2_ENDPOINT,
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
    
@router.post("", status_code=status.HTTP_201_CREATED)
def create_donation(data: DonationCreate, conn=Depends(get_db), current_user=Depends(require_admin)):
    if data.type not in ("credit", "debit"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Type must be credit or debit")
    if data.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than 0")

    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO donation_transactions (type, amount, description, receipt_key, transaction_date, created_by)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (data.type, data.amount, data.description, data.receipt_key, data.transaction_date, current_user["id"])
        )
        new_id = cursor.fetchone()["id"]
        conn.commit()
        return {"id": new_id, "message": "Transaction recorded"}
    except Exception:
        conn.rollback()
        logger.exception("Failed to create donation transaction")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to record transaction")


@router.put("/{donation_id}")
def update_donation(donation_id: int, data: DonationUpdate, conn=Depends(get_db), current_user=Depends(require_admin)):
    if data.type not in ("credit", "debit"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Type must be credit or debit")
    if data.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than 0")

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM donation_transactions WHERE id = %s", (donation_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

        cursor.execute(
            """UPDATE donation_transactions
               SET type = %s, amount = %s, description = %s, receipt_key = %s, transaction_date = %s
               WHERE id = %s""",
            (data.type, data.amount, data.description, data.receipt_key, data.transaction_date, donation_id)
        )
        conn.commit()
        return {"message": "Transaction updated"}
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to update donation transaction")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update transaction")


@router.delete("/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_donation(donation_id: int, conn=Depends(get_db), current_user=Depends(require_admin)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM donation_transactions WHERE id = %s", (donation_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
        
        cursor.execute("DELETE FROM donation_transactions WHERE id = %s", (donation_id,))
        conn.commit()
    except HTTPException:
        raise
    except Exception:
        conn.rollback()
        logger.exception("Failed to delete donation transaction")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete transaction")
    
@router.get("/{donation_id}/receipt")
def get_receipt_url(donation_id: int, download: bool = False, conn=Depends(get_db), current_user=Depends(get_current_user)):
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT receipt_key FROM donation_transactions WHERE id = %s", (donation_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
        if not row["receipt_key"]:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No receipt for this transaction")
        
        s3 = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=BotocoreConfig(signature_version="s3v4"),
            region_name="auto",
        )
        params: dict = {"Bucket": R2_BUCKET, "Key": row["receipt_key"]}
        if download:
            filename = row["receipt_key"].split("/")[-1]
            display_name = filename.split("-", 1)[1] if "-" in filename else filename
            params["ResponseContentDisposition"] = f'attachment; filename="{display_name}"'
        
        url = s3.generate_presigned_url("get_object", Params=params, ExpiresIn=900)
        return {"url": url}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to generate receipt URL")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate receipt URL")