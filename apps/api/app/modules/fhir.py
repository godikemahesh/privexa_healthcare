"""FHIR R4 structural validation and normalization into a source-attributed timeline."""

from typing import Any

SUPPORTED_RESOURCE_TYPES = [
    "Patient",
    "Encounter",
    "Observation",
    "Condition",
    "MedicationRequest",
    "AllergyIntolerance",
    "Immunization",
    "Procedure",
    "DiagnosticReport",
]
CLINICAL_RESOURCE_TYPES = [r for r in SUPPORTED_RESOURCE_TYPES if r != "Patient"]

# Search parameter that links each clinical resource to its patient.
PATIENT_PARAM = {
    "Encounter": "patient",
    "Observation": "patient",
    "Condition": "patient",
    "MedicationRequest": "patient",
    "AllergyIntolerance": "patient",
    "Immunization": "patient",
    "Procedure": "patient",
    "DiagnosticReport": "patient",
}

_STATUS = {
    "Observation": {"registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"},
    "Encounter": {"planned", "arrived", "triaged", "in-progress", "onleave", "finished", "cancelled", "entered-in-error", "unknown"},
    "MedicationRequest": {"active", "on-hold", "cancelled", "completed", "entered-in-error", "stopped", "draft", "unknown"},
    "Immunization": {"completed", "entered-in-error", "not-done"},
    "Procedure": {"preparation", "in-progress", "not-done", "on-hold", "stopped", "completed", "entered-in-error", "unknown"},
    "DiagnosticReport": {"registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "entered-in-error", "unknown"},
}

_SUBJECT_FIELD = {"AllergyIntolerance": "patient", "Immunization": "patient"}


def _has_codeable(v: Any) -> bool:
    return isinstance(v, dict) and (bool(v.get("text")) or (isinstance(v.get("coding"), list) and len(v["coding"]) > 0))


def validate_resource(res: Any, expected_type: str | None = None) -> list[str]:
    """Return a list of structural problems (empty when valid). Checks the R4 elements Privexa relies on."""
    if not isinstance(res, dict):
        return ["resource is not a JSON object"]
    errors: list[str] = []
    rt = res.get("resourceType")
    if not isinstance(rt, str):
        return ["missing resourceType"]
    if expected_type and rt != expected_type:
        errors.append(f"expected {expected_type}, got {rt}")
    if not isinstance(res.get("id"), str) or not res.get("id"):
        errors.append("missing id")
    if rt in _STATUS:
        if res.get("status") not in _STATUS[rt]:
            errors.append("missing or invalid status")
    if rt != "Patient":
        field = _SUBJECT_FIELD.get(rt, "subject")
        ref = res.get(field)
        if not (isinstance(ref, dict) and isinstance(ref.get("reference"), str)):
            errors.append(f"missing {field}.reference")
    if rt in ("Observation", "Condition", "DiagnosticReport", "Procedure") and not _has_codeable(res.get("code")):
        errors.append("missing code")
    if rt == "Encounter" and not isinstance(res.get("class"), dict):
        errors.append("missing class")
    if rt == "MedicationRequest":
        if res.get("intent") is None:
            errors.append("missing intent")
        if not (_has_codeable(res.get("medicationCodeableConcept")) or isinstance(res.get("medicationReference"), dict)):
            errors.append("missing medication")
    if rt == "Immunization" and not _has_codeable(res.get("vaccineCode")):
        errors.append("missing vaccineCode")
    if rt == "Patient":
        if res.get("birthDate") is not None and not isinstance(res.get("birthDate"), str):
            errors.append("invalid birthDate")
    return errors


def validate_bundle(bundle: Any) -> list[str]:
    if not isinstance(bundle, dict) or bundle.get("resourceType") != "Bundle":
        return ["response is not a FHIR Bundle"]
    if "entry" in bundle and not isinstance(bundle["entry"], list):
        return ["Bundle.entry is not a list"]
    return []


def bundle_resources(bundle: dict) -> list[Any]:
    return [e.get("resource") for e in bundle.get("entry", []) or [] if isinstance(e, dict)]


def _text(cc: Any) -> str | None:
    if not isinstance(cc, dict):
        return None
    if cc.get("text"):
        return str(cc["text"])
    for c in cc.get("coding") or []:
        if isinstance(c, dict) and c.get("display"):
            return str(c["display"])
    return None


def resource_date(res: dict) -> str | None:
    for key in ("effectiveDateTime", "onsetDateTime", "authoredOn", "occurrenceDateTime", "performedDateTime", "recordedDate", "issued"):
        if isinstance(res.get(key), str):
            return res[key]
    for key in ("period", "effectivePeriod", "performedPeriod"):
        if isinstance(res.get(key), dict) and isinstance(res[key].get("start"), str):
            return res[key]["start"]
    return None


def summarize(res: dict) -> tuple[str, str | None]:
    """Human-readable title and detail for a resource."""
    rt = res.get("resourceType")
    if rt == "Observation":
        title = _text(res.get("code")) or "Observation"
        vq = res.get("valueQuantity")
        if isinstance(vq, dict) and vq.get("value") is not None:
            v = vq["value"]
            v = round(v, 2) if isinstance(v, float) else v
            return title, f"{v} {vq.get('unit') or ''}".strip()
        if res.get("valueCodeableConcept"):
            return title, _text(res["valueCodeableConcept"])
        comps = res.get("component") or []
        parts = []
        for c in comps[:3]:
            q = c.get("valueQuantity") or {}
            if q.get("value") is not None:
                parts.append(f"{_text(c.get('code')) or ''}: {round(q['value'], 1)} {q.get('unit') or ''}".strip())
        return title, "; ".join(parts) or None
    if rt == "Encounter":
        types = res.get("type") or []
        title = (_text(types[0]) if types else None) or "Encounter"
        cls = (res.get("class") or {}).get("code")
        return title, f"{cls} · {res.get('status')}" if cls else res.get("status")
    if rt == "Condition":
        status = _text(res.get("clinicalStatus"))
        return _text(res.get("code")) or "Condition", status
    if rt == "MedicationRequest":
        return _text(res.get("medicationCodeableConcept")) or "Medication", res.get("status")
    if rt == "AllergyIntolerance":
        return _text(res.get("code")) or "Allergy", _text(res.get("clinicalStatus"))
    if rt == "Immunization":
        return _text(res.get("vaccineCode")) or "Immunization", res.get("status")
    if rt == "Procedure":
        return _text(res.get("code")) or "Procedure", res.get("status")
    if rt == "DiagnosticReport":
        return _text(res.get("code")) or "Diagnostic report", res.get("status")
    return str(rt), None


def patient_summary(res: dict) -> dict:
    names = res.get("name") or [{}]
    n = names[0] if isinstance(names[0], dict) else {}
    given = " ".join(n.get("given") or [])
    full = f"{given} {n.get('family') or ''}".strip() or "Unknown"
    mrn = None
    for ident in res.get("identifier") or []:
        codings = ((ident.get("type") or {}).get("coding")) or []
        if any(c.get("code") == "MR" for c in codings) or "mrn" in str(ident.get("system", "")).lower():
            mrn = ident.get("value")
            break
    phone = next((t.get("value") for t in res.get("telecom") or [] if t.get("system") == "phone"), None)
    addr = (res.get("address") or [{}])[0]
    return {
        "patient_id": res.get("id"),
        "mrn": mrn,
        "name": full,
        "given": given,
        "family": n.get("family"),
        "birth_date": res.get("birthDate"),
        "gender": res.get("gender"),
        "city": addr.get("city") if isinstance(addr, dict) else None,
        "postal_code": addr.get("postalCode") if isinstance(addr, dict) else None,
        "phone": phone,
    }
