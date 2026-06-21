import logging
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from app.database import get_db
from app.routers.dependencies import require_admin, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/payment-summary")
def get_payment_summary(
    parent_id: Optional[int] = Query(None),
    child_id: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    conn=Depends(get_db),
    current_user=Depends(require_admin),
):
    try:
        cursor = conn.cursor()

        if child_id is not None and parent_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="child_id requires parent_id to be specified",
            )

        # Get parents — always include inactive for reports (full history)
        if parent_id is not None:
            cursor.execute(
                "SELECT id, parent_name, is_active FROM parents WHERE id = %s",
                (parent_id,),
            )
            parents = cursor.fetchall()
            if not parents:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")
        else:
            cursor.execute("SELECT id, parent_name, is_active FROM parents ORDER BY parent_name")
            parents = cursor.fetchall()

        today_first = datetime.date.today().replace(day=1)
        result = []

        for parent in parents:
            # Get children — always include inactive to preserve payment history
            if child_id is not None:
                cursor.execute(
                    """SELECT c.id, c.name, c.is_active, c.created_at,
                              COALESCE(SUM(st.monthly_fee), 0) AS monthly_fee,
                              COALESCE(STRING_AGG(st.name, ', ' ORDER BY st.name), '') AS service_names
                       FROM children c
                       LEFT JOIN child_services cs ON c.id = cs.child_id
                       LEFT JOIN service_types st ON cs.service_type_id = st.id
                       WHERE c.parent_id = %s AND c.id = %s
                       GROUP BY c.id, c.name, c.is_active, c.created_at
                       ORDER BY c.name""",
                    (parent["id"], child_id),
                )
            else:
                cursor.execute(
                    """SELECT c.id, c.name, c.is_active, c.created_at,
                              COALESCE(SUM(st.monthly_fee), 0) AS monthly_fee,
                              COALESCE(STRING_AGG(st.name, ', ' ORDER BY st.name), '') AS service_names
                       FROM children c
                       LEFT JOIN child_services cs ON c.id = cs.child_id
                       LEFT JOIN service_types st ON cs.service_type_id = st.id
                       WHERE c.parent_id = %s
                       GROUP BY c.id, c.name, c.is_active, c.created_at
                       ORDER BY c.name""",
                    (parent["id"],),
                )
            children = cursor.fetchall()

            children_data = []
            for child in children:
                # Registration payment
                cursor.execute(
                    "SELECT amount, payment_method, paid_at FROM registration_payments WHERE child_id = %s",
                    (child["id"],),
                )
                reg = cursor.fetchone()

                # Determine which month slots to show
                enrollment = child["created_at"].date().replace(day=1)

                if month is not None and year is not None:
                    slots = [(month, year)]
                elif year is not None:
                    slots = []
                    for m in range(1, 13):
                        slot_date = datetime.date(year, m, 1)
                        if slot_date < enrollment or slot_date > today_first:
                            continue
                        slots.append((m, year))
                else:
                    slots = []
                    current = enrollment
                    while current <= today_first:
                        slots.append((current.month, current.year))
                        if current.month == 12:
                            current = current.replace(year=current.year + 1, month=1)
                        else:
                            current = current.replace(month=current.month + 1)

                # Fetch paid fee_payments joined with payment_sessions for paid_at
                if month is not None and year is not None:
                    cursor.execute(
                        """SELECT fp.month, fp.year, fp.amount, ps.paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s AND fp.month = %s AND fp.year = %s""",
                        (child["id"], month, year),
                    )
                elif year is not None:
                    cursor.execute(
                        """SELECT fp.month, fp.year, fp.amount, ps.paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s AND fp.year = %s""",
                        (child["id"], year),
                    )
                else:
                    cursor.execute(
                        """SELECT fp.month, fp.year, fp.amount, ps.paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s""",
                        (child["id"],),
                    )
                paid_map = {(row["month"], row["year"]): row for row in cursor.fetchall()}

                # Include any paid months not covered by the slot range
                # (e.g. retroactive payments recorded before the enrollment date)
                slot_set = set(slots)
                for key in paid_map:
                    if key not in slot_set:
                        slots.append(key)
                        slot_set.add(key)
                slots.sort(key=lambda t: (t[1], t[0]))

                months_data = []
                for (m, y) in slots:
                    rec = paid_map.get((m, y))
                    months_data.append({
                        "month": m,
                        "year": y,
                        "amount": float(rec["amount"]) if rec else float(child["monthly_fee"]),
                        "paid": rec is not None,
                        "paid_at": rec["paid_at"].isoformat() if rec and rec["paid_at"] else None,
                    })

                children_data.append({
                    "child_id": child["id"],
                    "child_name": child["name"],
                    "is_active": child["is_active"],
                    "monthly_fee": float(child["monthly_fee"]),
                    "service_names": [s.strip() for s in child["service_names"].split(",") if s.strip()],
                    "registration": {
                        "paid": reg is not None,
                        "amount": float(reg["amount"]) if reg else None,
                        "paid_at": reg["paid_at"].isoformat() if reg and reg["paid_at"] else None,
                        "payment_method": reg["payment_method"] if reg else None,
                    },
                    "months": months_data,
                })

            result.append({
                "parent_id": parent["id"],
                "parent_name": parent["parent_name"],
                "is_active": parent["is_active"],
                "children": children_data,
            })

        return result

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to generate payment summary report")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate report. Please try again.",
        )


