"""
Tests for RabbitMQ service
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import json
from app.rabbitmq import RabbitMQService


class TestRabbitMQService:
    """Test RabbitMQ service functionality"""
    
    @patch('app.rabbitmq.pika.BlockingConnection')
    def test_rabbitmq_connection(self, mock_connection):
        """Test RabbitMQ connection establishment"""
        # Mock the connection and channel
        mock_conn = Mock()
        mock_channel = Mock()
        mock_conn.channel.return_value = mock_channel
        mock_connection.return_value = mock_conn
        
        # Create service instance
        service = RabbitMQService()
        
        # Verify connection was established
        assert service.connection == mock_conn
        assert service.channel == mock_channel
    
    @patch('app.rabbitmq.pika.BlockingConnection')
    def test_publish_message(self, mock_connection):
        """Test message publishing"""
        # Mock the connection and channel
        mock_conn = Mock()
        mock_channel = Mock()
        mock_conn.channel.return_value = mock_channel
        mock_connection.return_value = mock_conn
        
        # Create service instance
        service = RabbitMQService()
        
        # Test message
        test_message = {"test": "data"}
        queue_name = "test_queue"
        
        # Publish message
        service.publish_message(queue_name, test_message)
        
        # Verify queue declaration
        mock_channel.queue_declare.assert_called_with(queue=queue_name, durable=True)
        
        # Verify message publishing
        mock_channel.basic_publish.assert_called_once()
        call_args = mock_channel.basic_publish.call_args
        assert call_args[1]['routing_key'] == queue_name
        assert json.loads(call_args[1]['body']) == test_message
    
    @patch('app.rabbitmq.pika.BlockingConnection')
    def test_connection_retry(self, mock_connection):
        """Test connection retry on failure"""
        # First call fails, second succeeds
        mock_conn = Mock()
        mock_channel = Mock()
        mock_conn.channel.return_value = mock_channel
        
        mock_connection.side_effect = [
            Exception("Connection failed"),
            mock_conn
        ]
        
        with patch('app.rabbitmq.time.sleep'):
            service = RabbitMQService()
        
        # Should eventually succeed
        assert service.connection == mock_conn
        assert mock_connection.call_count == 2
