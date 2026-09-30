from __future__ import annotations

import json
import logging
import os
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List, Optional, Tuple

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("nexusfleet.database")

Base = declarative_base()

class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    category = Column(String(50), nullable=False, index=True)  # TASK, FLEET, CONFIG, AI, SYSTEM
    action = Column(String(255), nullable=False)
    actor = Column(String(100), default="system", nullable=False)
    details = Column(Text, nullable=True)

class TaskRecordModel(Base):
    __tablename__ = "tasks"

    id = Column(String(50), primary_key=True)
    order_id = Column(String(50), nullable=False)
    sku = Column(String(100), nullable=False)
    pickup = Column(String(50), nullable=False)
    destination = Column(String(50), nullable=False)
    priority = Column(Float, default=0.8, nullable=False)
    status = Column(String(30), default="QUEUED", nullable=False, index=True)
    assigned_robot_id = Column(String(50), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    completed_at = Column(DateTime, nullable=True)

class KnowledgeChunkModel(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(String(100), primary_key=True)
    source_name = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column(Text, nullable=True)
    embedding_vector = Column(Text, nullable=True)  # JSON-encoded vector
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

class FleetSnapshotModel(Base):
    __tablename__ = "fleet_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sim_time = Column(Float, nullable=False)
    active_robots = Column(Integer, nullable=False)
    active_tasks = Column(Integer, nullable=False)
    snapshot_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

# Seed Knowledge SOPs
WAREHOUSE_SOPS = [
    (
        "SOP-001",
        "Warehouse Safety & Minimum Distance Protocol",
        "All Autonomous Mobile Robots (AMRs) must maintain a minimum safety distance of 1.2 meters at all times. If distance drops below 1.2m, a proximity violation is triggered.",
        {"category": "Safety", "priority": "High"},
    ),
    (
        "SOP-002",
        "Low Battery & Automatic Docking Procedure",
        "When an AMR battery drops below 30%, it enters WARNING mode and prioritizes returning to a designated charging dock (N-0-0, N-4-0, or N-0-6). Below 20%, it ceases task bidding.",
        {"category": "Battery", "priority": "High"},
    ),
    (
        "SOP-003",
        "Priority Lease Right-of-Way Arbitration",
        "Narrow aisles (e.g. C-14, C-17) operate under single-lane lease arbitration. Right-of-way score is calculated as priority + 0.2 * (100 - battery). The higher score wins the lease.",
        {"category": "Coordination", "priority": "Critical"},
    ),
    (
        "SOP-004",
        "Deadlock Cycle Detection & Yielding Protocol",
        "When robots wait on each other in a circular dependency, DFS cycle detection identifies the deadlock victim (lowest priority AMR), which steps aside or replans using A*.",
        {"category": "Recovery", "priority": "Critical"},
    ),
    (
        "SOP-005",
        "Emergency Aisle Blockage & Dynamic Rerouting",
        "If an aisle is blocked due to an obstacle or maintenance, affected AMRs dynamically recalculate their routes using A* with infinite edge weights on blocked lanes.",
        {"category": "Navigation", "priority": "Medium"},
    ),
    (
        "SOP-006",
        "High-Reach Cart Container Lifting & Transfer",
        "AMRs equipped with high-reach vertical mast lifts perform container tote lifting at rack nodes (RACK-A1 to RACK-D4) and transfer cargo to Packing Bay (N-4-6).",
        {"category": "Operations", "priority": "Medium"},
    ),
]

def text_to_embedding(text: str, dim: int = 64) -> List[float]:
    import hashlib
    text_clean = text.lower().strip()
    vec = [0.0] * dim
    for word in text_clean.split():
        h = hashlib.sha256(word.encode("utf-8")).digest()
        for i in range(dim):
            vec[i] += float(h[i % len(h)]) / 255.0 - 0.5
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1)) or 1.0
    norm2 = math.sqrt(sum(b * b for b in v2)) or 1.0
    return dot / (norm1 * norm2)

