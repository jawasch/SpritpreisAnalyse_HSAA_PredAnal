import os
import pytest
from fastapi.testclient import TestClient

# Force mock mode for all tests regardless of .env
os.environ["USE_MOCK_DATA"] = "true"

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
