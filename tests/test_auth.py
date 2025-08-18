"""
Unit tests for authentication functionality
"""

import pytest
from datetime import datetime, timedelta
from jose import jwt
from fastapi.testclient import TestClient
from app.auth import (
    create_access_token,
    verify_password,
    get_password_hash,
    create_demo_token,
    SECRET_KEY,
    ALGORITHM
)


class TestAuthenticationUtils:
    """Test class for authentication utility functions"""

    def test_password_hashing(self):
        """Test password hashing and verification"""
        password = "test_password_123"
        hashed = get_password_hash(password)
        
        # Hash should be different from original password
        assert hashed != password
        # Should be able to verify the password
        assert verify_password(password, hashed) is True
        # Wrong password should fail verification
        assert verify_password("wrong_password", hashed) is False

    def test_create_access_token_default_expiry(self):
        """Test creating access token with default expiry"""
        data = {"sub": "testuser"}
        token = create_access_token(data)
        
        # Should be a valid JWT token
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Decode and verify token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"
        assert "exp" in payload

    def test_create_access_token_custom_expiry(self):
        """Test creating access token with custom expiry"""
        data = {"sub": "testuser"}
        expires_delta = timedelta(minutes=60)
        token = create_access_token(data, expires_delta)
        
        # Decode and verify token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"
        
        # Check expiry time is approximately correct (within 1 minute tolerance)
        exp_time = datetime.fromtimestamp(payload["exp"])
        expected_exp = datetime.utcnow() + expires_delta
        time_diff = abs((exp_time - expected_exp).total_seconds())
        assert time_diff < 60  # Within 1 minute

    def test_create_demo_token(self):
        """Test creating demo token"""
        token = create_demo_token()
        
        # Should be a valid JWT token
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Decode and verify token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "demo_user"

    def test_token_with_additional_claims(self):
        """Test creating token with additional claims"""
        data = {
            "sub": "testuser",
            "role": "admin",
            "permissions": ["read", "write"]
        }
        token = create_access_token(data)
        
        # Decode and verify all claims are present
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"
        assert payload["role"] == "admin"
        assert payload["permissions"] == ["read", "write"]


class TestAuthenticationEndpoints:
    """Test class for authentication in API endpoints"""

    def test_protected_endpoint_without_token(self, client: TestClient):
        """Test accessing protected endpoint without token"""
        response = client.get("/api/servers")
        assert response.status_code == 401
        assert "detail" in response.json()

    def test_protected_endpoint_with_invalid_token(self, client: TestClient):
        """Test accessing protected endpoint with invalid token"""
        headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/api/servers", headers=headers)
        assert response.status_code == 401

    def test_protected_endpoint_with_malformed_token(self, client: TestClient):
        """Test accessing protected endpoint with malformed token"""
        headers = {"Authorization": "InvalidFormat token"}
        response = client.get("/api/servers", headers=headers)
        assert response.status_code == 401

    def test_protected_endpoint_with_expired_token(self, client: TestClient):
        """Test accessing protected endpoint with expired token"""
        # Create token that expires immediately
        data = {"sub": "testuser"}
        expires_delta = timedelta(seconds=-1)  # Already expired
        token = create_access_token(data, expires_delta)
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/servers", headers=headers)
        assert response.status_code == 401

    def test_protected_endpoint_with_valid_token(self, client: TestClient, auth_headers):
        """Test accessing protected endpoint with valid token"""
        response = client.get("/api/servers", headers=auth_headers)
        assert response.status_code == 200

    def test_protected_endpoint_with_token_missing_subject(self, client: TestClient):
        """Test accessing protected endpoint with token missing 'sub' claim"""
        # Create token without 'sub' claim
        data = {"user": "testuser", "role": "admin"}  # Missing 'sub'
        token = create_access_token(data)
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/servers", headers=headers)
        assert response.status_code == 401

    def test_multiple_endpoints_with_same_token(self, client: TestClient, auth_headers):
        """Test using the same token for multiple protected endpoints"""
        endpoints = [
            "/api/servers",
            "/api/devices",
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint, headers=auth_headers)
            # All should accept the token (though some might return 404 for missing resources)
            assert response.status_code in [200, 404]

    def test_case_sensitive_bearer_token(self, client: TestClient):
        """Test that Bearer token authentication is case sensitive"""
        token = create_demo_token()
        
        # Test with lowercase 'bearer'
        headers = {"Authorization": f"bearer {token}"}
        response = client.get("/api/servers", headers=headers)
        assert response.status_code == 401
        
        # Test with correct case 'Bearer'
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/servers", headers=headers)
        assert response.status_code == 200

    def test_token_in_wrong_header(self, client: TestClient):
        """Test that token in wrong header is rejected"""
        token = create_demo_token()
        
        # Try putting token in wrong header
        headers = {"X-Auth-Token": token}
        response = client.get("/api/servers", headers=headers)
        assert response.status_code == 401

    def test_health_endpoint_no_auth_required(self, client: TestClient):
        """Test that health endpoint doesn't require authentication"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_root_endpoint_no_auth_required(self, client: TestClient):
        """Test that root endpoint doesn't require authentication"""
        response = client.get("/")
        assert response.status_code == 200
        assert "message" in response.json()


class TestJWTTokenSecurity:
    """Test class for JWT token security aspects"""

    def test_token_contains_no_sensitive_data(self):
        """Test that tokens don't contain sensitive information in plain text"""
        data = {"sub": "testuser", "role": "admin"}
        token = create_access_token(data)
        
        # Token should not contain plain text sensitive data
        assert "testuser" not in token
        assert "admin" not in token
        assert "password" not in token.lower()

    def test_different_tokens_for_same_user(self):
        """Test that different tokens are generated for the same user"""
        data = {"sub": "testuser"}
        token1 = create_access_token(data)
        token2 = create_access_token(data)
        
        # Tokens should be different (due to different timestamps)
        assert token1 != token2

    def test_token_signature_verification(self):
        """Test that token signature is properly verified"""
        data = {"sub": "testuser"}
        token = create_access_token(data)
        
        # Should decode successfully with correct key
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"
        
        # Should fail with wrong key
        with pytest.raises(Exception):
            jwt.decode(token, "wrong_secret_key", algorithms=[ALGORITHM])

    def test_token_algorithm_verification(self):
        """Test that token algorithm is properly verified"""
        data = {"sub": "testuser"}
        token = create_access_token(data)
        
        # Should decode successfully with correct algorithm
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"
        
        # Should fail with wrong algorithm
        with pytest.raises(Exception):
            jwt.decode(token, SECRET_KEY, algorithms=["HS512"])