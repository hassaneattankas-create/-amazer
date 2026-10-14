"""Assistant de chat AMAZER (informations, guidage et recherche dans le catalogue).

- A chaque question, on cherche dans le VRAI catalogue : l'assistant ne recommande que des
  produits existants, avec leur prix reel (jamais invente).
- Avec ASSISTANT_API_KEY (Google Gemini, offre gratuite) : reponse conversationnelle.
- Sans cle ou en cas d'erreur IA : FAQ integree + produits trouves. L'app n'est jamais bloquee.
"""

from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.rate_limit import enforce_rate_limit
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/assistant", tags=["assistant"])

SYSTEM_PROMPT = (
    "Tu es l'assistant d'AMAZER, la plateforme du commerce au Niger (Niamey). "
    "Reponds en francais simple (ou dans la langue du client), en 1 a 4 phrases courtes. "
    "Pas de jargon, pas de longues explications.\n"
    "\n"
    "CE QUE PERMET AMAZER AUJOURD'HUI :\n"
    "- Acheter : rechercher (filtres prix, categorie, tri), ajouter au panier, indiquer adresse et "
    "telephone de livraison, commander.\n"
    "- Payer : Nita (transfert au numero AMAZER puis saisie de la reference ; l'equipe verifie avant "
    "confirmation) ou Amana (validation dans l'application AmanaTa).\n"
    "- Livraison a Niamey (standard ou express) par un livreur AMAZER ; frais par boutique, affiches "
    "avant la commande. Suivi dans le tableau de bord ; le client peut annuler une commande non payee.\n"
    "- Ecrire a une boutique (bouton « Ecrire a la boutique », page Messages).\n"
    "- Reserver une table ou une chambre ; l'acompte est verifie par le commercant.\n"
    "- Mot de passe oublie : page « Mot de passe oublie », code envoye par e-mail ou WhatsApp.\n"
    "- Vendre : page « Devenir vendeur », choisir une formule, publier ses produits.\n"
    "- Aide complete : page « Comment ca marche ? ».\n"
    "\n"
    "REGLES :\n"
    "- Tu n'as acces a aucun compte, commande ni paiement : ne pretends jamais le contraire.\n"
    "- Ne recommande QUE les produits listes dans « CATALOGUE » ci-dessous, avec leur prix exact. "
    "Si la liste est vide ou ne correspond pas, dis-le simplement et propose de reformuler. "
    "N'invente jamais de produit, de prix, de stock ni de delai.\n"
    "- Refuse poliment toute question sur l'administration interne d'AMAZER.\n"
    "- Pour un litige, un paiement bloque ou un remboursement : oriente vers le support humain "
    "(WhatsApp ci-dessous)."
)

_DEFAULT_REPLY = (
    "Bonjour ! Je peux vous aider à trouver un produit, commander, payer, suivre une livraison "
    "ou ouvrir votre boutique. Que cherchez-vous ?"
)

_FAQ = [
    (("admin", "administrateur", "administration", "back office", "backoffice", "panneau admin", "comptabilite"),
     "Désolé, l'administration est réservée à l'équipe AMAZER. Je peux vous aider à acheter, payer ou vendre."),
    (("mot de passe", "password", "connexion impossible", "oublie"),
     "Ouvrez la page « Mot de passe oublié », saisissez votre e-mail ou WhatsApp, puis le code reçu."),
    (("annuler", "annulation"),
     "Une commande non payée s'annule depuis votre tableau de bord. Une commande payée : contactez le support."),
    (("livreur", "livraison", "livrer", "delai", "expedition"),
     "Un livreur AMAZER livre à Niamey (standard ou express). Les frais s'affichent avant la commande. "
     "Suivez votre commande dans le tableau de bord."),
    (("paiement", "payer", "nita", "amana", "argent", "mobile money"),
     "Deux moyens : Nita (transfert au numéro AMAZER, puis la référence) ou Amana (validation dans AmanaTa). "
     "La commande est confirmée après vérification du paiement."),
    (("commander", "acheter", "commande", "panier"),
     "Ajoutez les produits au panier, indiquez adresse et téléphone, choisissez le paiement puis « Commander »."),
    (("vendeur", "vendre", "ouvrir une boutique", "ma boutique", "restaurateur"),
     "Ouvrez la page « Devenir vendeur », choisissez votre formule, puis publiez vos produits."),
    (("message", "contacter la boutique", "ecrire"),
     "Sur la page d'une boutique, cliquez « Écrire à la boutique ». Vos échanges sont dans « Messages »."),
    (("promo", "promotion", "reduction", "solde"),
     "Les promotions du moment sont sur la page Promotions."),
    (("abonnement", "renouveler", "expire"),
     "L'abonnement vendeur se règle depuis l'espace vendeur ; la boutique reste visible tant qu'il est actif."),
    (("reservation", "reserver", "table", "chambre", "hotel", "acompte"),
     "Réservez depuis la page du restaurant ou de l'hôtel. L'acompte éventuel est vérifié par le commerçant."),
    (("contact", "aide", "support", "probleme", "litige", "rembours", "humain", "whatsapp"),
     "Pour un cas particulier, écrivez au support AMAZER sur WhatsApp : il vous répondra."),
    (("bonjour", "salut", "bonsoir", "coucou", "hello", "merci"), _DEFAULT_REPLY),
]

