# JMR Portal

An admin management system for a small tuition and Quran-reading service. Tracks parents, their children, monthly fee payments, and overdue balances. Includes a parent-facing portal for viewing enrolment status and payment history.

---

## Features

- **Parent & child management** — register parents with multiple phone numbers, add children with service type assignment
- **Payment tracking** — record payment sessions covering multiple children and months in one visit; track one-time registration fees separately
- **Overdue monitoring** — instant view of which children have unpaid months or outstanding registration fees
- **Reports** — filterable payment history by parent, child, month and year; export to PDF
- **Role-based access** — superadmin, admin, and parent (user) roles with separate dashboard views
- **Parent onboarding** — invite parents via email link; they set their own password on first login
- **Receipt storage** — upload PDF/image receipts directly to Cloudflare R2 via presigned URLs
- **Prayer times widget** — live Malaysian prayer times (waktusolat.app API) on the dashboard, auto-detects JAKIM zone from browser location with manual override
- **Bilingual UI** — English and Bahasa Melayu, switchable per user in profile settings

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite 8, Tailwind CSS v4 |
| Backend | FastAPI 0.138, Python, psycopg2 (raw SQL — no ORM) |
| Database | PostgreSQL |
| Auth | PyJWT — access token (480 min) + refresh token (7 days), bcrypt password hashing |
| Email | Resend — from `jmr@dev-r.org` |
| File Storage | Cloudflare R2 via presigned PUT/GET (boto3) |
| PDF Export | jsPDF + jspdf-autotable |
| i18n | i18next + react-i18next |
| Icons | Lucide React |
| Toasts | Sonner |
| Prayer Times | [Waktu Solat API](https://api.waktusolat.app) |

---

## File Structure

```
jmr-portal/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point, CORS, router registration
│   │   ├── config.py            # All env vars loaded here — import from here only
│   │   ├── database.py          # psycopg2 connection pool, get_db() dependency
│   │   ├── emails.py            # Resend client + HTML email templates
│   │   └── routers/
│   │       ├── auth.py          # login, refresh, setup, forgot/reset-password
│   │       ├── parents.py       # parent CRUD + send-onboarding
│   │       ├── children.py      # children CRUD + toggle active/inactive
│   │       ├── payments.py      # sessions, registration, overdue, receipt presigned URLs
│   │       ├── reports.py       # payment-summary + my-payment-summary
│   │       ├── users.py         # user management (admin/staff accounts)
│   │       └── dependencies.py  # get_current_user, require_admin, require_superadmin
│   ├── requirements.txt
│   ├── .env                     # never committed — see .env.example
│   └── .env.example
│
├── frontend/
│   ├── public/
│   │   └── logo.png             # JMR logo (used as favicon)
│   ├── src/
│   │   ├── api/                 # API client functions (one file per domain)
│   │   │   ├── client.ts        # axios instance + token refresh interceptor
│   │   │   ├── auth.ts
│   │   │   ├── parents.ts
│   │   │   ├── children.ts
│   │   │   ├── payments.ts
│   │   │   ├── reports.ts
│   │   │   └── users.ts
│   │   ├── components/          # Shared UI components
│   │   │   ├── Layout.tsx       # App shell with sticky navbar
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── PrayerTimes.tsx  # Prayer times widget (waktusolat.app API)
│   │   │   ├── Modal.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── FormField.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Table.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.tsx      # Auth context + token management
│   │   ├── i18n/
│   │   │   ├── index.ts         # i18next setup
│   │   │   └── locales/
│   │   │       ├── en.json      # English translations
│   │   │       └── ms.json      # Bahasa Melayu translations
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Setup.tsx        # One-time superadmin account creation
│   │   │   ├── ForgotPassword.tsx
│   │   │   ├── ResetPassword.tsx  # Shared by forgot-password + parent onboarding
│   │   │   ├── Dashboard.tsx    # Admin + parent dashboard views
│   │   │   ├── Parents.tsx
│   │   │   ├── ParentDetail.tsx # Full parent record: children, payment history, edit
│   │   │   ├── Payments.tsx     # Overdue monthly + unpaid registration fees
│   │   │   ├── Reports.tsx      # Admin payment reports + PDF export
│   │   │   ├── Services.tsx     # Service type management
│   │   │   ├── Users.tsx        # Admin/staff account management
│   │   │   ├── Profile.tsx      # Edit profile, change password, language preference
│   │   │   ├── MyChildren.tsx   # Parent view — their enrolled children
│   │   │   ├── MyPayments.tsx   # Parent view — outstanding fees
│   │   │   └── MyReports.tsx    # Parent view — payment history
│   │   ├── types/
│   │   │   └── index.ts         # Shared TypeScript types
│   │   ├── config.ts            # Frontend env vars (API base URL)
│   │   ├── App.tsx              # Route definitions
│   │   ├── main.tsx
│   │   └── index.css            # Tailwind + CSS custom properties (design tokens)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── db/
│   ├── init.sql                 # Idempotent schema — safe to re-run, no data loss
│   └── migration/               # Sequential SQL files applied during development
│       ├── 001_add_service_types.sql
│       ├── 002_add_is_active_to_children.sql
│       ├── 003_add_payment_method_and_registration.sql
│       ├── 004_add_superadmin_role.sql
│       ├── 005_add_user_id_to_parents.sql
│       ├── 006_nullable_password_email_users.sql
│       ├── 007_add_paid_at_to_registration_payments.sql
│       ├── 008_add_is_active_to_service_types.sql
│       ├── 009_child_services_junction.sql
│       ├── 010_add_is_active_to_parents.sql
│       ├── 011_add_password_reset_tokens.sql
│       ├── 012_add_service_description.sql
│       ├── 013_add_receipt_key.sql
│       └── 014_add_user_language.sql
│
├── CLAUDE.md                    # AI coding assistant instructions
├── LICENSE
└── README.md
```

---

## Database Schema

```sql
roles               id, name ('superadmin' | 'admin' | 'user')

users               id, name, email (unique), address, phone_num,
                    password (bcrypt, nullable = not yet activated),
                    role_id → roles, language ('en'|'ms'), created_at

parents             id, user_id → users (nullable), parent_name,
                    email (unique, nullable), address, is_active, created_at

phone_numbers       id, parent_id → parents, phone_num
                    -- at least 1 required per parent

children            id, parent_id → parents, name, dob (nullable),
                    service_type_id → service_types,
                    is_active (default TRUE), created_at
                    -- never deleted; toggle is_active to deactivate

service_types       id, name (unique), monthly_fee, registration_fee,
                    description (nullable), is_active, created_at

password_reset_tokens  id, user_id → users, token, expires_at, created_at
                       -- shared by forgot-password (15 min) and onboarding (30 min)
                       -- deleted after use

payment_sessions    id, parent_id → parents, total_amount,
                    payment_method ('cash'|'bank_transfer'|'online'),
                    notes, receipt_key (R2 object key, nullable),
                    paid_at, created_by → users, created_at

fee_payments        id, session_id → payment_sessions, child_id → children,
                    month, year, amount, created_at
                    UNIQUE (child_id, month, year)

registration_payments  id, child_id → children (UNIQUE), amount,
                       payment_method, paid_at, created_by → users, created_at
```

---

## User Roles

| Role | Created by | Can do |
|---|---|---|
| `superadmin` | `POST /auth/setup` (one-time) | Everything — including creating admin accounts and sending parent onboarding links |
| `admin` | superadmin | Create/manage parents, children, payments, staff accounts |
| `user` | Auto-created when a parent is registered | Parent portal — view their own children, payments, reports |

---

## Services (Pricing)

Services are managed via the **Manage Services** UI — no code changes needed to add new ones.

| Service | Monthly | Registration |
|---|---|---|
| Quran Reading only | RM 30 | RM 20 |
| Tuition + Quran Reading | RM 200 | RM 50 |

---

## Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+

### 1. Database

```bash
# Create database and user
psql -U postgres -c "CREATE USER jmr WITH PASSWORD 'yourpassword';"
psql -U postgres -c "CREATE DATABASE jmrportal OWNER jmr;"

# Run schema
psql -U jmr -d jmrportal -f db/init.sql
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env

# Start dev server
uvicorn app.main:app --reload
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

### 3. Frontend

```bash
cd frontend

npm install

cp .env.example .env

npm run dev
# App available at http://localhost:5173
```

### 4. First-time superadmin setup

With both servers running, visit `http://localhost:5173` and navigate to `/setup` to create the superadmin account. The endpoint is permanently disabled after the first use.

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://jmr:yourpassword@localhost:5432/jmrportal
SECRET_KEY=<64-char random hex>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ALLOWED_ORIGINS=http://localhost:5173
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=jmr@dev-r.org
FRONTEND_URL=http://localhost:5173
R2_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxxxx
R2_SECRET_ACCESS_KEY=xxxxx
R2_BUCKET_NAME=jmr-receipts
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

---

## API Overview

| Group | Base path | Description |
|---|---|---|
| Auth | `/auth` | Login, token refresh, setup, forgot/reset password |
| Parents | `/parents` | CRUD, send onboarding link |
| Children | `/children` | CRUD, toggle active/inactive |
| Payments | `/payments` | Sessions, registration fees, overdue, receipt presigned URLs |
| Reports | `/reports` | Payment summary (admin + parent views) |
| Users | `/users` | Admin/staff management, parent activation |

Full interactive docs available at `/docs` when the backend is running.

---

## Auth Flows

### Login
1. `POST /auth/login` → returns access token (480 min) + refresh token (7 days)
2. Frontend stores tokens; axios interceptor auto-refreshes on 401

### Forgot Password
1. `POST /auth/forgot-password` — generates a 15-minute token, sends reset link via email
2. `POST /auth/reset-password` — validates token, sets new password, deletes token

### Parent Onboarding
1. Admin registers parent → `users` record auto-created with `password = null`
2. Superadmin calls `POST /parents/{id}/send-onboarding` → 30-minute token sent via email
3. Parent clicks link → password setup form → `POST /auth/reset-password`
4. Parent can now log in and view their portal

---

## Infrastructure

| Item | Details |
|---|---|
| VPS | Hetzner CX23 — 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 24.04 LTS |
| Database | PostgreSQL on the same VPS |
| Backend | FastAPI via uvicorn, managed by systemd |
| Frontend | Built with `npm run build`, served by Nginx |
| Reverse proxy | Nginx — routes `/api` → FastAPI, serves React SPA for all other paths |
| SSL | Let's Encrypt via Certbot |
| Receipt storage | Cloudflare R2 — direct client upload via presigned PUT URL (5 min expiry); retrieval via presigned GET URL (15 min) |
| DB access (prod) | pgAdmin on local machine → SSH tunnel → VPS PostgreSQL |

---

## Production Deployment Checklist

- [ ] Create `jmr` PostgreSQL user and `jmrportal` database with production password
- [ ] Run `db/init.sql` to create schema
- [ ] Configure backend `.env` with production credentials
- [ ] Set up systemd service for uvicorn
- [ ] Build frontend: `npm run build`
- [ ] Configure Nginx to serve frontend and reverse-proxy API
- [ ] Obtain SSL certificate with Certbot
- [ ] Visit `/setup` to create superadmin account
- [ ] Add service types via **Manage Services** in the UI
- [ ] End-to-end test before going live

---

## License

MIT
