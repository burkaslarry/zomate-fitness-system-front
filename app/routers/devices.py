"""
Device registration API endpoints for push notifications
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Device
from app.schemas import DeviceCreate, DeviceUpdate, DeviceResponse
from app.auth import verify_token
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/devices",
    tags=["devices"],
    dependencies=[Depends(verify_token)]
)


@router.post("/", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def register_device(
    device_data: DeviceCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new device for push notifications
    """
    # Check if FCM token already exists
    existing_device = db.query(Device).filter(
        Device.fcm_token == device_data.fcm_token
    ).first()
    
    if existing_device:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device with this FCM token already registered"
        )
    
    # Create new device
    db_device = Device(
        fcm_token=device_data.fcm_token,
        os_type=device_data.os_type,
        os_version=device_data.os_version
    )
    
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    
    logger.info(f"Registered new device: {db_device.device_id} ({db_device.os_type})")
    
    return DeviceResponse.model_validate(db_device)


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str,
    device_data: DeviceUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing device's details (e.g., a new FCM token)
    """
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    # Check if new FCM token conflicts with existing device
    if device_data.fcm_token and device_data.fcm_token != device.fcm_token:
        existing_device = db.query(Device).filter(
            Device.fcm_token == device_data.fcm_token,
            Device.device_id != device_id
        ).first()
        
        if existing_device:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="FCM token already in use by another device"
            )
    
    # Update device fields
    update_data = device_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(device, field, value)
    
    db.commit()
    db.refresh(device)
    
    logger.info(f"Updated device: {device_id}")
    
    return DeviceResponse.model_validate(device)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device(device_id: str, db: Session = Depends(get_db)):
    """
    Unregister a device to stop notifications
    """
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    db.delete(device)
    db.commit()
    
    logger.info(f"Unregistered device: {device_id}")
    
    return None


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(device_id: str, db: Session = Depends(get_db)):
    """
    Get device information
    """
    device = db.query(Device).filter(Device.device_id == device_id).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    return DeviceResponse.model_validate(device)