# Mots trop courants pour une recherche de produit.
_STOPWORDS = {
    "avez", "vous", "est", "ce", "que", "qui", "les", "des", "une", "un", "pour", "avec", "dans", "sur",
    "mon", "mes", "ton", "vos", "votre", "nos", "notre", "cherche", "cherchez", "recherche", "veux",
    "voudrais", "besoin", "acheter", "achat", "trouver", "prix", "combien", "coute", "coutent", "bonjour",
    "salut", "merci", "svp", "stp", "quel", "quelle", "quels", "quelles", "ou", "pas", "plus", "moins",
    "cher", "chere", "bon", "bonne", "amazer", "il", "elle", "ils", "nous", "je", "tu", "me", "moi",
    "aussi", "comment", "faire", "peut", "peux", "pouvez", "disponible", "dispo", "y", "a", "en", "de",
    "du", "la", "le", "et", "au", "aux", "c", "d", "l", "j", "s", "t", "n", "qu",
}


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", text).strip()


def faq_reply(message: str) -> str:
    n = _norm(message)
    for keywords, answer in _FAQ:
        if any(k in n for k in keywords):
            return answer
    return _DEFAULT_REPLY


def _keywords(message: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", _norm(message))
    return [word for word in words if len(word) >= 3 and word not in _STOPWORDS][:6]


class AssistantProduct(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    price: float
    shop: str
    image_url: str | None


def catalog_matches(db: Session, message: str, limit: int = 4) -> list[AssistantProduct]:
    """Produits reels correspondant a la question (recherche plein texte, en stock uniquement)."""
    keywords = _keywords(message)
    if not keywords:
        return []
    from app.services.product_service import ProductService

    service = ProductService(db)
    # D'abord la phrase complete, puis chaque mot (le plus long d'abord).
    attempts = [" ".join(keywords), *sorted(set(keywords), key=len, reverse=True)][:4]
    for query in attempts:
        try:
            result = service.search_products(
                query=query, barcode=None, brand=None, category_id=None, category_slug=None,
                spec_key=None, spec_value=None, min_price=None, max_price=None,
                in_stock_only=True, sort="relevance", limit=limit, offset=0,
            )
        except Exception:  # pragma: no cover - la recherche ne doit jamais casser le chat
            logger.exception("Recherche catalogue de l'assistant en echec")
            return []
        if result.items:
            return [
                AssistantProduct(
                    id=item.id,
                    name=item.name,
                    price=float(item.best_offer.amount),
                    shop=item.best_offer.vendor.name,
                    image_url=item.main_image_url,
                )
                for item in result.items[:limit]
            ]
    return []


def _support_whatsapp(db: Session) -> str | None:
    try:
        from app.services.seller_finance_service import get_or_create_global_settings

        row = get_or_create_global_settings(db)
        value = getattr(row, "support_whatsapp", None) or getattr(row, "support_phone", None)
        return value if isinstance(value, str) and value.strip() else None
    except Exception:  # pragma: no cover
        return None


def build_system_prompt(products: list[AssistantProduct], support_whatsapp: str | None) -> str:
    lines = [SYSTEM_PROMPT, "", "CATALOGUE (resultats reels pour la derniere question) :"]
    if products:
        lines += [f"- {p.name} — {int(round(p.price)):,} XOF — boutique {p.shop}".replace(",", " ") for p in products]
        lines.append("Les fiches de ces produits s'affichent sous ta reponse : inutile de recopier les liens.")
    else:
        lines.append("- (aucun produit trouve)")
    if support_whatsapp:
        lines += ["", f"SUPPORT HUMAIN : WhatsApp {support_whatsapp}."]
    return "\n".join(lines)


def _gemini_reply(history: list[dict], model: str, api_key: str, system_prompt: str = SYSTEM_PROMPT) -> str | None:
    """Appel Gemini via stdlib urllib (aucune dependance ajoutee). None si echec."""
    import urllib.error
    import urllib.request

    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in history
    ]
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 400, "temperature": 0.3},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
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
    # Produits reels proposes (affiches en fiches cliquables sous la reponse).
    products: list[AssistantProduct] = Field(default_factory=list)


# Chaine de modeles gratuits essayes dans l'ordre (429 / 503 intermittents cote Google).
_DEFAULT_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.0-flash",
]


def _models_from_env() -> list[str]:
    raw = (os.getenv("ASSISTANT_MODEL") or "").strip()
    configured = [m.strip() for m in raw.split(",") if m.strip()]
    ordered: list[str] = []
    for m in [*configured, *_DEFAULT_MODELS]:
        if m not in ordered:
            ordered.append(m)
    return ordered


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, request: Request, db: Annotated[Session, Depends(get_db)]) -> ChatResponse:
    enforce_rate_limit(request, key="assistant_chat", limit=20, window_seconds=60)
    history = [{"role": m.role, "content": m.content} for m in payload.messages][-12:]
    last_user = next((m["content"] for m in reversed(history) if m["role"] == "user"), "")

    products = catalog_matches(db, last_user)
    api_key = (os.getenv("ASSISTANT_API_KEY") or "").strip()
    if api_key:
        system_prompt = build_system_prompt(products, _support_whatsapp(db))
        for model in _models_from_env():
            ai = _gemini_reply(history, model, api_key, system_prompt)
            if ai:
                return ChatResponse(reply=ai, mode="ai", products=products)

    # Repli sans IA : FAQ, ou les produits trouves.
    faq = faq_reply(last_user)
    if products and faq == _DEFAULT_REPLY:
        faq = "Voici ce que j'ai trouvé sur AMAZER :"
    return ChatResponse(reply=faq, mode="faq", products=products)
