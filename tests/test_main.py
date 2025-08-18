"""
Basic tests for the main application
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_demo_token

client = TestClient(app)


def test_root_endpoint():
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data


def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_protected_endpoint_without_token():
    """Test that protected endpoints require authentication"""
    response = client.get("/api/servers")
    assert response.status_code == 401


def test_protected_endpoint_with_token():
    """Test that protected endpoints work with valid token"""
    token = create_demo_token()
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/servers", headers=headers)
    assert response.status_code == 200


def test_websocket_connection():
    """Test WebSocket connection"""
    with client.websocket_connect("/socket") as websocket:
        # Send ping
        websocket.send_text("ping")
        # Receive pong
        data = websocket.receive_text()
        assert data == "pong"


def test_api_docs():
    """Test that API documentation is accessible"""
    response = client.get("/docs")
    assert response.status_code == 200