"""Traduction des messages d'erreur encore ecrits en anglais dans le code.

Applique une seule fois, dans le gestionnaire d'erreurs : le client voit toujours du francais.
Les messages lus tels quels par l'ecran du PIN admin (frontend/src/lib/admin-finance-verification.ts)
ne sont volontairement PAS traduits ici.
"""

FR: dict[str, str] = {
    "Invalid credentials": "Identifiant ou mot de passe incorrect.",
    "Account verification required": "Compte pas encore vérifié : saisissez le code reçu, ou contactez AMAZER.",
    "Acces non autorise": "Accès non autorisé.",
    "Email ou WhatsApp deja enregistre": "Cet e-mail ou ce numéro WhatsApp a déjà un compte. Connectez-vous ou utilisez « Mot de passe oublié ».",
    "Admin account cannot be removed": "Le compte administrateur ne peut pas être retiré.",
    "Cart item not found": "Article du panier introuvable.",
    "Category not found": "Catégorie introuvable.",
    "Category slug already exists": "Cette catégorie existe déjà.",
    "Create a seller profile first": "Créez d'abord votre profil vendeur.",
    "Devise invalide pour cette commande": "Devise invalide pour cette commande.",
    "Hotel booking not found": "Réservation introuvable.",
    "Hotel bookings are disabled for this storefront": "Cet établissement ne prend pas de réservation en ligne.",
    "Inventory item not found": "Article introuvable.",
    "Invalid or expired receipt token": "Lien du reçu invalide ou expiré.",
    "Invalid receipt token": "Lien du reçu invalide.",
    "Invalid receipt token type": "Lien du reçu invalide.",
    "Receipt token required": "Lien du reçu incomplet.",
    "Receipt integrity check failed": "Reçu altéré : vérification impossible.",
    "Menu item not found": "Plat introuvable.",
    "No active offers available for this product": "Ce produit n'est plus proposé à la vente.",
    "One or more menu items are invalid for this restaurant": "Un ou plusieurs plats ne sont plus disponibles dans ce restaurant.",
    "Order not found": "Commande introuvable.",
    "Payment gateway is not configured": "Paiement Amana momentanément indisponible : payez par Nita ou réessayez plus tard.",
    "Invalid payment gateway response": "Paiement Amana momentanément indisponible. Réessayez plus tard.",
    "Invalid payment status response": "Vérification du paiement Amana impossible pour le moment. Réessayez.",
    "Unable to initialize Amana payment": "Le paiement Amana n'a pas pu être lancé. Réessayez.",
    "Unable to verify Amana payment": "Vérification du paiement Amana impossible pour le moment. Réessayez.",
    "Premium storefront not found": "Établissement introuvable.",
    "Price not found": "Offre introuvable.",
    "Product not found": "Produit introuvable.",
    "Reservation not found": "Réservation introuvable.",
    "Restaurant not found": "Restaurant introuvable.",
    "Restaurant storefront not found": "Restaurant introuvable.",
    "Review not found": "Avis introuvable.",
    "Room type not found": "Chambre introuvable.",
    "Seller profile not found": "Profil vendeur introuvable.",
    "Storefront not found": "Boutique introuvable.",
    "Table reservations are disabled for this restaurant": "Ce restaurant ne prend pas de réservation de table.",
    "This order is not linked to your storefront": "Cette commande ne concerne pas votre boutique.",
    "Transaction code already used": "Cette référence de transaction a déjà été utilisée.",
    "Transfer amount exceeds available balance": "Montant supérieur au solde disponible.",
    "Trip not found": "Trajet introuvable.",
    "Unauthorized order access": "Cette commande n'est pas la vôtre.",
    "Unauthorized receipt access": "Ce reçu n'est pas le vôtre.",
    "User not available": "Compte indisponible.",
    "User not found": "Compte introuvable.",
    "Vendor is inactive": "Cette boutique est hors ligne.",
    "Vendor mismatch for delivery verification": "Ce reçu concerne une autre boutique.",
    "Fichier vide": "Fichier vide.",
}


def to_french(message: str) -> str:
    return FR.get(message, message)
