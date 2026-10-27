from app.modules.fhir import patient_summary, summarize, validate_bundle, validate_resource
from app.modules.patients import confidence, score_pair


def test_valid_observation_passes():
    obs = {"resourceType": "Observation", "id": "o1", "status": "final", "code": {"text": "Heart rate"}, "subject": {"reference": "Patient/p1"}}
    assert validate_resource(obs, "Observation") == []


def test_malformed_observation_is_rejected_with_reasons():
    errs = validate_resource({"resourceType": "Observation", "status": "???"}, "Observation")
    assert "missing id" in errs
    assert "missing or invalid status" in errs
    assert "missing subject.reference" in errs
    assert "missing code" in errs


def test_wrong_type_and_non_object():
    assert "expected Observation, got Patient" in validate_resource({"resourceType": "Patient", "id": "x"}, "Observation")
    assert validate_resource("nope") == ["resource is not a JSON object"]


def test_bundle_validation():
    assert validate_bundle({"resourceType": "Bundle", "entry": []}) == []
    assert validate_bundle({"resourceType": "OperationOutcome"}) == ["response is not a FHIR Bundle"]
    assert validate_bundle({"resourceType": "Bundle", "entry": "x"}) == ["Bundle.entry is not a list"]


def test_summaries():
    t, d = summarize({"resourceType": "Observation", "code": {"text": "Weight"}, "valueQuantity": {"value": 68.234, "unit": "kg"}})
    assert (t, d) == ("Weight", "68.23 kg")
    t, _ = summarize({"resourceType": "MedicationRequest", "medicationCodeableConcept": {"coding": [{"display": "Metformin"}]}, "status": "active"})
    assert t == "Metformin"


def test_patient_summary_extracts_mrn():
    s = patient_summary({"resourceType": "Patient", "id": "p", "identifier": [{"type": {"coding": [{"code": "MR"}]}, "value": "MC-1"}], "name": [{"family": "Okafor", "given": ["Amara"]}]})
    assert s["mrn"] == "MC-1" and s["name"] == "Amara Okafor"


def _rec(**kw):
    base = {"given": "Amara", "family": "Okafor", "birth_date": "1975-03-14", "gender": "female", "phone": "555-201-0142", "postal_code": "01101", "mrn": "MC-1"}
    return {**base, **kw}


def test_same_person_with_different_mrns_scores_high():
    score, ex = score_pair(_rec(), _rec(given="Amara N.", phone="(555) 201-0142", mrn="SG-9"))
    assert score >= 0.8 and confidence(score) == "high"
    assert any(e["field"].startswith("Local identifier") and e["weight"] == 0 for e in ex)


def test_near_miss_scores_lower():
    score, _ = score_pair(_rec(), _rec(given="Amaka", birth_date="1982-03-14", phone="555-201-7731"))
    assert score < 0.55


def test_weights_sum_to_one_for_perfect_match():
    score, _ = score_pair(_rec(), _rec())
    assert score == 1.0