@router.get("/my-payment-summary")
def get_my_payment_summary(
    child_id: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000),
    conn=Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, parent_name, is_active FROM parents WHERE user_id = %s",
            (current_user["id"],),
        )
        parent = cursor.fetchone()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No parent record linked to this account",
            )

        today_first = datetime.date.today().replace(day=1)

        if child_id is not None:
            cursor.execute(
                """SELECT c.id, c.name, c.is_active, c.created_at,
                          COALESCE(SUM(st.monthly_fee), 0) AS monthly_fee,
                          COALESCE(STRING_AGG(st.name, ', ' ORDER BY st.name), '') AS service_names
                   FROM children c
                   LEFT JOIN child_services cs ON c.id = cs.child_id
                   LEFT JOIN service_types st ON cs.service_type_id = st.id
                   WHERE c.parent_id = %s AND c.id = %s
                   GROUP BY c.id, c.name, c.is_active, c.created_at
                   ORDER BY c.name""",
                (parent["id"], child_id),
            )
        else:
            cursor.execute(
                """SELECT c.id, c.name, c.is_active, c.created_at,
                          COALESCE(SUM(st.monthly_fee), 0) AS monthly_fee,
                          COALESCE(STRING_AGG(st.name, ', ' ORDER BY st.name), '') AS service_names
                   FROM children c
                   LEFT JOIN child_services cs ON c.id = cs.child_id
                   LEFT JOIN service_types st ON cs.service_type_id = st.id
                   WHERE c.parent_id = %s
                   GROUP BY c.id, c.name, c.is_active, c.created_at
                   ORDER BY c.name""",
                (parent["id"],),
            )
        children = cursor.fetchall()

        children_data = []
        for child in children:
            cursor.execute(
                "SELECT amount, payment_method, paid_at FROM registration_payments WHERE child_id = %s",
                (child["id"],),
            )
            reg = cursor.fetchone()

            enrollment = child["created_at"].date().replace(day=1)

            if month is not None and year is not None:
                slots = [(month, year)]
            elif year is not None:
                slots = []
                for m in range(1, 13):
                    slot_date = datetime.date(year, m, 1)
                    if slot_date < enrollment or slot_date > today_first:
                        continue
                    slots.append((m, year))
            else:
                slots = []
                current = enrollment
                while current <= today_first:
                    slots.append((current.month, current.year))
                    if current.month == 12:
                        current = current.replace(year=current.year + 1, month=1)
                    else:
                        current = current.replace(month=current.month + 1)

            if month is not None and year is not None:
                cursor.execute(
                    """SELECT fp.month, fp.year, fp.amount, fp.session_id, ps.paid_at, ps.receipt_key
                       FROM fee_payments fp
                       JOIN payment_sessions ps ON fp.session_id = ps.id
                       WHERE fp.child_id = %s AND fp.month = %s AND fp.year = %s""",
                    (child["id"], month, year),
                )
            elif year is not None:
                cursor.execute(
                    """SELECT fp.month, fp.year, fp.amount, fp.session_id, ps.paid_at, ps.receipt_key
                       FROM fee_payments fp
                       JOIN payment_sessions ps ON fp.session_id = ps.id
                       WHERE fp.child_id = %s AND fp.year = %s""",
                    (child["id"], year),
                )
            else:
                cursor.execute(
                    """SELECT fp.month, fp.year, fp.amount, fp.session_id, ps.paid_at, ps.receipt_key
                       FROM fee_payments fp
                       JOIN payment_sessions ps ON fp.session_id = ps.id
                       WHERE fp.child_id = %s""",
                    (child["id"],),
                )
            paid_map = {(row["month"], row["year"]): row for row in cursor.fetchall()}

            slot_set = set(slots)
            for key in paid_map:
                if key not in slot_set:
                    slots.append(key)
                    slot_set.add(key)
            slots.sort(key=lambda t: (t[1], t[0]))

            months_data = []
            for (m, y) in slots:
                rec = paid_map.get((m, y))
                months_data.append({
                    "month": m,
                    "year": y,
                    "amount": float(rec["amount"]) if rec else float(child["monthly_fee"]),
                    "paid": rec is not None,
                    "paid_at": rec["paid_at"].isoformat() if rec and rec["paid_at"] else None,
                    "session_id": rec["session_id"] if rec else None,
                    "receipt_key": rec["receipt_key"] if rec else None,
                })

            children_data.append({
                "child_id": child["id"],
                "child_name": child["name"],
                "is_active": child["is_active"],
                "monthly_fee": float(child["monthly_fee"]),
                "service_names": [s.strip() for s in child["service_names"].split(",") if s.strip()],
                "registration": {
                    "paid": reg is not None,
                    "amount": float(reg["amount"]) if reg else None,
                    "paid_at": reg["paid_at"].isoformat() if reg and reg["paid_at"] else None,
                    "payment_method": reg["payment_method"] if reg else None,
                },
                "months": months_data,
            })

        return {
            "parent_id": parent["id"],
            "parent_name": parent["parent_name"],
            "is_active": parent["is_active"],
            "children": children_data,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to generate my payment summary")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate report. Please try again.",
        )
