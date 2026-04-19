from app.services import push_delivery_service


def test_extract_fcm_tokens_filters_non_fcm_entries() -> None:
    tokens = push_delivery_service.extract_fcm_tokens(
        [
            "fcm:abc-123",
            "web:browser-token",
            "cap-android::legacy",
            "fcm:abc-123",
            "fcm:def-456",
        ]
    )

    assert tokens == ["abc-123", "def-456"]


def test_serialize_fcm_data_stringifies_non_strings() -> None:
    payload = push_delivery_service.serialize_fcm_data(
        {
            "tag": "seller-payment-decision-1",
            "months": 3,
            "decision": True,
            "meta": {"href": "/seller"},
            "ignore": None,
        }
    )

    assert payload == {
        "tag": "seller-payment-decision-1",
        "months": "3",
        "decision": "true",
        "meta": "{\"href\":\"/seller\"}",
    }
