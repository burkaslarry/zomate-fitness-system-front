"""
Health check and connectivity API endpoints
"""

from fastapi import APIRouter
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    API Health Check endpoint
    Returns a 200 OK status with a simple JSON body
    """
    return HealthResponse(status="ok")