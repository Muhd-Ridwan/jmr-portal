from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, parents, children, users, payments
from app.config import ALLOWED_ORIGINS

app = FastAPI(title="JMR PORTAL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(parents.router)
app.include_router(children.router)
app.include_router(users.router)
app.include_router(payments.router)

@app.get("/health")
def health():
    return {"status": "ok"}