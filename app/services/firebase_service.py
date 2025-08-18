"""
Firebase Cloud Messaging service for push notifications
"""

import os
import json
import logging
from typing import List, Dict, Any
import firebase_admin
from firebase_admin import credentials, messaging
from app.models import ServerStatus, Device
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class FirebaseService:
    """Service for handling Firebase Cloud Messaging"""
    
    def __init__(self):
        self._app = None
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check if Firebase is already initialized
            if not firebase_admin._apps:
                credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
                
                if credentials_path and os.path.exists(credentials_path):
                    # Initialize with service account file
                    cred = credentials.Certificate(credentials_path)
                    self._app = firebase_admin.initialize_app(cred)
                else:
                    # For demo purposes, create a mock initialization
                    # In production, you must provide valid Firebase credentials
                    logger.warning("Firebase credentials not found. Push notifications will be simulated.")
                    self._app = None
            else:
                self._app = firebase_admin.get_app()
                
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {str(e)}")
            self._app = None
    
    async def send_server_alert(self, server_status: ServerStatus, devices: List[Device]) -> Dict[str, Any]:
        """
        Send server status alert to all registered devices
        
        Args:
            server_status: The server status that triggered the alert
            devices: List of devices to send notifications to
            
        Returns:
            Dictionary with success status and details
        """
        if not self._app:
            # Simulate notification for demo purposes
            return {
                "success": True,
                "message": "Notification simulated (Firebase not configured)",
                "devices_notified": len(devices),
                "simulated": True
            }
        
        if not devices:
            return {
                "success": True,
                "message": "No devices to notify",
                "devices_notified": 0
            }
        
        # Create notification payload
        notification_data = {
            "title": f"Server Alert: {server_status.server_name}",
            "body": f"Server status changed to {server_status.api_status.value}",
            "server_data": server_status.to_dict()
        }
        
        # Prepare FCM tokens
        tokens = [device.fcm_token for device in devices]
        
        try:
            # Create the message
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=notification_data["title"],
                    body=notification_data["body"]
                ),
                data={
                    "server_id": server_status.server_id,
                    "server_name": server_status.server_name,
                    "api_status": server_status.api_status.value,
                    "cpu_load": str(server_status.cpu_load),
                    "memory_usage": str(server_status.memory_usage),
                    "last_updated": server_status.last_updated.isoformat() if server_status.last_updated else ""
                },
                tokens=tokens
            )
            
            # Send the message
            response = messaging.send_multicast(message)
            
            logger.info(f"Successfully sent {response.success_count} notifications")
            if response.failure_count > 0:
                logger.warning(f"Failed to send {response.failure_count} notifications")
            
            return {
                "success": True,
                "message": f"Sent notifications to {response.success_count} devices",
                "devices_notified": response.success_count,
                "failures": response.failure_count
            }
            
        except Exception as e:
            logger.error(f"Failed to send FCM notifications: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to send notifications: {str(e)}",
                "devices_notified": 0
            }
    
    async def send_test_notification(self, device: Device) -> Dict[str, Any]:
        """
        Send a test notification to a specific device
        
        Args:
            device: The device to send the test notification to
            
        Returns:
            Dictionary with success status and details
        """
        if not self._app:
            # Simulate notification for demo purposes
            return {
                "success": True,
                "message": f"Test notification simulated for device {device.device_id}",
                "simulated": True
            }
        
        try:
            # Create test message
            message = messaging.Message(
                notification=messaging.Notification(
                    title="Test Notification",
                    body="This is a test notification from the monitoring system"
                ),
                data={
                    "type": "test",
                    "timestamp": str(int(os.times().elapsed * 1000))  # Current timestamp
                },
                token=device.fcm_token
            )
            
            # Send the message
            response = messaging.send(message)
            
            logger.info(f"Successfully sent test notification to device {device.device_id}")
            
            return {
                "success": True,
                "message": f"Test notification sent successfully",
                "message_id": response
            }
            
        except Exception as e:
            logger.error(f"Failed to send test notification: {str(e)}")
            return {
                "success": False,
                "message": f"Failed to send test notification: {str(e)}"
            }


# Global instance
firebase_service = FirebaseService()