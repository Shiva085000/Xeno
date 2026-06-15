import random
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, Customer, Order

fake = Faker("en_IN")
random.seed(42)

PRODUCTS = [
    "Kurta Set", "Denim Jacket", "Lehenga", "Sneakers",
    "Formal Shirt", "Maxi Dress", "Ethnic Wear", "Handbag",
    "Sunglasses", "Watch"
]
CATEGORIES = ["clothing", "accessories", "footwear"]
PRODUCT_CATEGORY = {
    "Kurta Set": "clothing", "Denim Jacket": "clothing", "Lehenga": "clothing",
    "Formal Shirt": "clothing", "Maxi Dress": "clothing", "Ethnic Wear": "clothing",
    "Handbag": "accessories", "Sunglasses": "accessories", "Watch": "accessories",
    "Sneakers": "footwear",
}
CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai",
          "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Surat"]


def generate_phone() -> str:
    return "+91" + str(random.randint(7000000000, 9999999999))


def generate_customers(n: int = 200) -> list[dict]:
    customers = []
    emails_seen = set()

    for i in range(n):
        name = fake.name()
        while True:
            email = fake.email()
            if email not in emails_seen:
                emails_seen.add(email)
                break

        # Assign segment tags by distribution
        roll = random.random()
        if roll < 0.30:
            segment_tag = "high_value"
        elif roll < 0.55:
            segment_tag = "at_risk"
        elif roll < 0.75:
            segment_tag = "new"
        else:
            segment_tag = "regular"

        now = datetime.utcnow()
        if segment_tag == "new":
            created_at = now - timedelta(days=random.randint(1, 29))
        elif segment_tag == "at_risk":
            created_at = now - timedelta(days=random.randint(180, 540))
        else:
            created_at = now - timedelta(days=random.randint(90, 730))

        customers.append({
            "name": name,
            "email": email,
            "phone": generate_phone(),
            "city": random.choice(CITIES),
            "segment_tag": segment_tag,
            "total_spend": 0.0,
            "last_purchase_date": None,
            "created_at": created_at,
        })
    return customers


def generate_orders(customer_ids: list[int], n: int = 500) -> list[dict]:
    orders = []
    now = datetime.utcnow()

    for _ in range(n):
        customer_id = random.choice(customer_ids)
        product = random.choice(PRODUCTS)
        category = PRODUCT_CATEGORY[product]
        ordered_at = now - timedelta(days=random.randint(0, 548))

        if category == "clothing":
            amount = round(random.uniform(800, 8000), 2)
        elif category == "accessories":
            amount = round(random.uniform(500, 15000), 2)
        else:
            amount = round(random.uniform(1200, 10000), 2)

        orders.append({
            "customer_id": customer_id,
            "amount": amount,
            "product_name": product,
            "category": category,
            "ordered_at": ordered_at,
        })
    return orders


def seed():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Clear existing data
        db.query(Order).delete()
        db.query(Customer).delete()
        db.commit()

        print("Seeding 200 customers...")
        customer_data = generate_customers(200)
        db_customers = []
        for c in customer_data:
            db_customer = Customer(**c)
            db.add(db_customer)
            db_customers.append(db_customer)
        db.commit()

        customer_ids = [c.id for c in db_customers]

        print("Seeding 500 orders...")
        order_data = generate_orders(customer_ids, 500)
        for o in order_data:
            db_order = Order(**o)
            db.add(db_order)
        db.commit()

        # Recompute total_spend and last_purchase_date for each customer
        print("Computing customer aggregates...")
        for customer in db_customers:
            orders = db.query(Order).filter(Order.customer_id == customer.id).all()
            if orders:
                customer.total_spend = round(sum(o.amount for o in orders), 2)
                customer.last_purchase_date = max(o.ordered_at for o in orders)

                # Re-classify based on actual data
                now = datetime.utcnow()
                days_since = (now - customer.last_purchase_date).days
                if customer.total_spend >= 15000:
                    customer.segment_tag = "high_value"
                elif days_since >= 90:
                    customer.segment_tag = "at_risk"
                elif (now - customer.created_at).days < 30:
                    customer.segment_tag = "new"
                else:
                    customer.segment_tag = "regular"

        db.commit()

        # Print summary
        total = db.query(Customer).count()
        high_value = db.query(Customer).filter(Customer.segment_tag == "high_value").count()
        at_risk = db.query(Customer).filter(Customer.segment_tag == "at_risk").count()
        new = db.query(Customer).filter(Customer.segment_tag == "new").count()
        regular = db.query(Customer).filter(Customer.segment_tag == "regular").count()
        total_orders = db.query(Order).count()

        print("\n=== Seed Summary (StyleHub) ===")
        print(f"Customers: {total}")
        print(f"  High Value: {high_value}")
        print(f"  At Risk:    {at_risk}")
        print(f"  New:        {new}")
        print(f"  Regular:    {regular}")
        print(f"Orders: {total_orders}")
        print("================================\n")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
