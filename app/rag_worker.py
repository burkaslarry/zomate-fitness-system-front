import pika
import os
import logging
import json
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASS = os.getenv("RABBITMQ_PASSWORD", "guest")
RAG_QUERY_QUEUE = "rag_query_queue"
RAG_RESULTS_QUEUE = "rag_results_queue"

def process_rag_query(query):
    # Placeholder for the actual RAG processing logic
    logger.info(f"Processing RAG query: {query}")
    time.sleep(5)  # Simulate a long-running task
    result = f"Result for query: '{query}'"
    logger.info("RAG query processed successfully")
    return result

def on_message(ch, method, properties, body):
    try:
        message = json.loads(body)
        query = message.get("query")
        if query:
            result = process_rag_query(query)
            publish_result(result)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        logger.error(f"Failed to process message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

def publish_result(result):
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            credentials=pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS),
        )
    )
    channel = connection.channel()
    channel.queue_declare(queue=RAG_RESULTS_QUEUE, durable=True)
    channel.basic_publish(
        exchange="",
        routing_key=RAG_RESULTS_QUEUE,
        body=json.dumps({"result": result}),
        properties=pika.BasicProperties(
            delivery_mode=2,  # Make message persistent
        ),
    )
    connection.close()
    logger.info(f"Published result to '{RAG_RESULTS_QUEUE}': {result}")

def start_consumer():
    while True:
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=RABBITMQ_HOST,
                    port=RABBITMQ_PORT,
                    credentials=pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS),
                )
            )
            channel = connection.channel()
            channel.queue_declare(queue=RAG_QUERY_QUEUE, durable=True)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=RAG_QUERY_QUEUE, on_message_callback=on_message)
            logger.info("Starting RAG worker, waiting for messages...")
            channel.start_consuming()
        except pika.exceptions.AMQPConnectionError as e:
            logger.error(f"Connection to RabbitMQ failed: {e}. Retrying in 5 seconds...")
            time.sleep(5)
        except Exception as e:
            logger.error(f"An unexpected error occurred: {e}. Restarting consumer...")
            time.sleep(5)

if __name__ == "__main__":
    start_consumer()
