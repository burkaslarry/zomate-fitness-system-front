"""
Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models import APIStatus, OSType


class ServerStatusCreate(BaseModel):
    """Schema for creating a new server status"""
    server_name: str = Field(..., min_length=1, max_length=255)
    cpu_load: float = Field(default=0.0, ge=0.0, le=100.0)
    memory_usage: float = Field(default=0.0, ge=0.0, le=100.0)
    api_status: APIStatus = Field(default=APIStatus.ONLINE)


class ServerStatusUpdate(BaseModel):
    """Schema for updating server status"""
    server_name: Optional[str] = Field(None, min_length=1, max_length=255)
    cpu_load: Optional[float] = Field(None, ge=0.0, le=100.0)
    memory_usage: Optional[float] = Field(None, ge=0.0, le=100.0)
    api_status: Optional[APIStatus] = None


class ServerStatusResponse(BaseModel):
    """Schema for server status response"""
    server_id: str
    server_name: str
    cpu_load: float
    memory_usage: float
    api_status: str
    last_updated: datetime

    class Config:
        from_attributes = True


class DeviceCreate(BaseModel):
    """Schema for registering a new device"""
    fcm_token: str = Field(..., min_length=1)
    os_type: OSType
    os_version: str = Field(..., min_length=1)


class DeviceUpdate(BaseModel):
    """Schema for updating device information"""
    fcm_token: Optional[str] = Field(None, min_length=1)
    os_type: Optional[OSType] = None
    os_version: Optional[str] = Field(None, min_length=1)


class DeviceResponse(BaseModel):
    """Schema for device response"""
    device_id: str
    fcm_token: str
    os_type: str
    os_version: str
    created_at: datetime

    class Config:
        from_attributes = True


class JiraTicketCreate(BaseModel):
    """Schema for creating JIRA ticket"""
    server_id: str = Field(..., min_length=1)


class HealthResponse(BaseModel):
    """Schema for health check response"""
    status: str = Field(default="ok")


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    success: bool
    message: str
    devices_notified: int = 0

class RAGQuery(BaseModel):
    """Schema for RAG query"""
    query: str = Field(..., min_length=1)