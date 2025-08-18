"""
Unit tests for database models
"""

import pytest
from datetime import datetime
from app.models import ServerStatus, Device, APIStatus, OSType


class TestServerStatusModel:
    """Test class for ServerStatus model"""

    def test_server_status_creation(self):
        """Test creating a ServerStatus instance"""
        server = ServerStatus(
            server_name="test-server",
            cpu_load=45.5,
            memory_usage=67.8,
            api_status=APIStatus.ONLINE
        )
        
        assert server.server_name == "test-server"
        assert server.cpu_load == 45.5
        assert server.memory_usage == 67.8
        assert server.api_status == APIStatus.ONLINE
        assert server.server_id is not None  # Should have auto-generated ID

    def test_server_status_defaults(self):
        """Test ServerStatus default values"""
        server = ServerStatus(server_name="test-server")
        
        assert server.cpu_load == 0.0
        assert server.memory_usage == 0.0
        assert server.api_status == APIStatus.ONLINE

    def test_server_status_to_dict(self):
        """Test ServerStatus to_dict method"""
        server = ServerStatus(
            server_name="test-server",
            cpu_load=45.5,
            memory_usage=67.8,
            api_status=APIStatus.DEGRADED
        )
        server.server_id = "test-id-123"
        server.last_updated = datetime(2023, 12, 1, 10, 0, 0)
        
        result = server.to_dict()
        
        assert result["server_id"] == "test-id-123"
        assert result["server_name"] == "test-server"
        assert result["cpu_load"] == 45.5
        assert result["memory_usage"] == 67.8
        assert result["api_status"] == "degraded"
        assert result["last_updated"] == "2023-12-01T10:00:00"

    def test_server_status_to_dict_none_timestamp(self):
        """Test ServerStatus to_dict with None timestamp"""
        server = ServerStatus(server_name="test-server")
        server.last_updated = None
        
        result = server.to_dict()
        
        assert result["last_updated"] is None

    def test_api_status_enum_values(self):
        """Test APIStatus enum values"""
        assert APIStatus.ONLINE.value == "online"
        assert APIStatus.OFFLINE.value == "offline"
        assert APIStatus.DEGRADED.value == "degraded"

    def test_server_status_with_all_api_statuses(self):
        """Test ServerStatus with different API statuses"""
        statuses = [APIStatus.ONLINE, APIStatus.OFFLINE, APIStatus.DEGRADED]
        
        for status in statuses:
            server = ServerStatus(
                server_name=f"server-{status.value}",
                api_status=status
            )
            assert server.api_status == status


class TestDeviceModel:
    """Test class for Device model"""

    def test_device_creation(self):
        """Test creating a Device instance"""
        device = Device(
            fcm_token="test-fcm-token-123",
            os_type=OSType.ANDROID,
            os_version="13.0"
        )
        
        assert device.fcm_token == "test-fcm-token-123"
        assert device.os_type == OSType.ANDROID
        assert device.os_version == "13.0"
        assert device.device_id is not None  # Should have auto-generated ID

    def test_device_to_dict(self):
        """Test Device to_dict method"""
        device = Device(
            fcm_token="test-fcm-token-123",
            os_type=OSType.IOS,
            os_version="16.0"
        )
        device.device_id = "test-device-id-456"
        device.created_at = datetime(2023, 12, 1, 15, 30, 0)
        
        result = device.to_dict()
        
        assert result["device_id"] == "test-device-id-456"
        assert result["fcm_token"] == "test-fcm-token-123"
        assert result["os_type"] == "ios"
        assert result["os_version"] == "16.0"
        assert result["created_at"] == "2023-12-01T15:30:00"

    def test_device_to_dict_none_timestamp(self):
        """Test Device to_dict with None timestamp"""
        device = Device(
            fcm_token="test-token",
            os_type=OSType.ANDROID,
            os_version="13.0"
        )
        device.created_at = None
        
        result = device.to_dict()
        
        assert result["created_at"] is None

    def test_os_type_enum_values(self):
        """Test OSType enum values"""
        assert OSType.IOS.value == "ios"
        assert OSType.ANDROID.value == "android"

    def test_device_with_all_os_types(self):
        """Test Device with different OS types"""
        os_types = [OSType.IOS, OSType.ANDROID]
        
        for os_type in os_types:
            device = Device(
                fcm_token=f"token-{os_type.value}",
                os_type=os_type,
                os_version="1.0"
            )
            assert device.os_type == os_type


class TestModelRelationships:
    """Test class for model relationships and constraints"""

    def test_server_unique_name_constraint(self, db_session):
        """Test that server names must be unique"""
        # Create first server
        server1 = ServerStatus(server_name="unique-server")
        db_session.add(server1)
        db_session.commit()
        
        # Try to create another server with same name
        server2 = ServerStatus(server_name="unique-server")
        db_session.add(server2)
        
        # Should raise integrity error
        with pytest.raises(Exception):  # SQLAlchemy will raise an IntegrityError
            db_session.commit()

    def test_device_unique_fcm_token_constraint(self, db_session):
        """Test that FCM tokens must be unique"""
        # Create first device
        device1 = Device(
            fcm_token="unique-token-123",
            os_type=OSType.ANDROID,
            os_version="13.0"
        )
        db_session.add(device1)
        db_session.commit()
        
        # Try to create another device with same FCM token
        device2 = Device(
            fcm_token="unique-token-123",
            os_type=OSType.IOS,
            os_version="16.0"
        )
        db_session.add(device2)
        
        # Should raise integrity error
        with pytest.raises(Exception):  # SQLAlchemy will raise an IntegrityError
            db_session.commit()

    def test_server_id_auto_generation(self, db_session):
        """Test that server IDs are automatically generated"""
        server1 = ServerStatus(server_name="server1")
        server2 = ServerStatus(server_name="server2")
        
        db_session.add_all([server1, server2])
        db_session.commit()
        
        assert server1.server_id is not None
        assert server2.server_id is not None
        assert server1.server_id != server2.server_id

    def test_device_id_auto_generation(self, db_session):
        """Test that device IDs are automatically generated"""
        device1 = Device(
            fcm_token="token1",
            os_type=OSType.ANDROID,
            os_version="13.0"
        )
        device2 = Device(
            fcm_token="token2",
            os_type=OSType.IOS,
            os_version="16.0"
        )
        
        db_session.add_all([device1, device2])
        db_session.commit()
        
        assert device1.device_id is not None
        assert device2.device_id is not None
        assert device1.device_id != device2.device_id

    def test_timestamp_auto_generation(self, db_session):
        """Test that timestamps are automatically generated"""
        server = ServerStatus(server_name="timestamp-test")
        device = Device(
            fcm_token="timestamp-token",
            os_type=OSType.ANDROID,
            os_version="13.0"
        )
        
        db_session.add_all([server, device])
        db_session.commit()
        
        assert server.last_updated is not None
        assert device.created_at is not None
        
        # Timestamps should be recent (within last minute)
        now = datetime.utcnow()
        assert (now - server.last_updated.replace(tzinfo=None)).total_seconds() < 60
        assert (now - device.created_at.replace(tzinfo=None)).total_seconds() < 60

    def test_server_update_timestamp(self, db_session):
        """Test that server timestamp updates on modification"""
        server = ServerStatus(server_name="update-test")
        db_session.add(server)
        db_session.commit()
        
        original_timestamp = server.last_updated
        
        # Update server
        server.cpu_load = 75.0
        db_session.commit()
        
        # Timestamp should have been updated
        assert server.last_updated > original_timestamp