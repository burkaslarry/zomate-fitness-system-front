"""
JIRA integration API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ServerStatus
from app.schemas import JiraTicketCreate
from app.auth import verify_token
from app.services.jira_service import jira_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/jira",
    tags=["jira"],
    dependencies=[Depends(verify_token)]
)


@router.post("/create-ticket")
async def create_jira_ticket(
    ticket_data: JiraTicketCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new JIRA issue for a server problem
    """
    # Find the server
    server = db.query(ServerStatus).filter(
        ServerStatus.server_id == ticket_data.server_id
    ).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    try:
        # Create JIRA ticket
        result = await jira_service.create_server_ticket(server)
        
        logger.info(f"JIRA ticket creation result for server {ticket_data.server_id}: {result}")
        
        if result["success"]:
            return {
                "success": True,
                "message": result["message"],
                "ticket_key": result.get("ticket_key"),
                "ticket_url": result.get("ticket_url"),
                "server_id": ticket_data.server_id,
                "server_name": server.server_name
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["message"]
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Failed to create JIRA ticket for server {ticket_data.server_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create JIRA ticket: {str(e)}"
        )