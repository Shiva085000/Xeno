from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String, nullable=False)
    city = Column(String, nullable=False)
    segment_tag = Column(String, nullable=False)  # high_value, at_risk, new, regular
    total_spend = Column(Float, default=0.0)
    last_purchase_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    orders = relationship("Order", back_populates="customer")
    communications = relationship("Communication", back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    amount = Column(Float, nullable=False)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    ordered_at = Column(DateTime, nullable=False)

    customer = relationship("Customer", back_populates="orders")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    segment_rule = Column(Text, nullable=False)  # JSON string
    message_template = Column(Text, nullable=False)
    channel = Column(String, nullable=False)  # whatsapp, sms, email, rcs
    status = Column(String, default="draft")  # draft, sending, completed
    created_at = Column(DateTime, server_default=func.now())

    communications = relationship("Communication", back_populates="campaign")


class Communication(Base):
    __tablename__ = "communications"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    message = Column(Text, nullable=False)
    channel = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, sent, delivered, failed, opened, read, clicked
    sent_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    campaign = relationship("Campaign", back_populates="communications")
    customer = relationship("Customer", back_populates="communications")
