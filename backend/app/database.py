import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import DATABASE_URL

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()