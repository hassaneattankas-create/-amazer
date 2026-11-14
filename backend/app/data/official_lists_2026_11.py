"""Liste officielle des pharmacies de garde de Niamey du 14/11 au 21/11/2026 (recopiée de l'affiche), insérée une seule fois.

Les suivantes se publient depuis Admin > Gardes : photo de l'affiche (lue automatiquement) ou liste collée.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

NIAMEY = timezone(timedelta(hours=1))

# Affiche MS/HP (Ministère de la Santé et de l'Hygiène Publique), diffusée par Lahiyata. Colonnes : commune, pharmacie, localisation, téléphone.
_ROWS = {
    "Commune I": [
        ("7 Thérapies", "Koubia, face du garage L'Avenir", "20 73 68 58"),
        ("Amina", "Recasement, à côté du rond-point Pneu", "80 94 99 09"),
        ("Château I", "Plateau, à côté de Baklini", "20 72 27 77"),
        ("Des Camps", "Face au camp de la Garde nationale", "20 75 53 00"),
        ("Diaspora", "Quartier Diaspora, à côté du château R17", "99 36 83 83"),
        ("Fassa", "À côté de la station Petroba", "91 74 12 71"),
        ("Gaptchi", "Sur le goudron de Bedir, en face de la station Ola", "90 09 66 56"),
        ("Gobi", "Koira Kano, en face du CEG 14", "80 06 31 26"),
        ("Goroual", "Bobiel, devant la Fenifoot", "96 33 71 76"),
        ("Karma", "Référence, face au château vert R14", "97 36 33 08"),
        ("Niamey Nyala", "Ryad, pas loin de la plaque Avocat", "88 01 05 07"),
        ("Plateau 2", "En face de l'hôpital nigéro-turc", "80 06 54 15"),
        ("Référence", "Non loin de l'hôpital de Référence", "20 35 22 64"),
        ("Route Zarmaganda", "Quartier Tchangarey, station Oriba", "93 80 01 25"),
        ("Santé Plus", "Face au CSI-maternité de Bobiel", "80 06 78 25"),
    ],
    "Commune II": [
        ("As Samad", "Pas loin de l'institut Harisson", "95 84 00 78"),
        ("Askia", "Boukoki, boulevard Kaocen", "21 31 59 04"),
        ("Château Bi", "Kalley Plateau", "91 91 04 29"),
        ("Cité Caisse", "Marché Cité Caisse", "90 19 45 37"),
        ("Mutualisé", "En face des sapeurs-pompiers de Lazaret", "92 19 13 96"),
        ("Sabo", "Face à la grande mosquée, Ferraille", "91 24 97 96"),
    ],
    "Commune III": [
        ("Any Koira", "Face à l'assurance Leyma, bâtiment Any Koira", "20 73 50 83"),
        ("Bonkaney", "Pas loin de STM siège", "20 36 36 70"),
        ("Cité Fayçal", "Cité Fayçal, à côté du rond-point Waziri", "89 14 88 55"),
        ("Dan Gao", "À côté de la pâtisserie Marhaba", "20 74 03 36"),
        ("Grand Marché", "À côté de Niamey Store", "75 03 98 25"),
        ("Grande Mosquée", "Kalley Est, face à Al Izza siège", "88 88 30 88"),
        ("Kawsar", "Cité Députés, face à l'école Koirey", "99 12 49 99"),
        ("Le Remède", "Banifandou 2, rond-point Kokorba 1", "80 06 53 51"),
        ("Nassara", "Poudrière, à côté de l'Institut africain de management", "76 27 28 17"),
        ("Nour", "À côté de la station Tilba", "80 07 27 66"),
    ],
    "Commune IV": [
        ("Afzal", "Avenue des Armées, sur le pavé de Gamkalley", "87 87 57 87"),
        ("Air", "Wadata, rond-point Police secours", "20 74 01 29"),
        ("Ar Rahma", "Niamey 2000, face au CSP Assifa", "91 01 01 84"),
        ("Bassora", "En face de Talladjé Tourakou", "90 45 44 46"),
        ("CEG 13 Talladjé", "Talladjé, non loin du rond-point Escadrille", "92 43 64 41"),
        ("Cité Bakabé", "Aéroport, non loin du commissariat", "96 62 03 69"),
        ("Renouveau", "Niamey 2000, face à la station Total", "80 06 31 27"),
        ("Route Dosso", "Aéroport, sur la route de Dosso avant Bienvenue", "89 74 49 32"),
        ("Shifaa", "Recasement Talladjé, garage 2 Chevaux", "81 77 42 52"),
    ],
    "Commune V": [
        ("Amana Gaweye", "En face de la maternité de Gaweye", "91 26 87 18"),
        ("Harobanda", "Route de Say, face à la station BM Trading", "91 26 87 19"),
        ("Lamordé", "Derrière l'ex-CHU de Lamordé", "92 19 80 95"),
        ("Route Torodi", "Collée à la Banque Atlantique, Harobanda", "20 31 79 07"),
    ],
}

PHARMACY_DUTY = {
    "kind": "pharmacy_duty",
    "city": "Niamey",
    "title": "Pharmacies de garde · Niamey · du 14/11 au 21/11/2026",
    "source": "MS/HP (Ministère de la Santé et de l'Hygiène Publique), affiche diffusée par Lahiyata",
    "starts_at": datetime(2026, 11, 14, 8, 0, tzinfo=NIAMEY),
    "ends_at": datetime(2026, 11, 21, 8, 0, tzinfo=NIAMEY),
    "entries": [(commune, name, None, location, phone) for commune, rows in _ROWS.items() for name, location, phone in rows],
}

LISTS = [PHARMACY_DUTY]
