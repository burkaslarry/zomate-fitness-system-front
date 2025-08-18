"""
Main FastAPI application entry point
"""

import logging
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import servers, devices, notifications, jira, health, rag
from app.websocket import websocket_endpoint
from app.rabbitmq import rabbitmq_service
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI app
app = FastAPI(
    title="Network Monitoring Backend",
    description="A robust server monitoring backend service with push notifications and JIRA integration",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(servers.router)
app.include_router(devices.router)
app.include_router(notifications.router)
app.include_router(jira.router)
app.include_router(rag.router)

# WebSocket endpoint
@app.websocket("/socket")
async def websocket_health_check(websocket: WebSocket):
    """
    WebSocket endpoint for health checks
    Listens for 'ping' messages and responds with 'pong'
    """
    await websocket_endpoint(websocket)


@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    logger.info("Network Monitoring Backend starting up...")
    logger.info("Database tables created successfully")
    logger.info("Application ready to serve requests")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event"""
    logger.info("Network Monitoring Backend shutting down...")
    rabbitmq_service.close_connection()


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Network Monitoring Backend API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "True").lower() == "true"
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )