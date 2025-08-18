"""
WebSocket handler for health checks and real-time notifications
"""

import logging
import json
import asyncio
import threading
from fastapi import WebSocket, WebSocketDisconnect
from typing import List
import pika
import os

logger = logging.getLogger(__name__)

# RabbitMQ configuration
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASS = os.getenv("RABBITMQ_PASSWORD", "guest")
RAG_RESULTS_QUEUE = "rag_results_queue"


class WebSocketManager:
    """Manager for WebSocket connections"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.loop = None
        self.rabbitmq_consumer_thread = None
        self.is_consuming = False
    
    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connection established. Total connections: {len(self.active_connections)}")
        
        # Start RabbitMQ consumer if this is the first connection
        if len(self.active_connections) == 1 and not self.is_consuming:
            self.start_rabbitmq_consumer()
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket connection closed. Total connections: {len(self.active_connections)}")
        
        # Stop RabbitMQ consumer if no more connections
        if len(self.active_connections) == 0:
            self.stop_rabbitmq_consumer()
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {str(e)}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: str):
        """Broadcast a message to all connected clients"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to WebSocket connection: {str(e)}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)
    
    def start_rabbitmq_consumer(self):
        """Start RabbitMQ consumer in a background thread"""
        if not self.is_consuming:
            self.loop = asyncio.get_event_loop()
            self.is_consuming = True
            self.rabbitmq_consumer_thread = threading.Thread(target=self._rabbitmq_consumer_worker)
            self.rabbitmq_consumer_thread.daemon = True
            self.rabbitmq_consumer_thread.start()
            logger.info("Started RabbitMQ consumer for WebSocket notifications")
    
    def stop_rabbitmq_consumer(self):
        """Stop RabbitMQ consumer"""
        self.is_consuming = False
        logger.info("Stopped RabbitMQ consumer for WebSocket notifications")
    
    def _rabbitmq_consumer_worker(self):
        """RabbitMQ consumer worker that runs in a separate thread"""
        while self.is_consuming:
            try:
                connection = pika.BlockingConnection(
                    pika.ConnectionParameters(
                        host=RABBITMQ_HOST,
                        port=RABBITMQ_PORT,
                        credentials=pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS),
                    )
                )
                channel = connection.channel()
                channel.queue_declare(queue=RAG_RESULTS_QUEUE, durable=True)
                
                def callback(ch, method, properties, body):
                    try:
                        message = json.loads(body)
                        notification = {
                            "type": "rag_result",
                            "data": message,
                            "timestamp": asyncio.get_event_loop().time()
                        }
                        # Schedule the broadcast in the main event loop
                        asyncio.run_coroutine_threadsafe(
                            self.broadcast(json.dumps(notification)), 
                            self.loop
                        )
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                    except Exception as e:
                        logger.error(f"Failed to process RAG result: {e}")
                        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                
                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(queue=RAG_RESULTS_QUEUE, on_message_callback=callback)
                
                logger.info("WebSocket RabbitMQ consumer started, waiting for messages...")
                while self.is_consuming:
                    connection.process_data_events(time_limit=1)
                
                connection.close()
                
            except Exception as e:
                logger.error(f"RabbitMQ consumer error: {e}")
                if self.is_consuming:
                    logger.info("Retrying RabbitMQ connection in 5 seconds...")
                    threading.Event().wait(5)


# Global WebSocket manager instance
websocket_manager = WebSocketManager()


async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint handler
    Listens for 'ping' messages and responds with 'pong'
    """
    await websocket_manager.connect(websocket)
    
    try:
        while True:
            # Wait for message from client
            data = await websocket.receive_text()
            
            try:
                # Try to parse as JSON
                message_data = json.loads(data)
                message_type = message_data.get("type", "").lower()
                
                if message_type == "ping":
                    # Respond with pong
                    response = {
                        "type": "pong",
                        "timestamp": message_data.get("timestamp"),
                        "message": "pong"
                    }
                    await websocket_manager.send_personal_message(
                        json.dumps(response), 
                        websocket
                    )
                    logger.debug("Responded to ping with pong")
                elif message_type == "subscribe":
                    # Handle subscription requests
                    response = {
                        "type": "subscription_confirmed",
                        "message": "Subscribed to real-time notifications"
                    }
                    await websocket_manager.send_personal_message(
                        json.dumps(response), 
                        websocket
                    )
                    logger.debug("Client subscribed to notifications")
                else:
                    # Echo other messages back
                    response = {
                        "type": "echo",
                        "original_message": message_data,
                        "message": "Message received"
                    }
                    await websocket_manager.send_personal_message(
                        json.dumps(response), 
                        websocket
                    )
                    
            except json.JSONDecodeError:
                # Handle plain text messages
                if data.lower().strip() == "ping":
                    await websocket_manager.send_personal_message("pong", websocket)
                    logger.debug("Responded to text ping with pong")
                else:
                    # Echo the message back
                    await websocket_manager.send_personal_message(f"Echo: {data}", websocket)
                    
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        websocket_manager.disconnect(websocket)