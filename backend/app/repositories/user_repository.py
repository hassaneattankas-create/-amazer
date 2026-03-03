from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower())
        return self.db.scalar(stmt)

    def get_by_id(self, user_id: str) -> User | None:
        stmt = select(User).where(User.id == user_id)
        return self.db.scalar(stmt)

    def create(self, email: str, full_name: str, hashed_password: str) -> User:
        user = User(email=email.lower(), full_name=full_name, hashed_password=hashed_password)
        self.db.add(user)
        self.db.flush()
        return user

