import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables from .env file if present
load_dotenv()


# Database configuration
# Set these or create a .env file if you know your PostgreSQL password
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "solepower_db")

# 1. Primary choice: PostgreSQL
PG_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# 2. Fallback choice: Local SQLite (Zero configuration needed)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DB_PATH = os.path.join(BASE_DIR, "solepower.db")
SQLITE_URL = f"sqlite:///{SQLITE_DB_PATH.replace(os.sep, '/')}"

engine = None
db_type = None

# Attempt to connect to PostgreSQL first
try:
    test_engine = create_engine(PG_URL, pool_pre_ping=True)
    with test_engine.connect() as conn:
        pass
    engine = test_engine
    db_type = f"PostgreSQL ({DB_NAME})"
    print(f"Connected successfully to {db_type}")
except Exception as e:
    # If PostgreSQL password fails or service is not configured, fall back to SQLite
    print(f"[Notice] PostgreSQL connection failed: {e}")
    print(f"[Notice] Automatically falling back to local SQLite database (solepower.db) so you can develop immediately!")
    engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
    db_type = "SQLite (Local fallback: solepower.db)"

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    Dependency helper: Opens a database session for an incoming request,
    and automatically closes it when finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
