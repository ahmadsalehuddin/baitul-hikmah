from sqlalchemy import inspect, text
from sqlmodel import SQLModel, create_engine, Session
from app.core.config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False}
)

# `create_all` never alters existing tables, so columns added after the first release are
# listed here and applied with a plain ADD COLUMN (additive, idempotent, keeps existing rows).
# Every entry needs a nullable column or a DEFAULT so SQLite accepts it on a populated table.
ADDITIVE_COLUMNS = [
    ("user", "text_size", "VARCHAR(12) NOT NULL DEFAULT 'biasa'"),
    ("video", "series_number", "INTEGER"),
    ("video", "is_custom_thumbnail", "BOOLEAN NOT NULL DEFAULT 0"),
    ("video", "original_thumbnail_path", "VARCHAR"),
    ("video", "location_id", 'INTEGER REFERENCES "location"(id)'),
]

def apply_additive_migrations():
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, column, ddl in ADDITIVE_COLUMNS:
            if not inspector.has_table(table):
                continue  # fresh DB: create_all already built it with the column
            existing = {c["name"] for c in inspector.get_columns(table)}
            if column not in existing:
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}'))

def init_db():
    SQLModel.metadata.create_all(engine)
    apply_additive_migrations()

def get_session():
    with Session(engine) as session:
        yield session
