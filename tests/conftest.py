"""
Pytest configuration and fixtures
"""

import pytest
import os
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import get_db, Base
from app.auth import create_demo_token
from app.models import ServerStatus, Device, APIStatus, OSType


# Test database URL - using SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Override the database dependency
app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session")
def db_engine():
    """Create test database engine"""
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create a database session for testing"""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client() -> Generator:
    """Create test client"""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers():
    """Create authorization headers with JWT token"""
    token = create_demo_token()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_server_data():
    """Sample server data for testing"""
    return {
        "server_name": "test-server-01",
        "cpu_load": 45.5,
        "memory_usage": 67.8,
        "api_status": "online"
    }


@pytest.fixture
def sample_device_data():
    """Sample device data for testing"""
    return {
        "fcm_token": "test-fcm-token-123",
        "os_type": "android",
        "os_version": "13.0"
    }


@pytest.fixture
def created_server(db_session, sample_server_data):
    """Create a server in the database for testing"""
    server = ServerStatus(
        server_name=sample_server_data["server_name"],
        cpu_load=sample_server_data["cpu_load"],
        memory_usage=sample_server_data["memory_usage"],
        api_status=APIStatus.ONLINE
    )
    db_session.add(server)
    db_session.commit()
    db_session.refresh(server)
    return server


@pytest.fixture
def created_device(db_session, sample_device_data):
    """Create a device in the database for testing"""
    device = Device(
        fcm_token=sample_device_data["fcm_token"],
        os_type=OSType.ANDROID,
        os_version=sample_device_data["os_version"]
    )
    db_session.add(device)
    db_session.commit()
    db_session.refresh(device)
    return device


@pytest.fixture(autouse=True)
def setup_test_env():
    """Set up test environment variables"""
    os.environ["DATABASE_URL"] = SQLALCHEMY_DATABASE_URL
    os.environ["SECRET_KEY"] = "test-secret-key"
    os.environ["FIREBASE_CREDENTIALS_PATH"] = ""  # Disable Firebase for tests
    os.environ["JIRA_BASE_URL"] = ""  # Disable JIRA for tests
    yield
    # Cleanup is handled by pytest automatically