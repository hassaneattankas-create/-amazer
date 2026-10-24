"""Listes officielles recues le 24/10/2026 (recopiees des affiches), inserees une seule fois au demarrage.

Les suivantes se publient depuis Admin > Gardes et approvisionnements (coller la liste), sans code.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

NIAMEY = timezone(timedelta(hours=1))

# Comite de garde (ANRP, CNOP, MS/HP, SYNPHANI) — Niamey, groupe n°2. Colonnes : CVN, pharmacie, quartier, localisation, contact.
PHARMACY_DUTY = {
    "kind": "pharmacy_duty",
    "city": "Niamey",
    "title": "Pharmacies de garde · Niamey · Groupe n°2",
    "source": "Comité de garde (ANRP, CNOP, MS/HP, SYNPHANI)",
    "starts_at": datetime(2026, 10, 24, 8, 0, tzinfo=NIAMEY),
    "ends_at": datetime(2026, 10, 31, 8, 0, tzinfo=NIAMEY),
    "entries": [
        ("1", "Issa-Beri", "Plateau", "En face CEG 5 Franco-Arabe", "20 74 28 98"),
        ("1", "Salbaz", "Tchangarey", "Tchangarey, non loin de chez Halirou Bokoye", "92 70 30 00"),
        ("1", "Route Ouallam", "Koira Tegui", "Face grande porte Gendarmerie", "88 88 48 88"),
        ("1", "Francophonie", "Francophonie", "À côté de la grande porte du Village de la Francophonie", "20 32 20 30"),
        ("1", "Sabara Bangou", "Cité SATU", "Non loin de GMA", "98 02 17 92"),
        ("1", "Saye", "Goudel", "Zone des ambassades", "20 35 22 64"),
        ("1", "Marhaba", "Koubia", "Entre le commissariat et la station Morey", "77 30 42 70"),
        ("1", "CEG 25 Riyad", "Riyad", "Face CEG 25, entre l'Alimentation Riyad et le rond-point Oriba", "80 68 68 11"),
        ("1", "Rond-Point", "Plateau", "À côté de la NIGELEC siège", "20 73 42 83"),
        ("1", "Choukr-Allah", "Bobiel", "Latérite Fenifoot, face station Tamesna", "90 02 04 80"),
        ("1", "Sira", "Koira Kano Nord", "En face de la station Noma", "82 18 32 14"),
        ("1", "Bobiel", "Bobiel", "Pas loin de la boulangerie Bobiel", "80 05 97 89"),
        ("1", "Cité Chinoise", "Cité Chinoise", "Non loin de l'OPVN", "80 07 53 77"),
        ("1", "Recasement", "Recasement", "Sur la 1re latérite, face à la station Oriba", "20 35 03 88"),
        ("1", "Avenir", "Plateau", "Sur l'avenue Maurice Delens, à côté de Chic-Store", "20 75 38 69"),
        ("1", "Moaga Losso", "Lossogoungou", "Non loin du CEG Lossogoungou Seyni Alzou", "92 19 80 96"),
        ("1", "Ridwane", "Yantala", "Habou Tagui Yantala", "88 53 83 41"),
        ("1", "Centre Aéré BCEAO", "Bobiel", "Non loin du centre BCEAO", "80 06 61 58"),
        ("2", "3 Août", "Plateau", "Non loin de l'échangeur Mali Béro", "20 35 18 18"),
        ("2", "Lazaret", "Lazaret", "Non loin de Bab Salam", "90 58 37 76"),
        ("2", "Deyzeibon", "Deyzeibon", "À côté du CSI Deyzeibon", "20 73 67 90"),
        ("2", "Arewa", "Boukoki", "Pas loin de la station Olibya", "20 73 35 05"),
        ("2", "Tourakou", "Tourakou", "À côté de Zeyna Transfert", "80 08 54 51"),
        ("2", "Kalley 100 m", "Banizoumbou", "En face de la station Bazagor, voie de 100 m, Six Porte", "96 24 25 04"),
        ("3", "Lawanerame", "Boukoki", "Mairie Garage, pas loin du siège de Nita Transfert", "98 48 92 20"),
        ("3", "Zana", "Banifandou", "Non loin du rond-point Salou Djibo", "91 14 58 37"),
        ("3", "Cité BCEAO", "Banifandou", "Marché Albarka", "21 88 79 68"),
        ("3", "Arènes", "Poudrière", "Non loin de la maternité Poudrière", "93 22 64 64"),
        ("3", "Temple", "Kalley Sud", "À côté de la TV Dounia", "20 73 61 82"),
        ("3", "Carrefour 6e", "Nouveau Marché", "Non loin du rond-point 6e", "20 74 18 18"),
        ("3", "Dom", "Kalley Nord", "À côté de la station Total Kalley Nord", "80 07 66 91"),
        ("3", "El Nasr", "Kombo", "Dans l'immeuble El Nasr", "89 11 74 00"),
        ("4", "Poste", "Niamey 2000", "Rond-point station Oilibya « ex Telwa »", "80 06 79 43"),
        ("4", "Escadrille", "Talladjé", "Face à la NIGELEC Talladjé", "92 80 76 23"),
        ("4", "Renouveau", "Niamey 2000", "Face à la station Total", "80 06 31 27"),
        ("4", "Ar Rahma", "Niamey 2000", "Face au CSP Assifa", "91 01 01 84"),
        ("4", "Tadjeje", "Aéroport", "À côté de l'Alimentation Générale, route Tchanga", "80 07 53 93"),
        ("4", "Aéroport", "Aéroport", "Derrière le CSI Aéroport", "90 19 45 35"),
        ("5", "Harobanda", "Harobanda", "Sur la route de Say, face à la station BM Trading", "91 26 87 19"),
        ("5", "Amana Gaweye", "Gaweye", "En face de la maternité Gaweye", "91 26 87 18"),
        ("5", "Route Torodi", "Harobanda", "Collé à la Banque Atlantique Harobanda", "20 31 79 07"),
        ("5", "Lamordé", "Lamordé", "Derrière l'ex-CHU Lamordé", "92 19 80 95"),
    ],
}

# Communique Oriba Petrolium : disponibilite de l'essence, samedi 24 octobre 2026 (56 stations approvisionnees).
ORIBA_FUEL = {
    "kind": "fuel_supply",
    "city": "Niamey",
    "brand": "Oriba Petrolium",
    "fuel": "super",
    "title": "Essence disponible · stations Oriba",
    "source": "Communiqué Oriba Petrolium du samedi 24 octobre 2026",
    "contact_phone": "92 18 30 20",
    "contact_address": "Croisement de l'avenue Mali Béro et Maurice Delens",
    "starts_at": datetime(2026, 10, 24, 0, 0, tzinfo=NIAMEY),
    "ends_at": datetime(2026, 10, 25, 0, 0, tzinfo=NIAMEY),
    "entries": [
        (None, name, None, note, None)
        for name, note in (
            ("2 Chevaux-Garage", None), ("2e Pont", None), ("Aéroport 1", None), ("Aéroport 2", None),
            ("Banifandou 1", None), ("Banifandou 2", None), ("Banifandou 3", None), ("Banifandou 4", None),
            ("Bédir 2", None), ("Bobiel 1", None), ("Bobiel 2", None), ("Bonkaney 1", None),
            ("Bonkaney 2", "Ex-Arewa"), ("Boukoki 1", None),
            ("CCOG", None), ("Centre Aéré", None), ("Cité Chinoise", None), ("Dan Gao", None),
            ("Dar Es Salam Pavé", None), ("Direction", None), ("Ex-Azawad", "Mairie-Garage"), ("Ex-Kalarou", "Face parc turc"),
            ("Fameye", None), ("Fenifoot", None), ("Francophonie", None), ("Goudel", None),
            ("Idé Gano 2", None), ("Jangorzo", None),
            ("Kirkissoye", None), ("Koira Kano 1", None), ("Koira Kano 2", None), ("Koira Kano 4", None),
            ("Lazaret", None), ("Lossogoungou", None), ("Maison Économique", None), ("Mali Béro 1", None),
            ("Plateau", None), ("Police Secours", None), ("Recasement", None), ("Rive Droite", None),
            ("Route Namaro", None), ("Route Ouallam 1", None),
            ("Route Ouallam 2", None), ("Route Say", None), ("Route Tillabéri", None), ("Route Torodi", None),
            ("RTV Siège", None), ("Saga 2", None), ("Saguia", None), ("Sapeurs-Pompiers", None),
            ("Sorey", None), ("SOS", None), ("Tchangarey 1", None), ("Tchangarey 2", None),
            ("Wadata", None), ("Zabarkan", None),
        )
    ],
}

LISTS = (PHARMACY_DUTY, ORIBA_FUEL)
