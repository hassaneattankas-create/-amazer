from fastapi.testclient import TestClient

from app.main import app


def test_openapi_contains_new_endpoints() -> None:
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200

    paths = response.json()["paths"]
    assert "/api/v1/products/search" in paths
    assert "/api/v1/cart" in paths
    assert "/api/v1/cart/items" in paths
    assert "/api/v1/cart/items/{item_id}" in paths
    assert "/api/v1/categories" in paths
    assert "/api/v1/vendors" in paths
