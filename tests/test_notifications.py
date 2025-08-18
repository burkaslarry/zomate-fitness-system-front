"""
Unit tests for notification service and endpoints
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.services.firebase_service import FirebaseService
from app.models import ServerStatus, Device, APIStatus, OSType


class TestNotificationEndpoints:
    """Test class for notification endpoints"""

    def test_send_test_notification_success(self, client: TestClient, auth_headers, created_device):
        """Test sending test notification to existing device"""
        with patch('app.services.firebase_service.firebase_service.send_test_notification') as mock_send:
            mock_send.return_value = {
                "success": True,
                "message": "Test notification sent successfully"
            }
            
            response = client.post(
                f"/api/push/test/{created_device.device_id}",
                headers=auth_headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["devices_notified"] == 1
            mock_send.assert_called_once()

    def test_send_test_notification_device_not_found(self, client: TestClient, auth_headers):
        """Test sending test notification to non-existent device"""
        response = client.post(
            "/api/push/test/non-existent-device-id",
            headers=auth_headers
        )
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_send_test_notification_firebase_error(self, client: TestClient, auth_headers, created_device):
        """Test handling Firebase service errors"""
        with patch('app.services.firebase_service.firebase_service.send_test_notification') as mock_send:
            mock_send.side_effect = Exception("Firebase connection failed")
            
            response = client.post(
                f"/api/push/test/{created_device.device_id}",
                headers=auth_headers
            )
            
            assert response.status_code == 500
            assert "Failed to send test notification" in response.json()["detail"]

    def test_send_test_notification_without_auth(self, client: TestClient, created_device):
        """Test sending test notification without authentication"""
        response = client.post(f"/api/push/test/{created_device.device_id}")
        assert response.status_code == 401


class TestFirebaseService:
    """Test class for Firebase service"""

    @pytest.fixture
    def firebase_service(self):
        """Create Firebase service instance for testing"""
        return FirebaseService()

    @pytest.fixture
    def sample_server_status(self):
        """Create sample server status for testing"""
        server = ServerStatus(
            server_id="test-server-id",
            server_name="test-server",
            cpu_load=75.0,
            memory_usage=80.0,
            api_status=APIStatus.OFFLINE
        )
        return server

    @pytest.fixture
    def sample_devices(self):
        """Create sample devices for testing"""
        devices = [
            Device(
                device_id="device-1",
                fcm_token="token-1",
                os_type=OSType.ANDROID,
                os_version="13.0"
            ),
            Device(
                device_id="device-2",
                fcm_token="token-2",
                os_type=OSType.IOS,
                os_version="16.0"
            )
        ]
        return devices

    @pytest.mark.asyncio
    async def test_send_server_alert_no_firebase_config(self, firebase_service, sample_server_status, sample_devices):
        """Test sending server alert without Firebase configuration (simulation mode)"""
        result = await firebase_service.send_server_alert(sample_server_status, sample_devices)
        
        assert result["success"] is True
        assert result["simulated"] is True
        assert result["devices_notified"] == len(sample_devices)
        assert "simulated" in result["message"]

    @pytest.mark.asyncio
    async def test_send_server_alert_no_devices(self, firebase_service, sample_server_status):
        """Test sending server alert with no registered devices"""
        result = await firebase_service.send_server_alert(sample_server_status, [])
        
        assert result["success"] is True
        assert result["devices_notified"] == 0
        assert "No devices to notify" in result["message"]

    @pytest.mark.asyncio
    async def test_send_test_notification_no_firebase_config(self, firebase_service, sample_devices):
        """Test sending test notification without Firebase configuration"""
        result = await firebase_service.send_test_notification(sample_devices[0])
        
        assert result["success"] is True
        assert result["simulated"] is True
        assert "simulated" in result["message"]

    @pytest.mark.asyncio
    @patch('firebase_admin.messaging.send_multicast')
    @patch('firebase_admin.initialize_app')
    async def test_send_server_alert_with_firebase(self, mock_init, mock_send, firebase_service, sample_server_status, sample_devices):
        """Test sending server alert with Firebase configured"""
        # Mock Firebase initialization
        firebase_service._app = "mocked_app"
        
        # Mock successful response
        mock_response = AsyncMock()
        mock_response.success_count = 2
        mock_response.failure_count = 0
        mock_send.return_value = mock_response
        
        result = await firebase_service.send_server_alert(sample_server_status, sample_devices)
        
        assert result["success"] is True
        assert result["devices_notified"] == 2
        assert result["failures"] == 0
        mock_send.assert_called_once()

    @pytest.mark.asyncio
    @patch('firebase_admin.messaging.send')
    @patch('firebase_admin.initialize_app')
    async def test_send_test_notification_with_firebase(self, mock_init, mock_send, firebase_service, sample_devices):
        """Test sending test notification with Firebase configured"""
        # Mock Firebase initialization
        firebase_service._app = "mocked_app"
        
        # Mock successful response
        mock_send.return_value = "message-id-123"
        
        result = await firebase_service.send_test_notification(sample_devices[0])
        
        assert result["success"] is True
        assert result["message_id"] == "message-id-123"
        mock_send.assert_called_once()

    @pytest.mark.asyncio
    @patch('firebase_admin.messaging.send_multicast')
    async def test_send_server_alert_firebase_exception(self, mock_send, firebase_service, sample_server_status, sample_devices):
        """Test handling Firebase exceptions during server alert"""
        # Mock Firebase initialization
        firebase_service._app = "mocked_app"
        
        # Mock Firebase exception
        mock_send.side_effect = Exception("Firebase error")
        
        result = await firebase_service.send_server_alert(sample_server_status, sample_devices)
        
        assert result["success"] is False
        assert result["devices_notified"] == 0
        assert "Firebase error" in result["message"]

    @pytest.mark.asyncio
    @patch('firebase_admin.messaging.send')
    async def test_send_test_notification_firebase_exception(self, mock_send, firebase_service, sample_devices):
        """Test handling Firebase exceptions during test notification"""
        # Mock Firebase initialization
        firebase_service._app = "mocked_app"
        
        # Mock Firebase exception
        mock_send.side_effect = Exception("Token invalid")
        
        result = await firebase_service.send_test_notification(sample_devices[0])
        
        assert result["success"] is False
        assert "Token invalid" in result["message"]


class TestNotificationTriggers:
    """Test notification triggers from server updates"""

    @pytest.mark.asyncio
    async def test_server_update_triggers_notification_offline(self, client: TestClient, auth_headers, created_server, created_device):
        """Test that updating server to offline triggers notifications"""
        with patch('app.services.firebase_service.firebase_service.send_server_alert') as mock_send:
            mock_send.return_value = {
                "success": True,
                "message": "Notifications sent",
                "devices_notified": 1
            }
            
            # Update server to offline status
            update_data = {"api_status": "offline"}
            response = client.put(
                f"/api/servers/{created_server.server_id}",
                json=update_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            # Notification should be triggered
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_server_update_triggers_notification_degraded(self, client: TestClient, auth_headers, created_server, created_device):
        """Test that updating server to degraded triggers notifications"""
        with patch('app.services.firebase_service.firebase_service.send_server_alert') as mock_send:
            mock_send.return_value = {
                "success": True,
                "message": "Notifications sent",
                "devices_notified": 1
            }
            
            # Update server to degraded status
            update_data = {"api_status": "degraded"}
            response = client.put(
                f"/api/servers/{created_server.server_id}",
                json=update_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            # Notification should be triggered
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_server_update_no_notification_online(self, client: TestClient, auth_headers, created_server, created_device):
        """Test that updating server to online does not trigger notifications"""
        with patch('app.services.firebase_service.firebase_service.send_server_alert') as mock_send:
            # Update server to online status (should not trigger notification)
            update_data = {"api_status": "online", "cpu_load": 50.0}
            response = client.put(
                f"/api/servers/{created_server.server_id}",
                json=update_data,
                headers=auth_headers
            )
            
            assert response.status_code == 200
            # Notification should not be triggered
            mock_send.assert_not_called()