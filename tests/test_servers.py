"""
Unit tests for server management endpoints
"""

import pytest
from fastapi.testclient import TestClient
from app.models import APIStatus


class TestServerEndpoints:
    """Test class for server management endpoints"""

    def test_create_server_success(self, client: TestClient, auth_headers, sample_server_data):
        """Test successful server creation"""
        response = client.post("/api/servers", json=sample_server_data, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["server_name"] == sample_server_data["server_name"]
        assert data["cpu_load"] == sample_server_data["cpu_load"]
        assert data["memory_usage"] == sample_server_data["memory_usage"]
        assert data["api_status"] == sample_server_data["api_status"]
        assert "server_id" in data
        assert "last_updated" in data

    def test_create_server_duplicate_name(self, client: TestClient, auth_headers, sample_server_data):
        """Test creating server with duplicate name fails"""
        # Create first server
        client.post("/api/servers", json=sample_server_data, headers=auth_headers)
        
        # Try to create another server with the same name
        response = client.post("/api/servers", json=sample_server_data, headers=auth_headers)
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_create_server_invalid_data(self, client: TestClient, auth_headers):
        """Test creating server with invalid data"""
        invalid_data = {
            "server_name": "",  # Empty name
            "cpu_load": 150.0,  # Invalid CPU load > 100
            "memory_usage": -10.0,  # Negative memory usage
        }
        
        response = client.post("/api/servers", json=invalid_data, headers=auth_headers)
        assert response.status_code == 422

    def test_create_server_without_auth(self, client: TestClient, sample_server_data):
        """Test creating server without authentication fails"""
        response = client.post("/api/servers", json=sample_server_data)
        assert response.status_code == 401

    def test_get_all_servers_empty(self, client: TestClient, auth_headers):
        """Test getting all servers when none exist"""
        response = client.get("/api/servers", headers=auth_headers)
        
        assert response.status_code == 200
        assert response.json() == []

    def test_get_all_servers_with_data(self, client: TestClient, auth_headers, created_server):
        """Test getting all servers with existing data"""
        response = client.get("/api/servers", headers=auth_headers)
        
        assert response.status_code == 200
        servers = response.json()
        assert len(servers) == 1
        assert servers[0]["server_id"] == created_server.server_id

    def test_get_server_by_id_success(self, client: TestClient, auth_headers, created_server):
        """Test getting specific server by ID"""
        response = client.get(f"/api/servers/{created_server.server_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["server_id"] == created_server.server_id
        assert data["server_name"] == created_server.server_name

    def test_get_server_by_id_not_found(self, client: TestClient, auth_headers):
        """Test getting non-existent server"""
        response = client.get("/api/servers/non-existent-id", headers=auth_headers)
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_update_server_success(self, client: TestClient, auth_headers, created_server):
        """Test successful server update"""
        update_data = {
            "cpu_load": 75.0,
            "memory_usage": 80.5,
            "api_status": "degraded"
        }
        
        response = client.put(
            f"/api/servers/{created_server.server_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["cpu_load"] == update_data["cpu_load"]
        assert data["memory_usage"] == update_data["memory_usage"]
        assert data["api_status"] == update_data["api_status"]

    def test_update_server_partial(self, client: TestClient, auth_headers, created_server):
        """Test partial server update"""
        update_data = {"cpu_load": 90.0}
        
        response = client.put(
            f"/api/servers/{created_server.server_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["cpu_load"] == update_data["cpu_load"]
        # Other fields should remain unchanged
        assert data["server_name"] == created_server.server_name

    def test_update_server_not_found(self, client: TestClient, auth_headers):
        """Test updating non-existent server"""
        update_data = {"cpu_load": 50.0}
        
        response = client.put(
            "/api/servers/non-existent-id",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 404

    def test_update_server_invalid_data(self, client: TestClient, auth_headers, created_server):
        """Test updating server with invalid data"""
        invalid_data = {"cpu_load": 150.0}  # Invalid CPU load
        
        response = client.put(
            f"/api/servers/{created_server.server_id}",
            json=invalid_data,
            headers=auth_headers
        )
        
        assert response.status_code == 422

    def test_delete_server_success(self, client: TestClient, auth_headers, created_server):
        """Test successful server deletion"""
        response = client.delete(f"/api/servers/{created_server.server_id}", headers=auth_headers)
        
        assert response.status_code == 204
        
        # Verify server is deleted
        get_response = client.get(f"/api/servers/{created_server.server_id}", headers=auth_headers)
        assert get_response.status_code == 404

    def test_delete_server_not_found(self, client: TestClient, auth_headers):
        """Test deleting non-existent server"""
        response = client.delete("/api/servers/non-existent-id", headers=auth_headers)
        
        assert response.status_code == 404

    def test_server_status_enum_validation(self, client: TestClient, auth_headers, sample_server_data):
        """Test that only valid API status values are accepted"""
        invalid_data = sample_server_data.copy()
        invalid_data["api_status"] = "invalid_status"
        
        response = client.post("/api/servers", json=invalid_data, headers=auth_headers)
        assert response.status_code == 422

    def test_server_cpu_memory_boundaries(self, client: TestClient, auth_headers, sample_server_data):
        """Test CPU and memory usage boundary validation"""
        # Test valid boundaries
        valid_data = sample_server_data.copy()
        valid_data.update({"cpu_load": 0.0, "memory_usage": 100.0})
        
        response = client.post("/api/servers", json=valid_data, headers=auth_headers)
        assert response.status_code == 201
        
        # Test invalid boundaries
        invalid_data = sample_server_data.copy()
        invalid_data.update({"cpu_load": -1.0, "memory_usage": 101.0})
        invalid_data["server_name"] = "invalid-server"
        
        response = client.post("/api/servers", json=invalid_data, headers=auth_headers)
        assert response.status_code == 422