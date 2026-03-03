from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FinanceSettings(Base):
    __tablename__ = "finance_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    commission_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    service_fee: Mapped[float] = mapped_column(Float, nullable=False, default=200)
    default_delivery_fee: Mapped[float] = mapped_column(Float, nullable=False, default=1500)
    seller_subscription_fee: Mapped[float] = mapped_column(Float, nullable=False, default=5000)
    ad_boost_price: Mapped[float] = mapped_column(Float, nullable=False, default=2000)
    ad_boost_duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class FinanceTransfer(Base):
    __tablename__ = "finance_transfers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    bank_name: Mapped[str] = mapped_column(String(40), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="XOF")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="simulated")
    encrypted_snapshot: Mapped[str] = mapped_column(String(4096), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FinanceDistrictFee(Base):
    __tablename__ = "finance_district_fees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    district_name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    delivery_fee: Mapped[float] = mapped_column(Float, nullable=False, default=1500)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
