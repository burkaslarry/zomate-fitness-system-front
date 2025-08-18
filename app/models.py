"""
SQLAlchemy models for the network monitoring backend
"""

from sqlalchemy import Column, String, Float, DateTime, Enum
from sqlalchemy.sql import func
from app.database import Base
import enum
import uuid


class APIStatus(str, enum.Enum):
    """Enumeration for API status values"""
    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"


class OSType(str, enum.Enum):
    """Enumeration for operating system types"""
    IOS = "ios"
    ANDROID = "android"


class ServerStatus(Base):
    """
    Model for server status monitoring
    """
    __tablename__ = "server_status"

    server_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    server_name = Column(String, nullable=False, unique=True)
    cpu_load = Column(Float, nullable=False, default=0.0)
    memory_usage = Column(Float, nullable=False, default=0.0)
    api_status = Column(Enum(APIStatus), nullable=False, default=APIStatus.ONLINE)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        """Convert model to dictionary for JSON serialization"""
        return {
            "server_id": self.server_id,
            "server_name": self.server_name,
            "cpu_load": self.cpu_load,
            "memory_usage": self.memory_usage,
            "api_status": self.api_status.value,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None
        }


class Device(Base):
    """
    Model for device registration for push notifications
    """
    __tablename__ = "devices"

    device_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    fcm_token = Column(String, nullable=False, unique=True)
    os_type = Column(Enum(OSType), nullable=False)
    os_version = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        """Convert model to dictionary for JSON serialization"""
        return {
            "device_id": self.device_id,
            "fcm_token": self.fcm_token,
            "os_type": self.os_type.value,
            "os_version": self.os_version,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }