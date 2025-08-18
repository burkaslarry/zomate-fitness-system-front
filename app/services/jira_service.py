"""
JIRA integration service for creating tickets
"""

import os
import json
import logging
from typing import Dict, Any
import httpx
from app.models import ServerStatus
from dotenv import load_dotenv
import base64

load_dotenv()

logger = logging.getLogger(__name__)


class JiraService:
    """Service for handling JIRA integration"""
    
    def __init__(self):
        self.base_url = os.getenv("JIRA_BASE_URL")
        self.email = os.getenv("JIRA_EMAIL")
        self.api_token = os.getenv("JIRA_API_TOKEN")
        self.project_key = os.getenv("JIRA_PROJECT_KEY", "OPS")
        
        # Create basic auth header
        if self.email and self.api_token:
            auth_string = f"{self.email}:{self.api_token}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            self.auth_header = f"Basic {auth_b64}"
        else:
            self.auth_header = None
            logger.warning("JIRA credentials not configured. Ticket creation will be simulated.")
    
    async def create_server_ticket(self, server_status: ServerStatus) -> Dict[str, Any]:
        """
        Create a JIRA ticket for server issues
        
        Args:
            server_status: The server status that triggered the ticket creation
            
        Returns:
            Dictionary with success status and ticket details
        """
        if not all([self.base_url, self.email, self.api_token]):
            # Simulate ticket creation for demo purposes
            return {
                "success": True,
                "message": "JIRA ticket creation simulated (credentials not configured)",
                "ticket_key": f"OPS-SIMULATED-{server_status.server_id[:8]}",
                "simulated": True
            }
        
        # Prepare ticket data
        summary = f"Server Offline: {server_status.server_name}"
        description = self._create_ticket_description(server_status)
        
        ticket_data = {
            "fields": {
                "project": {
                    "key": self.project_key
                },
                "summary": summary,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {
                                    "type": "text",
                                    "text": description
                                }
                            ]
                        }
                    ]
                },
                "issuetype": {
                    "name": "Bug"  # You can change this to "Incident" or other issue types
                },
                "priority": {
                    "name": "High" if server_status.api_status.value == "offline" else "Medium"
                }
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": self.auth_header,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
                
                response = await client.post(
                    f"{self.base_url}/rest/api/3/issue",
                    headers=headers,
                    json=ticket_data,
                    timeout=30.0
                )
                
                if response.status_code == 201:
                    ticket_info = response.json()
                    ticket_key = ticket_info.get("key")
                    
                    logger.info(f"Successfully created JIRA ticket: {ticket_key}")
                    
                    return {
                        "success": True,
                        "message": f"JIRA ticket created successfully",
                        "ticket_key": ticket_key,
                        "ticket_url": f"{self.base_url}/browse/{ticket_key}"
                    }
                else:
                    error_message = f"JIRA API returned status {response.status_code}"
                    try:
                        error_details = response.json()
                        error_message += f": {error_details}"
                    except:
                        error_message += f": {response.text}"
                    
                    logger.error(f"Failed to create JIRA ticket: {error_message}")
                    
                    return {
                        "success": False,
                        "message": f"Failed to create JIRA ticket: {error_message}"
                    }
                    
        except httpx.TimeoutException:
            logger.error("JIRA API request timed out")
            return {
                "success": False,
                "message": "JIRA API request timed out"
            }
        except Exception as e:
            logger.error(f"Failed to create JIRA ticket: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to create JIRA ticket: {str(e)}"
            }
    
    def _create_ticket_description(self, server_status: ServerStatus) -> str:
        """
        Create a detailed description for the JIRA ticket
        
        Args:
            server_status: The server status information
            
        Returns:
            Formatted description string
        """
        description = f"""Server Status Alert

Server Details:
- Server ID: {server_status.server_id}
- Server Name: {server_status.server_name}
- Current Status: {server_status.api_status.value.upper()}
- CPU Load: {server_status.cpu_load}%
- Memory Usage: {server_status.memory_usage}%
- Last Updated: {server_status.last_updated.isoformat() if server_status.last_updated else 'Unknown'}

Please investigate the server status and take appropriate action to restore normal operations.

This ticket was automatically created by the Network Monitoring System."""
        
        return description


# Global instance
jira_service = JiraService()