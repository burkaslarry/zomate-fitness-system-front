"""
Unit tests for WebSocket functionality
"""

import pytest
import json
from fastapi.testclient import TestClient
from app.websocket import WebSocketManager


class TestWebSocketEndpoint:
    """Test class for WebSocket endpoint functionality"""

    def test_websocket_connection(self, client: TestClient):
        """Test basic WebSocket connection"""
        with client.websocket_connect("/socket") as websocket:
            # Connection should be established successfully
            assert websocket is not None

    def test_websocket_ping_pong_text(self, client: TestClient):
        """Test ping/pong with plain text messages"""
        with client.websocket_connect("/socket") as websocket:
            # Send ping
            websocket.send_text("ping")
            # Receive pong
            data = websocket.receive_text()
            assert data == "pong"

    def test_websocket_ping_pong_json(self, client: TestClient):
        """Test ping/pong with JSON messages"""
        with client.websocket_connect("/socket") as websocket:
            # Send JSON ping
            ping_message = {
                "type": "ping",
                "timestamp": "2023-12-01T10:00:00Z"
            }
            websocket.send_text(json.dumps(ping_message))
            
            # Receive JSON pong
            response_text = websocket.receive_text()
            response_data = json.loads(response_text)
            
            assert response_data["type"] == "pong"
            assert response_data["timestamp"] == "2023-12-01T10:00:00Z"
            assert response_data["message"] == "pong"

    def test_websocket_ping_case_insensitive(self, client: TestClient):
        """Test that ping is case insensitive"""
        with client.websocket_connect("/socket") as websocket:
            # Test different cases
            test_cases = ["ping", "PING", "Ping", "PiNg"]
            
            for ping_text in test_cases:
                websocket.send_text(ping_text)
                data = websocket.receive_text()
                assert data == "pong"

    def test_websocket_echo_other_messages(self, client: TestClient):
        """Test that non-ping messages are echoed back"""
        with client.websocket_connect("/socket") as websocket:
            # Send non-ping message
            test_message = "hello world"
            websocket.send_text(test_message)
            
            # Should receive echo
            data = websocket.receive_text()
            assert data == f"Echo: {test_message}"

    def test_websocket_echo_json_messages(self, client: TestClient):
        """Test that non-ping JSON messages are echoed back"""
        with client.websocket_connect("/socket") as websocket:
            # Send JSON message that's not ping
            test_message = {
                "type": "test",
                "content": "hello world",
                "timestamp": "2023-12-01T10:00:00Z"
            }
            websocket.send_text(json.dumps(test_message))
            
            # Should receive echo response
            response_text = websocket.receive_text()
            response_data = json.loads(response_text)
            
            assert response_data["type"] == "echo"
            assert response_data["original_message"] == test_message
            assert response_data["message"] == "Message received"

    def test_websocket_invalid_json(self, client: TestClient):
        """Test handling of invalid JSON messages"""
        with client.websocket_connect("/socket") as websocket:
            # Send invalid JSON
            invalid_json = '{"type": "test", "invalid": }'
            websocket.send_text(invalid_json)
            
            # Should receive echo as plain text
            data = websocket.receive_text()
            assert data.startswith("Echo:")

    def test_websocket_multiple_messages(self, client: TestClient):
        """Test sending multiple messages in sequence"""
        with client.websocket_connect("/socket") as websocket:
            messages = [
                ("ping", "pong"),
                ("hello", "Echo: hello"),
                ("ping", "pong"),
                ("test message", "Echo: test message")
            ]
            
            for send_msg, expected_response in messages:
                websocket.send_text(send_msg)
                data = websocket.receive_text()
                assert data == expected_response

    def test_websocket_json_ping_with_extra_fields(self, client: TestClient):
        """Test JSON ping with additional fields"""
        with client.websocket_connect("/socket") as websocket:
            ping_message = {
                "type": "ping",
                "timestamp": "2023-12-01T10:00:00Z",
                "client_id": "test-client-123",
                "extra_field": "should be preserved"
            }
            websocket.send_text(json.dumps(ping_message))
            
            response_text = websocket.receive_text()
            response_data = json.loads(response_text)
            
            assert response_data["type"] == "pong"
            assert response_data["timestamp"] == "2023-12-01T10:00:00Z"
            assert response_data["message"] == "pong"


