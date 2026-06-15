from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime


# Customer schemas
class CustomerBase(BaseModel):
    name: str
    email: str
    phone: str
    city: str
    segment_tag: str
    total_spend: float = 0.0
    last_purchase_date: Optional[datetime] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerStats(BaseModel):
    total_customers: int
    by_segment: dict[str, int]
    avg_spend: float
    cities: List[str]


# Order schemas
class OrderBase(BaseModel):
    customer_id: int
    amount: float
    product_name: str
    category: str
    ordered_at: datetime


class OrderCreate(OrderBase):
    pass


class OrderOut(OrderBase):
    id: int

    class Config:
        from_attributes = True


# Campaign schemas
class SegmentRule(BaseModel):
    min_spend: Optional[float] = None
    max_days_since_purchase: Optional[int] = None
    city: Optional[str] = None
    segment_tag: Optional[str] = None
    min_orders: Optional[int] = None


class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    segment_rule: str  # JSON string
    message_template: str
    channel: str


class CampaignOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    segment_rule: str
    message_template: str
    channel: str
    status: str
    created_at: datetime
    total_communications: int = 0
    sent_count: int = 0
    delivered_count: int = 0
    failed_count: int = 0
    opened_count: int = 0
    read_count: int = 0
    clicked_count: int = 0

    class Config:
        from_attributes = True


class CampaignAnalytics(BaseModel):
    campaign: CampaignOut
    delivery_rate: float
    open_rate: float
    read_rate: float
    click_rate: float


# Communication schemas
class CommunicationOut(BaseModel):
    id: int
    campaign_id: int
    customer_id: int
    message: str
    channel: str
    status: str
    sent_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Receipt webhook schema
class ReceiptPayload(BaseModel):
    communication_id: int
    status: str
    timestamp: datetime


# Segment preview schemas
class SegmentPreviewRequest(BaseModel):
    segment_rule: SegmentRule


class SegmentPreviewResponse(BaseModel):
    count: int
    sample_customers: List[CustomerOut]


# Chat schemas
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    action: Optional[dict[str, Any]] = None


# Bulk import schemas
class BulkCustomerCreate(BaseModel):
    customers: List[CustomerCreate]


class BulkOrderCreate(BaseModel):
    orders: List[OrderCreate]
