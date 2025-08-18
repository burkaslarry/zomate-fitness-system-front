"""
Push notification API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Device
from app.schemas import NotificationResponse
from app.auth import verify_token
from app.services.firebase_service import firebase_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/push",
    tags=["notifications"],
    dependencies=[Depends(verify_token)]
)


@router.post("/test/{device_id}", response_model=NotificationResponse)
async def send_test_notification(
    device_id: str,
    db: Session = Depends(get_db)
):
    """
    Send a sample "Test Notification" to a specific device to confirm FCM is working
    """
    # Find the device
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    try:
        # Send test notification
        result = await firebase_service.send_test_notification(device)
        
        logger.info(f"Test notification sent to device {device_id}: {result}")
        
        return NotificationResponse(
            success=result["success"],
            message=result["message"],
            devices_notified=1 if result["success"] else 0
        )
        
    except Exception as e:
        logger.error(f"Failed to send test notification to device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send test notification: {str(e)}"
        )