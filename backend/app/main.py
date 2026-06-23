import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, parents, children, users, payments, reports, donations
from app.config import ALLOWED_ORIGINS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="JMR PORTAL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router)
app.include_router(parents.router)
app.include_router(children.router)
app.include_router(users.router)
app.include_router(payments.router)
app.include_router(reports.router)
app.include_router(donations.router)

@app.get("/health")
def health():
    return {"status": "ok"}