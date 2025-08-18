import pika
import os
import logging
import json
from threading import Thread
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASS = os.getenv("RABBITMQ_PASSWORD", "guest")

class RabbitMQService:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.connect()

    def connect(self):
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                self.connection = pika.BlockingConnection(
                    pika.ConnectionParameters(
                        host=RABBITMQ_HOST,
                        port=RABBITMQ_PORT,
                        credentials=pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS),
                    )
                )
                self.channel = self.connection.channel()
                logger.info("Successfully connected to RabbitMQ")
                return
            except pika.exceptions.AMQPConnectionError as e:
                retry_count += 1
                if retry_count < max_retries:
                    logger.warning(f"Failed to connect to RabbitMQ (attempt {retry_count}/{max_retries}): {e}. Retrying in 5 seconds...")
                    time.sleep(5)
                else:
                    logger.error(f"Failed to connect to RabbitMQ after {max_retries} attempts: {e}")
                    self.connection = None
                    self.channel = None

    def publish_message(self, queue_name, message):
        if not self.connection or not self.channel:
            logger.warning("RabbitMQ not connected. Message will be logged but not sent.")
            logger.info(f"Would publish to queue '{queue_name}': {message}")
            return False
            
        try:
            self.channel.queue_declare(queue=queue_name, durable=True)
            self.channel.basic_publish(
                exchange="",
                routing_key=queue_name,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                ),
            )
            logger.info(f"Message published to queue '{queue_name}': {message}")
            return True
        except Exception as e:
            logger.error(f"Failed to publish message: {e}")
            # Try to reconnect once
            self.connect()
            if self.connection and self.channel:
                try:
                    self.channel.queue_declare(queue=queue_name, durable=True)
                    self.channel.basic_publish(
                        exchange="",
                        routing_key=queue_name,
                        body=json.dumps(message),
                        properties=pika.BasicProperties(
                            delivery_mode=2,  # Make message persistent
                        ),
                    )
                    logger.info(f"Message published to queue '{queue_name}' after reconnect: {message}")
                    return True
                except Exception as retry_e:
                    logger.error(f"Failed to publish message after reconnect: {retry_e}")
            return False

    def close_connection(self):
        if self.connection and self.connection.is_open:
            self.connection.close()
            logger.info("RabbitMQ connection closed")

rabbitmq_service = RabbitMQService()
