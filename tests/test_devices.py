"""
Unit tests for device registration endpoints
"""

import pytest
from fastapi.testclient import TestClient


class TestDeviceEndpoints:
    """Test class for device registration endpoints"""

    def test_register_device_success(self, client: TestClient, auth_headers, sample_device_data):
        """Test successful device registration"""
        response = client.post("/api/devices", json=sample_device_data, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["fcm_token"] == sample_device_data["fcm_token"]
        assert data["os_type"] == sample_device_data["os_type"]
        assert data["os_version"] == sample_device_data["os_version"]
        assert "device_id" in data
        assert "created_at" in data

    def test_register_device_duplicate_token(self, client: TestClient, auth_headers, sample_device_data):
        """Test registering device with duplicate FCM token fails"""
        # Register first device
        client.post("/api/devices", json=sample_device_data, headers=auth_headers)
        
        # Try to register another device with the same FCM token
        response = client.post("/api/devices", json=sample_device_data, headers=auth_headers)
        
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_register_device_invalid_data(self, client: TestClient, auth_headers):
        """Test registering device with invalid data"""
        invalid_data = {
            "fcm_token": "",  # Empty token
            "os_type": "invalid_os",  # Invalid OS type
            "os_version": ""  # Empty version
        }
        
        response = client.post("/api/devices", json=invalid_data, headers=auth_headers)
        assert response.status_code == 422

    def test_register_device_without_auth(self, client: TestClient, sample_device_data):
        """Test registering device without authentication fails"""
        response = client.post("/api/devices", json=sample_device_data)
        assert response.status_code == 401

    def test_get_device_success(self, client: TestClient, auth_headers, created_device):
        """Test getting device information"""
        response = client.get(f"/api/devices/{created_device.device_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["device_id"] == created_device.device_id
        assert data["fcm_token"] == created_device.fcm_token
        assert data["os_type"] == created_device.os_type.value
        assert data["os_version"] == created_device.os_version

    def test_get_device_not_found(self, client: TestClient, auth_headers):
        """Test getting non-existent device"""
        response = client.get("/api/devices/non-existent-id", headers=auth_headers)
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_update_device_success(self, client: TestClient, auth_headers, created_device):
        """Test successful device update"""
        update_data = {
            "fcm_token": "updated-fcm-token-456",
            "os_version": "14.0"
        }
        
        response = client.put(
            f"/api/devices/{created_device.device_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["fcm_token"] == update_data["fcm_token"]
        assert data["os_version"] == update_data["os_version"]

    def test_update_device_partial(self, client: TestClient, auth_headers, created_device):
        """Test partial device update"""
        update_data = {"os_version": "15.0"}
        
        response = client.put(
            f"/api/devices/{created_device.device_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["os_version"] == update_data["os_version"]
        # Other fields should remain unchanged
        assert data["fcm_token"] == created_device.fcm_token

    def test_update_device_duplicate_token(self, client: TestClient, auth_headers, created_device, sample_device_data):
        """Test updating device with token that belongs to another device"""
        # Create another device
        another_device_data = sample_device_data.copy()
        another_device_data["fcm_token"] = "another-fcm-token"
        response = client.post("/api/devices", json=another_device_data, headers=auth_headers)
        another_device_id = response.json()["device_id"]
        
        # Try to update first device with the second device's token
        update_data = {"fcm_token": "another-fcm-token"}
        response = client.put(
            f"/api/devices/{created_device.device_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 400
        assert "already in use" in response.json()["detail"]

    def test_update_device_not_found(self, client: TestClient, auth_headers):
        """Test updating non-existent device"""
        update_data = {"os_version": "16.0"}
        
        response = client.put(
            "/api/devices/non-existent-id",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 404

    def test_update_device_invalid_data(self, client: TestClient, auth_headers, created_device):
        """Test updating device with invalid data"""
        invalid_data = {
            "fcm_token": "",  # Empty token
            "os_type": "invalid_os"  # Invalid OS type
        }
        
        response = client.put(
            f"/api/devices/{created_device.device_id}",
            json=invalid_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422

    def test_unregister_device_success(self, client: TestClient, auth_headers, created_device):
        """Test successful device unregistration"""
        response = client.delete(f"/api/devices/{created_device.device_id}", headers=auth_headers)
        
        assert response.status_code == 204
        
        # Verify device is deleted
        get_response = client.get(f"/api/devices/{created_device.device_id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_unregister_device_not_found(self, client: TestClient, auth_headers):
        """Test unregistering non-existent device"""
        response = client.delete("/api/devices/non-existent-id", headers=auth_headers)
        
        assert response.status_code == 404

    def test_device_os_type_validation(self, client: TestClient, auth_headers, sample_device_data):
        """Test that only valid OS types are accepted"""
        invalid_data = sample_device_data.copy()
        invalid_data["os_type"] = "windows"  # Only ios and android are valid
        
        response = client.post("/api/devices", json=invalid_data, headers=auth_headers)
        assert response.status_code == 422

    def test_device_required_fields(self, client: TestClient, auth_headers):
        """Test that all required fields are validated"""
        # Missing fcm_token
        incomplete_data = {
            "os_type": "android",
            "os_version": "13.0"
        }
        
        response = client.post("/api/devices", json=incomplete_data, headers=auth_headers)
        assert response.status_code == 422

    def test_device_fcm_token_length(self, client: TestClient, auth_headers, sample_device_data):
        """Test FCM token length validation"""
        # Empty FCM token
        invalid_data = sample_device_data.copy()
        invalid_data["fcm_token"] = ""
        
        response = client.post("/api/devices", json=invalid_data, headers=auth_headers)
        assert response.status_code == 422