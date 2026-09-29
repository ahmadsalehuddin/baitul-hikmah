"""
Seeds the two pre-configured Baitul Hikmah accounts (Ahmad/Admin, Ayah/Viewer).
Run from `backend/`: python scripts/seed_users.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, select
from app.core.database import engine, init_db
from app.models.schema import User, Role

SEED_USERS = [
    {"email": "admin@example.com", "display_name": "Ahmad", "role": Role.admin},
    {"email": "viewer@example.com", "display_name": "Ayah", "role": Role.viewer},
]

def seed_users():
    init_db()
    with Session(engine) as session:
        for entry in SEED_USERS:
            existing = session.exec(
                select(User).where(User.email == entry["email"])
            ).first()
            if existing:
                print(f"Skip (exists): {entry['email']}")
                continue

            user = User(
                email=entry["email"],
                display_name=entry["display_name"],
                role=entry["role"],
            )
            session.add(user)
            session.commit()
            print(f"Seeded: {entry['email']} ({entry['role'].value})")

if __name__ == "__main__":
    seed_users()