class TestWebSocketManager:
    """Test class for WebSocket manager"""

    @pytest.fixture
    def websocket_manager(self):
        """Create a fresh WebSocket manager for testing"""
        return WebSocketManager()

    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocket connection"""
        class MockWebSocket:
            def __init__(self):
                self.messages = []
                self.closed = False
            
            async def accept(self):
                pass
            
            async def send_text(self, message):
                if self.closed:
                    raise Exception("WebSocket closed")
                self.messages.append(message)
            
            def close(self):
                self.closed = True
        
        return MockWebSocket()

    @pytest.mark.asyncio
    async def test_websocket_manager_connect(self, websocket_manager, mock_websocket):
        """Test WebSocket manager connection handling"""
        initial_count = len(websocket_manager.active_connections)
        
        await websocket_manager.connect(mock_websocket)
        
        assert len(websocket_manager.active_connections) == initial_count + 1
        assert mock_websocket in websocket_manager.active_connections

    def test_websocket_manager_disconnect(self, websocket_manager, mock_websocket):
        """Test WebSocket manager disconnection handling"""
        # Add connection first
        websocket_manager.active_connections.append(mock_websocket)
        initial_count = len(websocket_manager.active_connections)
        
        websocket_manager.disconnect(mock_websocket)
        
        assert len(websocket_manager.active_connections) == initial_count - 1
        assert mock_websocket not in websocket_manager.active_connections

    def test_websocket_manager_disconnect_nonexistent(self, websocket_manager, mock_websocket):
        """Test disconnecting a WebSocket that wasn't connected"""
        initial_count = len(websocket_manager.active_connections)
        
        # Should not raise an error
        websocket_manager.disconnect(mock_websocket)
        
        assert len(websocket_manager.active_connections) == initial_count

    @pytest.mark.asyncio
    async def test_websocket_manager_send_personal_message(self, websocket_manager, mock_websocket):
        """Test sending personal message through manager"""
        await websocket_manager.send_personal_message("test message", mock_websocket)
        
        assert len(mock_websocket.messages) == 1
        assert mock_websocket.messages[0] == "test message"

    @pytest.mark.asyncio
    async def test_websocket_manager_send_to_closed_connection(self, websocket_manager, mock_websocket):
        """Test handling of messages sent to closed connections"""
        websocket_manager.active_connections.append(mock_websocket)
        mock_websocket.close()
        
        # Should handle the error gracefully
        await websocket_manager.send_personal_message("test message", mock_websocket)
        
        # Connection should be removed from active connections
        assert mock_websocket not in websocket_manager.active_connections

    @pytest.mark.asyncio
    async def test_websocket_manager_broadcast(self, websocket_manager):
        """Test broadcasting message to all connections"""
        # Create multiple mock connections
        mock_connections = []
        for i in range(3):
            mock_ws = type('MockWebSocket', (), {
                'messages': [],
                'send_text': lambda self, msg: self.messages.append(msg)
            })()
            mock_connections.append(mock_ws)
            websocket_manager.active_connections.append(mock_ws)
        
        await websocket_manager.broadcast("broadcast message")
        
        # All connections should have received the message
        for mock_ws in mock_connections:
            assert len(mock_ws.messages) == 1
            assert mock_ws.messages[0] == "broadcast message"

    @pytest.mark.asyncio
    async def test_websocket_manager_broadcast_with_failed_connection(self, websocket_manager):
        """Test broadcasting with some failed connections"""
        # Create mock connections, one that will fail
        working_ws = type('MockWebSocket', (), {
            'messages': [],
            'send_text': lambda self, msg: self.messages.append(msg)
        })()
        
        failing_ws = type('MockWebSocket', (), {
            'messages': [],
            'send_text': lambda self, msg: exec('raise Exception("Connection failed")')
        })()
        
        websocket_manager.active_connections.extend([working_ws, failing_ws])
        
        await websocket_manager.broadcast("broadcast message")
        
        # Working connection should have received the message
        assert len(working_ws.messages) == 1
        assert working_ws.messages[0] == "broadcast message"
        
        # Failed connection should be removed from active connections
        assert failing_ws not in websocket_manager.active_connections
        assert working_ws in websocket_manager.active_connections