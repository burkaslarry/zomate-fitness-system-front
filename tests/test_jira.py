"""
Unit tests for JIRA integration service and endpoints
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.services.jira_service import JiraService
from app.models import ServerStatus, APIStatus
import httpx


class TestJiraEndpoints:
    """Test class for JIRA integration endpoints"""

    def test_create_jira_ticket_success(self, client: TestClient, auth_headers, created_server):
        """Test successful JIRA ticket creation"""
        with patch('app.services.jira_service.jira_service.create_server_ticket') as mock_create:
            mock_create.return_value = {
                "success": True,
                "message": "JIRA ticket created successfully",
                "ticket_key": "OPS-123",
                "ticket_url": "https://example.atlassian.net/browse/OPS-123"
            }
            
            ticket_data = {"server_id": created_server.server_id}
            response = client.post("/api/jira/create-ticket", json=ticket_data, headers=auth_headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["ticket_key"] == "OPS-123"
            assert data["server_id"] == created_server.server_id
            assert data["server_name"] == created_server.server_name
            mock_create.assert_called_once()

    def test_create_jira_ticket_server_not_found(self, client: TestClient, auth_headers):
        """Test creating JIRA ticket for non-existent server"""
        ticket_data = {"server_id": "non-existent-server-id"}
        response = client.post("/api/jira/create-ticket", json=ticket_data, headers=auth_headers)
        
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    def test_create_jira_ticket_service_failure(self, client: TestClient, auth_headers, created_server):
        """Test handling JIRA service failures"""
        with patch('app.services.jira_service.jira_service.create_server_ticket') as mock_create:
            mock_create.return_value = {
                "success": False,
                "message": "JIRA API authentication failed"
            }
            
            ticket_data = {"server_id": created_server.server_id}
            response = client.post("/api/jira/create-ticket", json=ticket_data, headers=auth_headers)
            
            assert response.status_code == 500
            assert "authentication failed" in response.json()["detail"]

    def test_create_jira_ticket_service_exception(self, client: TestClient, auth_headers, created_server):
        """Test handling JIRA service exceptions"""
        with patch('app.services.jira_service.jira_service.create_server_ticket') as mock_create:
            mock_create.side_effect = Exception("Network timeout")
            
            ticket_data = {"server_id": created_server.server_id}
            response = client.post("/api/jira/create-ticket", json=ticket_data, headers=auth_headers)
            
            assert response.status_code == 500
            assert "Network timeout" in response.json()["detail"]

    def test_create_jira_ticket_without_auth(self, client: TestClient, created_server):
        """Test creating JIRA ticket without authentication"""
        ticket_data = {"server_id": created_server.server_id}
        response = client.post("/api/jira/create-ticket", json=ticket_data)
        assert response.status_code == 401

    def test_create_jira_ticket_invalid_data(self, client: TestClient, auth_headers):
        """Test creating JIRA ticket with invalid data"""
        # Missing server_id
        response = client.post("/api/jira/create-ticket", json={}, headers=auth_headers)
        assert response.status_code == 422
        
        # Empty server_id
        ticket_data = {"server_id": ""}
        response = client.post("/api/jira/create-ticket", json=ticket_data, headers=auth_headers)
        assert response.status_code == 422


class TestJiraService:
    """Test class for JIRA service"""

    @pytest.fixture
    def jira_service_no_config(self):
        """Create JIRA service without configuration for testing simulation mode"""
        with patch.dict('os.environ', {
            'JIRA_BASE_URL': '',
            'JIRA_EMAIL': '',
            'JIRA_API_TOKEN': ''
        }):
            return JiraService()

    @pytest.fixture
    def jira_service_with_config(self):
        """Create JIRA service with configuration for testing"""
        with patch.dict('os.environ', {
            'JIRA_BASE_URL': 'https://test.atlassian.net',
            'JIRA_EMAIL': 'test@example.com',
            'JIRA_API_TOKEN': 'test-token',
            'JIRA_PROJECT_KEY': 'OPS'
        }):
            return JiraService()

    @pytest.fixture
    def sample_server_status(self):
        """Create sample server status for testing"""
        server = ServerStatus(
            server_id="test-server-id",
            server_name="test-production-server",
            cpu_load=85.0,
            memory_usage=90.0,
            api_status=APIStatus.OFFLINE
        )
        server.last_updated = "2023-12-01T10:00:00Z"
        return server

    @pytest.mark.asyncio
    async def test_create_server_ticket_no_config(self, jira_service_no_config, sample_server_status):
        """Test creating JIRA ticket without configuration (simulation mode)"""
        result = await jira_service_no_config.create_server_ticket(sample_server_status)
        
        assert result["success"] is True
        assert result["simulated"] is True
        assert "simulated" in result["message"]
        assert result["ticket_key"].startswith("OPS-SIMULATED-")

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_create_server_ticket_success(self, mock_post, jira_service_with_config, sample_server_status):
        """Test successful JIRA ticket creation with API"""
        # Mock successful JIRA API response
        mock_response = AsyncMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"key": "OPS-456"}
        mock_post.return_value = mock_response
        
        result = await jira_service_with_config.create_server_ticket(sample_server_status)
        
        assert result["success"] is True
        assert result["ticket_key"] == "OPS-456"
        assert result["ticket_url"] == "https://test.atlassian.net/browse/OPS-456"
        mock_post.assert_called_once()

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_create_server_ticket_api_error(self, mock_post, jira_service_with_config, sample_server_status):
        """Test handling JIRA API errors"""
        # Mock API error response
        mock_response = AsyncMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"errors": {"project": "Project does not exist"}}
        mock_response.text = "Bad Request"
        mock_post.return_value = mock_response
        
        result = await jira_service_with_config.create_server_ticket(sample_server_status)
        
        assert result["success"] is False
        assert "status 400" in result["message"]

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_create_server_ticket_timeout(self, mock_post, jira_service_with_config, sample_server_status):
        """Test handling JIRA API timeout"""
        # Mock timeout exception
        mock_post.side_effect = httpx.TimeoutException("Request timed out")
        
        result = await jira_service_with_config.create_server_ticket(sample_server_status)
        
        assert result["success"] is False
        assert "timed out" in result["message"]

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_create_server_ticket_network_error(self, mock_post, jira_service_with_config, sample_server_status):
        """Test handling network errors"""
        # Mock network exception
        mock_post.side_effect = httpx.ConnectError("Connection failed")
        
        result = await jira_service_with_config.create_server_ticket(sample_server_status)
        
        assert result["success"] is False
        assert "Connection failed" in result["message"]

    def test_create_ticket_description_formatting(self, jira_service_with_config, sample_server_status):
        """Test ticket description formatting"""
        description = jira_service_with_config._create_ticket_description(sample_server_status)
        
        assert "Server Status Alert" in description
        assert sample_server_status.server_id in description
        assert sample_server_status.server_name in description
        assert "OFFLINE" in description
        assert "85.0%" in description  # CPU load
        assert "90.0%" in description  # Memory usage
        assert "Network Monitoring System" in description

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_create_server_ticket_priority_mapping(self, mock_post, jira_service_with_config):
        """Test that different server statuses map to appropriate priorities"""
        # Mock successful response
        mock_response = AsyncMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"key": "OPS-789"}
        mock_post.return_value = mock_response
        
        # Test offline server (should be High priority)
        offline_server = ServerStatus(
            server_id="offline-server",
            server_name="offline-server",
            cpu_load=0.0,
            memory_usage=0.0,
            api_status=APIStatus.OFFLINE
        )
        
        await jira_service_with_config.create_server_ticket(offline_server)
        
        # Check that the API was called with High priority
        call_args = mock_post.call_args
        ticket_data = call_args[1]["json"]
        assert ticket_data["fields"]["priority"]["name"] == "High"
        
        # Test degraded server (should be Medium priority)
        degraded_server = ServerStatus(
            server_id="degraded-server",
            server_name="degraded-server",
            cpu_load=75.0,
            memory_usage=80.0,
            api_status=APIStatus.DEGRADED
        )
        
        await jira_service_with_config.create_server_ticket(degraded_server)
        
        # Check that the API was called with Medium priority
        call_args = mock_post.call_args
        ticket_data = call_args[1]["json"]
        assert ticket_data["fields"]["priority"]["name"] == "Medium"

    @pytest.mark.asyncio
    @patch('httpx.AsyncClient.post')
    async def test_create_server_ticket_request_format(self, mock_post, jira_service_with_config, sample_server_status):
        """Test that the JIRA API request is properly formatted"""
        # Mock successful response
        mock_response = AsyncMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"key": "OPS-999"}
        mock_post.return_value = mock_response
        
        await jira_service_with_config.create_server_ticket(sample_server_status)
        
        # Verify request format
        call_args = mock_post.call_args
        assert call_args[0][0] == "https://test.atlassian.net/rest/api/3/issue"
        
        headers = call_args[1]["headers"]
        assert "Authorization" in headers
        assert headers["Content-Type"] == "application/json"
        assert headers["Accept"] == "application/json"
        
        ticket_data = call_args[1]["json"]
        fields = ticket_data["fields"]
        assert fields["project"]["key"] == "OPS"
        assert fields["summary"] == f"Server Offline: {sample_server_status.server_name}"
        assert fields["issuetype"]["name"] == "Bug"
        assert "description" in fields