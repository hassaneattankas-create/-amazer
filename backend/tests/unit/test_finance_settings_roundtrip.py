"""La page admin « Tarifs » renvoie tels quels tous les réglages qu'elle a lus.

Le schéma d'enregistrement refuse les champs inconnus (extra="forbid") : tout champ
ajouté à la réponse doit donc aussi être accepté à l'enregistrement, sinon le bouton
« Enregistrer » échoue à chaque fois (cas réel : formule gratuite, nov. 2026).
"""

from app.schemas.finance import FinanceSettingsResponse, FinanceSettingsUpdateRequest


def test_every_settings_field_can_be_saved_back() -> None:
    missing = set(FinanceSettingsResponse.model_fields) - set(FinanceSettingsUpdateRequest.model_fields)
    assert not missing, f"Champs lus par la page mais refusés à l'enregistrement : {sorted(missing)}"


def test_free_plan_values_are_accepted() -> None:
    base = {
        name: 0
        for name, field in FinanceSettingsUpdateRequest.model_fields.items()
        if field.is_required()
    }
    base["ad_boost_duration_days"] = 7
    payload = FinanceSettingsUpdateRequest(**base, free_plan_max_products=5, free_plan_commission_rate=0.05)
    assert payload.free_plan_max_products == 5
    assert payload.free_plan_commission_rate == 0.05
