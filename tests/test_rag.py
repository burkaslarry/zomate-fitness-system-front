"""
Tests for RAG functionality
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
from app.main import app
from app.rabbitmq import rabbitmq_service

client = TestClient(app)


class TestRAGEndpoints:
    """Test RAG-related endpoints"""
    
    @patch('app.rabbitmq.rabbitmq_service.publish_message')
    def test_submit_rag_query(self, mock_publish):
        """Test RAG query submission"""
        # Mock the publish_message method
        mock_publish.return_value = None
        
        # Test data
        query_data = {
            "query": "What is the status of server-1?"
        }
        
        # Make request
        response = client.post("/rag/query", json=query_data)
        
        # Assertions
        assert response.status_code == 202
        assert response.json()["message"] == "RAG query has been submitted for processing"
        
        # Verify RabbitMQ message was published
        mock_publish.assert_called_once_with(
            "rag_query_queue", 
            {"query": "What is the status of server-1?"}
        )
    
    def test_submit_rag_query_invalid_data(self):
        """Test RAG query submission with invalid data"""
        # Empty query
        response = client.post("/rag/query", json={"query": ""})
        assert response.status_code == 422
        
        # Missing query field
        response = client.post("/rag/query", json={})
        assert response.status_code == 422
    
    @patch('app.rabbitmq.rabbitmq_service.publish_message')
    def test_rag_query_rabbitmq_error(self, mock_publish):
        """Test RAG query when RabbitMQ fails"""
        # Mock RabbitMQ to raise an exception
        mock_publish.side_effect = Exception("RabbitMQ connection failed")
        
        query_data = {
            "query": "Test query"
        }
        
        response = client.post("/rag/query", json=query_data)
        
        # Should return 500 error when RabbitMQ fails
        assert response.status_code == 500
        assert "RabbitMQ connection failed" in response.json()["detail"]


@pytest.fixture
def mock_rabbitmq_service():
    """Mock RabbitMQ service for testing"""
    with patch('app.rabbitmq.rabbitmq_service') as mock:
        yield mock

