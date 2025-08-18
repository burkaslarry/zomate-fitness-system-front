"""
Server status management API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import ServerStatus, Device, APIStatus
from app.schemas import (
    ServerStatusCreate, 
    ServerStatusUpdate, 
    ServerStatusResponse
)
from app.auth import verify_token
from app.services.firebase_service import firebase_service
from app.rabbitmq import rabbitmq_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/servers",
    tags=["servers"],
    dependencies=[Depends(verify_token)]
)


@router.post("/", response_model=ServerStatusResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    server_data: ServerStatusCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new server to monitor
    """
    # Check if server name already exists
    existing_server = db.query(ServerStatus).filter(
        ServerStatus.server_name == server_data.server_name
    ).first()
    
    if existing_server:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Server with this name already exists"
        )
    
    # Create new server
    db_server = ServerStatus(
        server_name=server_data.server_name,
        cpu_load=server_data.cpu_load,
        memory_usage=server_data.memory_usage,
        api_status=server_data.api_status
    )
    
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    
    logger.info(f"Created new server: {db_server.server_name} (ID: {db_server.server_id})")
    
    # Publish message to RabbitMQ for background processing
    try:
        rabbitmq_service.publish_message(
            "server_events_queue",
            {
                "event_type": "server_created",
                "server_id": str(db_server.server_id),
                "server_name": db_server.server_name,
                "timestamp": db_server.last_updated.isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Failed to publish server creation message: {e}")
    
    return ServerStatusResponse.model_validate(db_server)


@router.get("/", response_model=List[ServerStatusResponse])
async def get_all_servers(db: Session = Depends(get_db)):
    """
    Retrieve a list of all monitored servers and their current status
    """
    servers = db.query(ServerStatus).all()
    return [ServerStatusResponse.model_validate(server) for server in servers]


@router.get("/{server_id}", response_model=ServerStatusResponse)
async def get_server(server_id: str, db: Session = Depends(get_db)):
    """
    Retrieve the status of a single server
    """
    server = db.query(ServerStatus).filter(ServerStatus.server_id == server_id).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    return ServerStatusResponse.model_validate(server)


@router.put("/{server_id}", response_model=ServerStatusResponse)
async def update_server(
    server_id: str,
    server_data: ServerStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Manually update the status of a server
    This endpoint will be used by monitoring agents
    """
    server = db.query(ServerStatus).filter(ServerStatus.server_id == server_id).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    # Store the old status for comparison
    old_status = server.api_status
    
    # Update server fields
    update_data = server_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)
    
    db.commit()
    db.refresh(server)
    
    logger.info(f"Updated server: {server.server_name} (ID: {server_id})")
    
    # Publish message to RabbitMQ for background processing
    try:
        rabbitmq_service.publish_message(
            "server_events_queue",
            {
                "event_type": "server_updated",
                "server_id": str(server.server_id),
                "server_name": server.server_name,
                "old_status": old_status.value if old_status else None,
                "new_status": server.api_status.value,
                "timestamp": server.last_updated.isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Failed to publish server update message: {e}")
    
    # Check if status changed to offline or degraded and send notifications
    if (server.api_status in [APIStatus.OFFLINE, APIStatus.DEGRADED] and 
        server.api_status != old_status):
        
        # Get all registered devices for notifications
        devices = db.query(Device).all()
        
        if devices:
            try:
                notification_result = await firebase_service.send_server_alert(server, devices)
                logger.info(f"Notification result: {notification_result}")
            except Exception as e:
                logger.error(f"Failed to send notifications: {str(e)}")
    
    return ServerStatusResponse.model_validate(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(server_id: str, db: Session = Depends(get_db)):
    """
    Remove a server from monitoring
    """
    server = db.query(ServerStatus).filter(ServerStatus.server_id == server_id).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    server_name = server.server_name
    db.delete(server)
    db.commit()
    
    logger.info(f"Deleted server: {server_name} (ID: {server_id})")
    
    # Publish message to RabbitMQ for background processing
    try:
        from datetime import datetime
        rabbitmq_service.publish_message(
            "server_events_queue",
            {
                "event_type": "server_deleted",
                "server_id": server_id,
                "server_name": server_name,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        logger.error(f"Failed to publish server deletion message: {e}")
    
    return None