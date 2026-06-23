import logging
import datetime
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from app.database import get_db
from app.routers.dependencies import require_admin, get_current_user
from io import BytesIO
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")

def _build_filename(parent_name, child_name, month, year) -> str:
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    parts = []
    if parent_name:
        parts.append(_slug(parent_name))
    if child_name:
        parts.append(_slug(child_name))
    if month and year:
        parts.append(f"{MONTHS[month - 1][:3]}-{year}")
    elif year:
        parts.append(str(year))
    suffix = "_".join(parts) if parts else "all"
    return f"jmr-report_{ts}_{suffix}.pdf"


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

                # Aggregate per (month, year) — multiple service rows may exist per month
                if month is not None and year is not None:
                    cursor.execute(
                        """SELECT fp.month, fp.year, SUM(fp.amount) as amount, MIN(ps.paid_at) as paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s AND fp.month = %s AND fp.year = %s
                           GROUP BY fp.month, fp.year""",
                        (child["id"], month, year),
                    )
                elif year is not None:
                    cursor.execute(
                        """SELECT fp.month, fp.year, SUM(fp.amount) as amount, MIN(ps.paid_at) as paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s AND fp.year = %s
                           GROUP BY fp.month, fp.year""",
                        (child["id"], year),
                    )
                else:
                    cursor.execute(
                        """SELECT fp.month, fp.year, SUM(fp.amount) as amount, MIN(ps.paid_at) as paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s
                           GROUP BY fp.month, fp.year""",
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
                    """SELECT fp.month, fp.year, SUM(fp.amount) as amount,
                              MIN(fp.session_id) as session_id, MIN(ps.paid_at) as paid_at,
                              MIN(ps.receipt_key) as receipt_key
                       FROM fee_payments fp
                       JOIN payment_sessions ps ON fp.session_id = ps.id
                       WHERE fp.child_id = %s AND fp.month = %s AND fp.year = %s
                       GROUP BY fp.month, fp.year""",
                    (child["id"], month, year),
                )
            elif year is not None:
                cursor.execute(
                    """SELECT fp.month, fp.year, SUM(fp.amount) as amount,
                              MIN(fp.session_id) as session_id, MIN(ps.paid_at) as paid_at,
                              MIN(ps.receipt_key) as receipt_key
                       FROM fee_payments fp
                       JOIN payment_sessions ps ON fp.session_id = ps.id
                       WHERE fp.child_id = %s AND fp.year = %s
                       GROUP BY fp.month, fp.year""",
                    (child["id"], year),
                )
            else:
                cursor.execute(
                    """SELECT fp.month, fp.year, SUM(fp.amount) as amount,
                              MIN(fp.session_id) as session_id, MIN(ps.paid_at) as paid_at,
                              MIN(ps.receipt_key) as receipt_key
                       FROM fee_payments fp
                       JOIN payment_sessions ps ON fp.session_id = ps.id
                       WHERE fp.child_id = %s
                       GROUP BY fp.month, fp.year""",
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

@router.get("/export")
def export_report_pdf(
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
            raise HTTPException(status_code=400, detail="child id requires parent_id")
        
        if parent_id is not None:
            cursor.execute("SELECT id, parent_name, is_active FROM parents WHERE id = %s", (parent_id,))
            parents = cursor.fetchall()
            if not parents:
                raise HTTPException(status_code=404, detail="Parent not found")
        else:
            cursor.execute("SELECT id, parent_name, is_active FROM parents ORDER BY parent_name")
            parents = cursor.fetchall()
        
        today_first = datetime.date.today().replace(day=1)
        report_data = []

        for parent in parents:
            if child_id is not None:
                cursor.execute(
                    """
                    SELECT c.id, c.name, c.is_active, c.created_at,
                        COALESCE(SUM(st.monthly_fee), 0) AS monthly_fee,
                        COALESCE(STRING_AGG(st.name, ', ' ORDER BY st.name), '') AS service_names
                    FROM children c
                    LEFT JOIN child_services cs ON c.id = cs.child_id
                    LEFT JOIN service_types st ON cs.service_type_id = st.id
                    WHERE c.parent_id = %s AND c.id = %s
                    GROUP BY c.id, c.name, c.is_active, c.created_at ORDER BY c.name
                    """,
                    (parent["id"], child_id),
                )
            else:
                cursor.execute(
                    """
                    SELECT c.id, c.name, c.is_active, c.created_at,
                        COALESCE(SUM(st.monthly_fee), 0) AS monthly_fee,
                        COALESCE(STRING_AGG(st.name, ', ' ORDER BY st.name), '') AS service_names
                    FROM children c
                    LEFT JOIN child_services cs ON c.id = cs.child_id
                    LEFT JOIN service_types st ON cs.service_type_id = st.id
                    WHERE c.parent_id = %s
                    GROUP BY c.id, c.name, c.is_active, c.created_at ORDER BY c.name
                    """,
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
                    slots = [(m, year) for m in range(1, 13)
                        if datetime.date(year, m, 1) >= enrollment and datetime.date(year, m, 1) <= today_first]
                else:
                    slots = []
                    cur = enrollment
                    while cur <= today_first:
                        slots.append((cur.month, cur.year))
                        cur = cur.replace(month=cur.month + 1) if cur.month < 12 else cur.replace(year=cur.year + 1, month=1)
                
                if month is not None and year is not None:
                    cursor.execute(
                        """SELECT fp.month, fp.year, SUM(fp.amount) as amount, MIN(ps.paid_at) as paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s AND fp.month = %s AND fp.year = %s
                           GROUP BY fp.month, fp.year""",
                        (child["id"], month, year),
                    )
                elif year is not None:
                    cursor.execute(
                        """SELECT fp.month, fp.year, SUM(fp.amount) as amount, MIN(ps.paid_at) as paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s AND fp.year = %s
                           GROUP BY fp.month, fp.year""",
                        (child["id"], year),
                    )
                else:
                    cursor.execute(
                        """SELECT fp.month, fp.year, SUM(fp.amount) as amount, MIN(ps.paid_at) as paid_at
                           FROM fee_payments fp
                           JOIN payment_sessions ps ON fp.session_id = ps.id
                           WHERE fp.child_id = %s
                           GROUP BY fp.month, fp.year""",
                        (child["id"],),
                    )
                paid_map = {(r["month"], r["year"]): r for r in cursor.fetchall()}

                slot_set = set(slots)
                for key in paid_map:
                    if key not in slot_set:
                        slots.append(key)
                        slot_set.add(key)
                slots.sort(key=lambda t: (t[1], t[0]))

                months_data = [
                    {
                        "month": m, "year": y,
                        "amount": float(paid_map[(m,y)]["amount"]) if (m, y) in paid_map else float(child["monthly_fee"]),
                        "paid": (m, y) in paid_map,
                        "paid_at": paid_map[(m, y)]["paid_at"].isoformat() if (m, y) in paid_map else None,
                    }
                    for m, y in slots
                ]

                children_data.append({
                    "child_name": child["name"],
                    "is_active": child["is_active"],
                    "service_names": [s.strip() for s in child["service_names"].split(",") if s.strip()],
                    "registration": {
                        "paid": reg is not None,
                        "amount": float(reg["amount"]) if reg else None,
                        "paid_at": reg["paid_at"].isoformat() if reg and reg["paid_at"] else None,
                        "payment_method": reg["payment_method"] if reg else None,
                    },
                    "months": months_data,
                })
            
            report_data.append({
                "parent_name": parent["parent_name"],
                "is_active": parent["is_active"],
                "children": children_data,
            })
        
        # BUILD PDF
        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
        styles = getSampleStyleSheet()
        GREEN = colors.HexColor("#4F8C5C")
        RED = colors.HexColor("#B42828")
        GRAY = colors.HexColor("#888888")

        title_style = ParagraphStyle("title", fontSize=16, fontName="Helvetica-Bold", spaceAfter=6)
        meta_style = ParagraphStyle("meta", fontSize=8, fontName="Helvetica", textColor=GRAY, spaceBefore=2, spaceAfter=2)
        parent_style = ParagraphStyle("parent", fontSize=11, fontName="Helvetica-Bold", textColor=colors.white, spaceAfter=0)
        child_style = ParagraphStyle("child", fontSize=10, fontName="Helvetica-Bold", spaceAfter=2)
        svc_style = ParagraphStyle("svc", fontSize=8, fontName="Helvetica-Oblique", textColor=GRAY, spaceAfter=2)
        reg_style = ParagraphStyle("reg", fontSize=8, fontName="Helvetica", spaceAfter=4)

        elements =[]

        filter_parts = []
        parent_name_for_file = None
        child_name_for_file = None
        if parent_id and report_data:
            parent_name_for_file = report_data[0]["parent_name"]
            filter_parts.append(f"Parent: {parent_name_for_file}")
        if child_id and report_data and report_data[0]["children"]:
            child_name_for_file = report_data[0]["children"][0]["child_name"]
            filter_parts.append(f"Child: {child_name_for_file}")
        if month and year:
            filter_parts.append(f"Period: {MONTHS[month - 1]} {year}")
        elif year:
            filter_parts.append(f"Year: {year}")
        
        gen_date = datetime.datetime.now().strftime("%d %B %Y, %H:%M")
        elements.append(Paragraph("JMR Portal - Payment Report", title_style))
        elements.append(Paragraph(f"Generated: {gen_date}", meta_style))
        if filter_parts:
            elements.append(Paragraph("Filters:  " + " | ".join(filter_parts), meta_style))
        elements.append(Spacer(1, 4*mm))

        page_w = A4[0] - 30*mm

        for parent in report_data:
            label = parent["parent_name"] if parent["is_active"] else f"{parent['parent_name']} [INACTIVE]"
            header_table = Table(
                [[Paragraph(label, parent_style)]],
                colWidths=[page_w],
            )
            header_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), GREEN),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]))
            elements.append(header_table)
            elements.append(Spacer(1, 2*mm))

            if not parent["children"]:
                elements.append(Paragraph("No children found.", svc_style))
                elements.append(Spacer(1, 4*mm))
                continue
                
            for child in parent["children"]:
                child_label = child["child_name"] if child["is_active"] else f"{child['child_name']} [INACTIVE]"
                elements.append(Paragraph(child_label, child_style))

                if child["service_names"]:
                    elements.append(Paragraph(" · ".join(child["service_names"]), svc_style))
                
                reg = child["registration"]
                if reg["paid"]:
                    method = (reg["payment_method"] or "").replace("_", " ")
                    paid_at = reg["paid_at"][:10] if reg["paid_at"] else ""
                    reg_text = f'<font color="#1E7820">Registration Fee: PAID - RM {reg["amount"]:.2f} | {paid_at} | {method} </font>'
                else:
                    reg_text = f'<font color="#B42828">Registration Fee: UNPAID</font>'
                elements.append(Paragraph(reg_text, reg_style))

                if child["months"]:
                    table_data = [["Month", "Year", "Amount", "Status", "Date Paid"]]
                    for m in child["months"]:
                        paid_at_str = m["paid_at"][:10] if m["paid_at"] else "—"
                        table_data.append([
                            MONTHS[m["month"] - 1],
                            str(m["year"]),
                            f"RM {m['amount']:.2f}",
                            "PAID" if m["paid"] else "UNPAID",
                            paid_at_str,
                        ])
                    
                    col_w = [page_w * r for r in [0.24, 0.10, 0.18, 0.16, 0.32]]
                    tbl = Table(table_data, colWidths=col_w)
                    tbl_style = [
                        ("BACKGROUND",    (0, 0), (-1, 0), GREEN),
                        ("TEXTCOLOR",     (0, 0), (-1, 0), colors.white),
                        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE",      (0, 0), (-1, -1), 7.5),
                        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
                        ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#CCCCCC")),
                        ("TOPPADDING",    (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
                    ]
                    for i, row in enumerate(table_data[1:], start=1):
                        if row[3] == "UNPAID":
                            tbl_style.append(("TEXTCOLOR", (3, i), (3, i), RED))
                            tbl_style.append(("FONTNAME",  (3, i), (3, i), "Helvetica-Bold"))
                        elif row[3] == "PAID":
                            tbl_style.append(("TEXTCOLOR", (3, i), (3, i), GREEN))
                            tbl_style.append(("FONTNAME",  (3, i), (3, i), "Helvetica-Bold"))
                    
                    tbl.setStyle(TableStyle(tbl_style))
                    elements.append(tbl)
                else:
                    elements.append(Paragraph("No payment records for this period.", svc_style))
                
                elements.append(Spacer(1, 3*mm))
            elements.append(Spacer(1, 3*mm))
        doc.build(elements)
        buf.seek(0)

        filename = _build_filename(parent_name_for_file, child_name_for_file, month, year)
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to export report PDF")
        raise HTTPException(status_code=500, detail="Failed to export report. Please try again")