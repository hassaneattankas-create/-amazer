"""Assistant : recommandations ancrees dans le vrai catalogue, jamais inventees."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.routes import assistant as route


def _request():
    return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})


PRODUCT = route.AssistantProduct(id="p1", name="Riz parfumé 5 kg", price=4500, shop="Amazig", image_url=None)


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    monkeypatch.setattr(route, "enforce_rate_limit", lambda *a, **k: None)
    monkeypatch.setattr(route, "_support_whatsapp", lambda _db: "+227 96953163")


def test_keywords_drop_common_words() -> None:
    assert route._keywords("Bonjour, avez-vous du riz parfumé pas cher ?") == ["riz", "parfume"]
    assert route._keywords("bonjour merci") == []


def test_prompt_lists_only_real_products_with_exact_prices() -> None:
    prompt = route.build_system_prompt([PRODUCT], "+227 96953163")
    assert "Riz parfumé 5 kg — 4 500 XOF — boutique Amazig" in prompt
    assert "WhatsApp +227 96953163" in prompt
    empty = route.build_system_prompt([], None)
    assert "(aucun produit trouve)" in empty


def test_ai_answer_comes_with_real_products(monkeypatch) -> None:
    monkeypatch.setenv("ASSISTANT_API_KEY", "test")
    monkeypatch.setattr(route, "catalog_matches", lambda _db, _msg: [PRODUCT])
    seen: dict = {}

    def fake_gemini(history, model, api_key, system_prompt):
        seen["prompt"] = system_prompt
        return "Oui, le riz parfumé 5 kg est à 4 500 XOF chez Amazig."

    monkeypatch.setattr(route, "_gemini_reply", fake_gemini)
    response = route.chat(route.ChatRequest(messages=[{"role": "user", "content": "du riz ?"}]), _request(), Mock())
    assert response.mode == "ai"
    assert response.products == [PRODUCT]
    assert "Riz parfumé 5 kg" in seen["prompt"]


def test_without_ai_products_are_still_shown(monkeypatch) -> None:
    monkeypatch.delenv("ASSISTANT_API_KEY", raising=False)
    monkeypatch.setattr(route, "catalog_matches", lambda _db, _msg: [PRODUCT])
    response = route.chat(route.ChatRequest(messages=[{"role": "user", "content": "riz"}]), _request(), Mock())
    assert response.mode == "faq"
    assert response.reply == "Voici ce que j'ai trouvé sur AMAZER :"
    assert response.products == [PRODUCT]


def test_ai_failure_falls_back_to_faq(monkeypatch) -> None:
    monkeypatch.setenv("ASSISTANT_API_KEY", "test")
    monkeypatch.setattr(route, "catalog_matches", lambda _db, _msg: [])
    monkeypatch.setattr(route, "_gemini_reply", lambda *a, **k: None)
    response = route.chat(
        route.ChatRequest(messages=[{"role": "user", "content": "Comment payer avec Nita ?"}]), _request(), Mock()
    )
    assert response.mode == "faq"
    assert "Nita" in response.reply


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("j'ai oublié mon mot de passe", "Mot de passe oublié"),
        ("je veux annuler ma commande", "non payée"),
        ("ou est mon livreur", "livreur"),
        ("panneau admin svp", "réservée à l'équipe"),
    ],
)
def test_faq_answers_current_features(question, expected) -> None:
    assert expected in route.faq_reply(question)


def test_duplicate_listings_are_shown_once(monkeypatch) -> None:
    offer = SimpleNamespace(amount=95000, vendor=SimpleNamespace(name="Tout Taff Telecom"))
    items = [
        SimpleNamespace(id="a", name="Samsung A17", best_offer=offer, main_image_url=None),
        SimpleNamespace(id="b", name="Samsung A17 ", best_offer=offer, main_image_url=None),
        SimpleNamespace(id="c", name="Samsung A16", best_offer=offer, main_image_url=None),
    ]

    class FakeService:
        def __init__(self, _db):
            pass

        def search_products(self, **_kwargs):
            return SimpleNamespace(items=items)

    import app.services.product_service as product_service

    monkeypatch.setattr(product_service, "ProductService", FakeService)
    products = route.catalog_matches(Mock(), "telephone samsung")
    assert [p.id for p in products] == ["a", "c"]


def test_public_knowledge_is_current_and_never_internal() -> None:
    data = route.savoir()
    titres = [fiche["titre"] for fiche in data["fiches"]]
    assert titres and not any(t.lower().startswith(("admin", "démarcher")) for t in titres)
    prompt = route.build_system_prompt([], None, "Combien coûte l'abonnement boutique ?")
    # Prix réels, formule gratuite, et plus jamais « le vendeur reçoit le prix entier ».
    assert "FAITS A JOUR" in prompt and "2 000 F" in prompt and "formule gratuite" in prompt
    assert "prix entier" not in prompt and "Admin ·" not in prompt


def test_question_brings_the_right_fiche() -> None:
    assert route.savoir_matches("comment je reçois l'argent de mes ventes ?")[0]["titre"].startswith("Espace vendeur")
    assert any("pharmacie" in f["titre"].lower() for f in route.savoir_matches("mettre ma pharmacie de garde"))


def test_without_ai_a_fiche_answers_instead_of_a_generic_hello(monkeypatch) -> None:
    monkeypatch.delenv("ASSISTANT_API_KEY", raising=False)
    monkeypatch.setattr(route, "catalog_matches", lambda _db, _msg: [])
    response = route.chat(
        route.ChatRequest(messages=[{"role": "user", "content": "Comment relever les compteurs des pompes ?"}]), _request(), Mock()
    )
    assert response.mode == "faq" and response.reply != route._DEFAULT_REPLY


def test_public_knowledge_never_mentions_the_admin_space() -> None:
    """La bulle du site ne doit rien savoir de l'administration (fiches et faits publics)."""
    import json
    import os
    import re

    path = os.path.join(os.path.dirname(__file__), "..", "..", "app", "data", "savoir_public.json")
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    texts = [*data["faits"], *[f"{f['titre']} {f['texte']}" for f in data["fiches"]]]
    leaks = [t[:120] for t in texts if re.search(r"admin|\bPIN\b", t, re.IGNORECASE)]
    assert leaks == []
