"""Assistant de chat AMAZER (infos & guidage).

Module 100% additif et isole : aucune route existante n'est modifiee.
- Sans cle IA configuree -> repond via une FAQ integree (gratuit, marche toujours).
- Avec ASSISTANT_API_KEY (cle gratuite Google Gemini) -> repond en IA conversationnelle.
En cas d'erreur IA, on retombe automatiquement sur la FAQ : l'app n'est jamais bloquee.
"""
from __future__ import annotations

import json
import os
import re
import unicodedata
from typing import Annotated, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/assistant", tags=["assistant"])

SYSTEM_PROMPT = (
    "Tu es l'assistant virtuel d'AMAZER, une marketplace au Niger (boutiques, restaurants, "
    "offres premium/hotels, transport). Tu reponds de facon courte, claire et chaleureuse, "
    "en francais (ou dans la langue du client). Ton role: INFORMER et GUIDER seulement.\n"
    "Connaissances cles:\n"
    "- Commander: le client parcourt les boutiques/restaurants, ajoute au panier et paie par "
    "Nita ou Amana, puis est livre.\n"
    "- Devenir vendeur: s'inscrire, choisir une formule (Boutique, Restaurant ou Premium), puis "
    "payer l'abonnement qui est valide par l'administration avant activation.\n"
    "- Reservations: tables de restaurant et offres premium/transport, avec un acompte a payer "
    "pour valider.\n"
    "- Promotions: disponibles sur la page Promotions.\n"
    "Regles: ne jamais inventer de prix precis, de delais exacts ni de stock. Ne pretends pas "
    "acceder au compte ni aux commandes d'un client. Si la demande depasse l'info generale "
    "(litige, paiement bloque, remboursement), invite poliment a contacter le support humain. "
    "Reste bref (2-5 phrases)."
)

_DEFAULT_REPLY = (
    "Bonjour et bienvenue sur AMAZER ! Je peux t'aider sur : passer une commande, les moyens de "
    "paiement (Nita/Amana), la livraison, devenir vendeur, les reservations et les promotions. "
    "Quelle est ta question ?"
)

_FAQ = [
    (("commander", "acheter", "commande", "panier"),
     "Pour commander : ouvre une boutique ou un restaurant, ajoute les articles au panier, puis "
     "paie par Nita ou Amana. Tu seras ensuite livre. Tu peux suivre l'etat de ta commande dans "
     "ton espace."),
    (("vendeur", "vendre", "boutique", "ouvrir", "magasin", "restaurateur"),
     "Pour devenir vendeur : inscris-toi, choisis ta formule (Boutique, Restaurant ou Premium), "
     "puis paie l'abonnement. L'administration valide le paiement et ta boutique est activee."),
    (("paiement", "payer", "nita", "amana", "argent", "mobile money"),
     "Les paiements se font par Nita ou Amana. Au moment de payer, indique le mode choisi ; pour "
     "certaines operations une reference de transaction peut etre demandee."),
    (("livraison", "livrer", "livreur", "delai", "expedition"),
     "La livraison est assuree apres le paiement de ta commande. Le suivi se fait depuis ton "
     "espace client."),
    (("promo", "promotion", "reduction", "solde", "offre"),
     "Les promotions du moment sont regroupees sur la page Promotions du site."),
    (("abonnement", "renouveler", "renouvellement", "expire"),
     "Les vendeurs paient un abonnement valide par l'administration. A l'echeance, la boutique "
     "est suspendue puis reactivee des le reabonnement."),
    (("reservation", "reserver", "table", "chambre", "hotel", "trajet", "billet", "acompte"),
     "Tu peux reserver une table de restaurant ou une offre premium/transport. Si un acompte est "
     "demande, la reservation est validee une fois l'acompte paye."),
    (("contact", "aide", "support", "probleme", "litige", "rembours", "humain", "service client"),
     "Pour un cas particulier (paiement bloque, litige, remboursement), contacte le support "
     "humain d'AMAZER qui prendra le relais."),
    (("bonjour", "salut", "bonsoir", "coucou", "hello", "merci"),
     _DEFAULT_REPLY),
]


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", text).strip()


def faq_reply(message: str) -> str:
    n = _norm(message)
    for keywords, answer in _FAQ:
        if any(k in n for k in keywords):
            return answer
    return _DEFAULT_REPLY


def _gemini_reply(history: list[dict], model: str, api_key: str) -> str | None:
    """Appel Gemini via stdlib urllib (aucune dependance ajoutee). None si echec."""
    import urllib.error
    import urllib.request

    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in history
    ]
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 500, "temperature": 0.4},
    }
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    )
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        return text or None
    except (urllib.error.URLError, KeyError, IndexError, ValueError, TimeoutError):
        return None


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)


class ChatResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str
    mode: Literal["ai", "faq"]


# Chaine de modeles gratuits essayes dans l'ordre. Un seul modele est trop
# fragile (429 quota / 503 surcharge intermittents cote Google) : on bascule
# automatiquement sur le suivant, et seulement en dernier recours sur la FAQ.
_DEFAULT_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.0-flash",
]


def _models_from_env() -> list[str]:
    """Liste de modeles depuis ASSISTANT_MODEL (separes par des virgules), sinon defauts.
    On ajoute toujours les defauts en repli pour rester robuste meme si une seule
    valeur (eventuellement saturee) est configuree."""
    raw = (os.getenv("ASSISTANT_MODEL") or "").strip()
    configured = [m.strip() for m in raw.split(",") if m.strip()]
    ordered: list[str] = []
    for m in [*configured, *_DEFAULT_MODELS]:
        if m not in ordered:
            ordered.append(m)
    return ordered


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request) -> ChatResponse:
    enforce_rate_limit(request, key="assistant_chat", limit=20, window_seconds=60)
    history = [{"role": m.role, "content": m.content} for m in payload.messages][-12:]
    last_user = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")

    api_key = (os.getenv("ASSISTANT_API_KEY") or "").strip()
    if api_key:
        for model in _models_from_env():
            ai = _gemini_reply(history, model, api_key)
            if ai:
                return ChatResponse(reply=ai, mode="ai")
    # Repli FAQ (gratuit, toujours disponible)
    return ChatResponse(reply=faq_reply(last_user), mode="faq")