class DatabaseManager:
    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or os.getenv("DATABASE_URL", "sqlite:///./nexus_fleet.db")
        
        # Normalize postgres:// to postgresql:// for SQLAlchemy
        if self.db_url.startswith("postgres://"):
            self.db_url = self.db_url.replace("postgres://", "postgresql://", 1)

        connect_args = {}
        if self.db_url.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
            if "///" in self.db_url:
                db_path = self.db_url.split("///")[1]
                if "/" in db_path or "\\" in db_path:
                    Path(os.path.dirname(db_path)).mkdir(parents=True, exist_ok=True)

        try:
            self.engine = create_engine(self.db_url, connect_args=connect_args, pool_pre_ping=True)
            Base.metadata.create_all(bind=self.engine)
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            logger.info(f"Database connection initialized successfully: {self.db_url.split('@')[-1]}")
        except Exception as e:
            logger.warning(f"Failed to connect to primary DB ({e}). Falling back to local SQLite.")
            fallback_url = "sqlite:///./nexus_fleet_fallback.db"
            self.engine = create_engine(fallback_url, connect_args={"check_same_thread": False})
            Base.metadata.create_all(bind=self.engine)
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        self._seed_knowledge()

    def get_session(self):
        return self.SessionLocal()

    def _seed_knowledge(self):
        with self.get_session() as session:
            try:
                count = session.query(KnowledgeChunkModel).count()
                if count == 0:
                    for id_, title, content, meta in WAREHOUSE_SOPS:
                        vector = text_to_embedding(f"{title} {content}")
                        chunk = KnowledgeChunkModel(
                            id=id_,
                            source_name=title,
                            content=content,
                            metadata_json=json.dumps(meta),
                            embedding_vector=json.dumps(vector),
                        )
                        session.add(chunk)
                    session.commit()
                    logger.info("Database initialized and SOP knowledge base seeded successfully.")
            except Exception as e:
                session.rollback()
                logger.error(f"Error seeding knowledge base: {e}")

    def add_audit_log(self, category: str, action: str, actor: str = "system", details: Optional[str] = None):
        with self.get_session() as session:
            try:
                log = AuditLogModel(
                    category=category,
                    action=action,
                    actor=actor,
                    details=details
                )
                session.add(log)
                session.commit()
            except Exception as e:
                session.rollback()
                logger.error(f"Error adding audit log: {e}")

    def list_audit_logs(self, limit: int = 100, category: Optional[str] = None) -> List[dict]:
        with self.get_session() as session:
            try:
                query = session.query(AuditLogModel)
                if category:
                    query = query.filter(AuditLogModel.category == category)
                logs = query.order_by(AuditLogModel.id.desc()).limit(limit).all()
                return [
                    {
                        "id": l.id,
                        "timestamp": l.timestamp.isoformat(),
                        "category": l.category,
                        "action": l.action,
                        "actor": l.actor,
                        "details": l.details,
                    }
                    for l in logs
                ]
            except Exception as e:
                logger.error(f"Error listing audit logs: {e}")
                return []

    def get_knowledge_chunks(self) -> List[dict]:
        with self.get_session() as session:
            try:
                chunks = session.query(KnowledgeChunkModel).all()
                return [
                    {
                        "id": c.id,
                        "source_name": c.source_name,
                        "content": c.content,
                        "metadata": json.loads(c.metadata_json) if c.metadata_json else {},
                    }
                    for c in chunks
                ]
            except Exception as e:
                logger.error(f"Error fetching knowledge chunks: {e}")
                return []

    def search_knowledge(self, query_text: str, limit: int = 3) -> List[dict]:
        query_vec = text_to_embedding(query_text)
        with self.get_session() as session:
            try:
                chunks = session.query(KnowledgeChunkModel).all()
                scored: List[Tuple[float, KnowledgeChunkModel]] = []
                for c in chunks:
                    c_vec = json.loads(c.embedding_vector) if c.embedding_vector else []
                    sim = cosine_similarity(query_vec, c_vec)
                    scored.append((sim, c))
                scored.sort(key=lambda x: x[0], reverse=True)
                return [
                    {
                        "id": c.id,
                        "source_name": c.source_name,
                        "content": c.content,
                        "similarity": float(score),
                        "metadata": json.loads(c.metadata_json) if c.metadata_json else {},
                    }
                    for score, c in scored[:limit]
                ]
            except Exception as e:
                logger.error(f"Error searching knowledge: {e}")
                return []

db_manager = DatabaseManager()
