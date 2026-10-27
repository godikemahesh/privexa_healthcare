"""Generate synthetic FHIR R4 records and seed each simulated hospital independently.

    python simulator/seed.py            # both hospitals must be running (see scripts/dev.py)

Records are generated deterministically from a per-hospital seed using real terminology codes
(LOINC, SNOMED CT, RxNorm, CVX). Resource IDs are stable, and loading uses PUT inside transaction
Bundles, so rerunning never duplicates data. Every person and record is fictional.

Cross-hospital scenario: "Ananya Krishnan" has visited both hospitals and has a different MRN at each.
A similarly named patient at Sunrise ("Anjali Krishnan", different birth date) is a near-miss that
should not be matched.
"""

import os
import random
import sys
import time
import uuid
from datetime import date, datetime, timedelta, timezone

import httpx

NS = uuid.UUID("6f1c2a7e-8b1d-4c55-9a51-0d6c3f6e9b10")
TODAY = date(2026, 10, 1)

HOSPITALS = [
    {"slug": "metrocare", "name": "MetroCare Medical Center", "url_env": "HOSPITAL_A_FHIR_URL", "url": "http://127.0.0.1:8081/fhir", "seed": 101, "patients": 14, "mrn_prefix": "MC", "city": "Pune"},
    {"slug": "sunrise", "name": "Sunrise General Hospital", "url_env": "HOSPITAL_B_FHIR_URL", "url": "http://127.0.0.1:8082/fhir", "seed": 202, "patients": 14, "mrn_prefix": "SG", "city": "Hyderabad"},
]

GIVEN_F = ["Priya", "Kavya", "Meera", "Sara", "Leela", "Nisha", "Fatima", "Grace", "Divya", "Ritu", "Elena", "Aisha", "Tara", "Neha"]
GIVEN_M = ["Arjun", "Rahul", "Vikram", "Omar", "Daniel", "Rohan", "Kabir", "Samuel", "Ishaan", "Manoj", "Joseph", "Aditya", "Imran", "Karan"]
FAMILY = ["Sharma", "Menon", "Reddy", "Fernandes", "Patel", "Iyer", "Thomas", "Bose", "Khan", "Nair", "Joshi", "Das", "Pillai", "Mehta", "Gupta", "Singh"]
STREETS = ["Lake View Road", "Station Road", "Temple Street", "MG Road", "Park Avenue", "Hill Crest Lane", "Garden Street"]

LOINC = "http://loinc.org"
SNOMED = "http://snomed.info/sct"
RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm"
CVX = "http://hl7.org/fhir/sid/cvx"
UCUM = "http://unitsofmeasure.org"

VITALS = [
    ("8867-4", "Heart rate", "/min", (58, 96), 0),
    ("8480-6", "Systolic blood pressure", "mm[Hg]", (108, 152), 0),
    ("8462-4", "Diastolic blood pressure", "mm[Hg]", (66, 96), 0),
    ("29463-7", "Body weight", "kg", (48, 98), 1),
    ("8310-5", "Body temperature", "Cel", (36.3, 37.4), 1),
]
LABS = {
    "metabolic": ("51990-0", "Basic metabolic panel", [("2339-0", "Glucose", "mg/dL", (78, 160), 0), ("2160-0", "Creatinine", "mg/dL", (0.6, 1.4), 2)]),
    "lipid": ("57698-3", "Lipid panel", [("2093-3", "Total cholesterol", "mg/dL", (150, 260), 0), ("18262-6", "LDL cholesterol", "mg/dL", (70, 180), 0)]),
    "cbc": ("58410-2", "Complete blood count", [("718-7", "Hemoglobin", "g/dL", (10.5, 16.0), 1)]),
    "a1c": ("4548-4", "Hemoglobin A1c", [("4548-4", "Hemoglobin A1c", "%", (5.2, 8.4), 1)]),
}
CONDITIONS = [
    ("59621000", "Essential hypertension", [("314076", "Lisinopril 10 MG Oral Tablet"), ("197361", "Amlodipine 5 MG Oral Tablet")]),
    ("714628002", "Prediabetes", []),
    ("44054006", "Type 2 diabetes mellitus", [("860975", "Metformin hydrochloride 500 MG Oral Tablet")]),
    ("55822004", "Hyperlipidemia", [("617310", "Atorvastatin 20 MG Oral Tablet")]),
    ("195967001", "Asthma", [("745679", "Albuterol 0.09 MG/ACTUAT Metered Dose Inhaler")]),
    ("235595009", "Gastroesophageal reflux disease", [("198053", "Omeprazole 20 MG Delayed Release Oral Capsule")]),
    ("271737000", "Anemia", [("310325", "Ferrous sulfate 325 MG Oral Tablet")]),
    ("239873007", "Osteoarthritis of knee", [("197805", "Ibuprofen 400 MG Oral Tablet")]),
    ("37796009", "Migraine", []),
]
ALLERGIES = [("91936005", "Allergy to penicillin"), ("91935009", "Allergy to peanuts"), ("300916003", "Latex allergy"), ("418689008", "Allergy to grass pollen")]
VACCINES = [("140", "Influenza, seasonal, injectable"), ("113", "Td (adult) preservative free"), ("208", "COVID-19, mRNA, 30 mcg/0.3 mL"), ("08", "Hep B, adolescent or pediatric")]
PROCEDURES = [("29303009", "Electrocardiographic procedure"), ("127783003", "Spirometry"), ("28520004", "Venipuncture for blood test"), ("168731009", "Chest X-ray")]
ENCOUNTER_TYPES = [("185349003", "Encounter for check up", "AMB"), ("185345009", "Encounter for symptom", "AMB"), ("50849002", "Emergency room admission", "EMER"), ("183452005", "Follow-up encounter", "AMB")]


def rid(slug: str, *parts) -> str:
    return str(uuid.uuid5(NS, ":".join([slug, *map(str, parts)])))


def cc(system: str, code: str, display: str) -> dict:
    return {"coding": [{"system": system, "code": code, "display": display}], "text": display}


def iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def value(rng: random.Random, lo_hi: tuple, decimals: int):
    v = rng.uniform(*lo_hi)
    return round(v, decimals) if decimals else int(round(v))


def make_patient(h: dict, i: int, rng: random.Random, used_names: set) -> dict:
    gender = rng.choice(["female", "male"])
    while True:
        given = rng.choice(GIVEN_F if gender == "female" else GIVEN_M)
        family = rng.choice(FAMILY)
        if (given, family) not in used_names:
            used_names.add((given, family))
            break
    birth = date(rng.randint(1948, 1996), rng.randint(1, 12), rng.randint(1, 28))
    pid = rid(h["slug"], "patient", i)
    return {
        "resourceType": "Patient",
        "id": pid,
        "identifier": [
            {
                "type": {"coding": [{"system": "http://terminology.hl7.org/CodeSystem/v2-0203", "code": "MR", "display": "Medical record number"}]},
                "system": f"urn:privexa:demo:{h['slug']}:mrn",
                "value": f"{h['mrn_prefix']}-{100200 + i * 37:06d}",
            }
        ],
        "active": True,
        "name": [{"use": "official", "family": family, "given": [given]}],
        "telecom": [{"system": "phone", "value": f"555-{rng.randint(200, 899):03d}-{rng.randint(1000, 9999):04d}", "use": "mobile"}],
        "gender": gender,
        "birthDate": birth.isoformat(),
        "address": [{"line": [f"{rng.randint(1, 240)} {rng.choice(STREETS)}"], "city": h["city"], "postalCode": f"{rng.randint(400001, 500099)}", "country": "IN"}],
    }


def clinical_history(h: dict, i: int, patient: dict, rng: random.Random) -> list[dict]:
    slug, pid = h["slug"], patient["id"]
    subj = {"reference": f"Patient/{pid}"}
    out: list[dict] = []
    conds = rng.sample(CONDITIONS, rng.randint(1, 3))
    first = datetime(TODAY.year - 4, 1, 1, tzinfo=timezone.utc)
    for ci, (code, display, meds) in enumerate(conds):
        onset = first + timedelta(days=rng.randint(0, 900))
        cid = rid(slug, "condition", i, ci)
        out.append({
            "resourceType": "Condition", "id": cid,
            "clinicalStatus": cc("http://terminology.hl7.org/CodeSystem/condition-clinical", "active", "Active"),
            "verificationStatus": cc("http://terminology.hl7.org/CodeSystem/condition-ver-status", "confirmed", "Confirmed"),
            "category": [cc("http://terminology.hl7.org/CodeSystem/condition-category", "encounter-diagnosis", "Encounter Diagnosis")],
            "code": cc(SNOMED, code, display), "subject": subj, "onsetDateTime": iso(onset), "recordedDate": iso(onset),
        })
        for mi, (rx, mname) in enumerate(meds):
            out.append({
                "resourceType": "MedicationRequest", "id": rid(slug, "med", i, ci, mi), "status": rng.choice(["active", "active", "completed"]),
                "intent": "order", "medicationCodeableConcept": cc(RXNORM, rx, mname), "subject": subj, "authoredOn": iso(onset + timedelta(days=1)),
                "reasonReference": [{"reference": f"Condition/{cid}"}],
                "dosageInstruction": [{"text": "As directed"}],
            })
    if rng.random() < 0.55:
        code, display = rng.choice(ALLERGIES)
        out.append({
            "resourceType": "AllergyIntolerance", "id": rid(slug, "allergy", i),
            "clinicalStatus": cc("http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", "active", "Active"),
            "code": cc(SNOMED, code, display), "patient": subj, "recordedDate": iso(first + timedelta(days=rng.randint(0, 400))),
        })
    n_enc = rng.randint(3, 7)
    dates = sorted(first + timedelta(days=rng.randint(30, (TODAY - first.date()).days)) for _ in range(n_enc))
    for e, when in enumerate(dates):
        when = when.replace(hour=rng.randint(8, 17), minute=rng.choice([0, 15, 30, 45]))
        tcode, tdisp, cls = rng.choice(ENCOUNTER_TYPES)
        eid = rid(slug, "encounter", i, e)
        out.append({
            "resourceType": "Encounter", "id": eid, "status": "finished",
            "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": cls},
            "type": [cc(SNOMED, tcode, tdisp)], "subject": subj,
            "period": {"start": iso(when), "end": iso(when + timedelta(minutes=rng.choice([20, 30, 45, 90])))},
        })
        enc = {"reference": f"Encounter/{eid}"}
        for v, (code, display, unit, rng_vals, dec) in enumerate(VITALS):
            out.append({
                "resourceType": "Observation", "id": rid(slug, "vital", i, e, v), "status": "final",
                "category": [cc("http://terminology.hl7.org/CodeSystem/observation-category", "vital-signs", "Vital signs")],
                "code": cc(LOINC, code, display), "subject": subj, "encounter": enc, "effectiveDateTime": iso(when),
                "valueQuantity": {"value": value(rng, rng_vals, dec), "unit": unit, "system": UCUM, "code": unit},
            })
        if rng.random() < 0.6:
            key = rng.choice(list(LABS))
            pcode, pname, comps = LABS[key]
            result_refs = []
            for li, (code, display, unit, rng_vals, dec) in enumerate(comps):
                oid = rid(slug, "lab", i, e, li)
                result_refs.append({"reference": f"Observation/{oid}"})
                out.append({
                    "resourceType": "Observation", "id": oid, "status": "final",
                    "category": [cc("http://terminology.hl7.org/CodeSystem/observation-category", "laboratory", "Laboratory")],
                    "code": cc(LOINC, code, display), "subject": subj, "encounter": enc, "effectiveDateTime": iso(when + timedelta(hours=2)),
                    "valueQuantity": {"value": value(rng, rng_vals, dec), "unit": unit, "system": UCUM, "code": unit},
                })
            out.append({
                "resourceType": "DiagnosticReport", "id": rid(slug, "report", i, e), "status": "final",
                "category": [cc("http://terminology.hl7.org/CodeSystem/v2-0074", "LAB", "Laboratory")],
                "code": cc(LOINC, pcode, pname), "subject": subj, "encounter": enc, "effectiveDateTime": iso(when + timedelta(hours=2)),
                "issued": iso(when + timedelta(hours=6)), "result": result_refs,
            })
        if rng.random() < 0.3:
            code, display = rng.choice(PROCEDURES)
            out.append({"resourceType": "Procedure", "id": rid(slug, "procedure", i, e), "status": "completed", "code": cc(SNOMED, code, display), "subject": subj, "encounter": enc, "performedDateTime": iso(when + timedelta(minutes=10))})
        if e == n_enc - 1 or rng.random() < 0.25:
            code, display = rng.choice(VACCINES)
            out.append({"resourceType": "Immunization", "id": rid(slug, "immunization", i, e), "status": "completed", "vaccineCode": cc(CVX, code, display), "patient": subj, "encounter": enc, "occurrenceDateTime": iso(when)})
    return out


def apply_scenario(a_patient: dict, b_patient: dict, near_miss: dict) -> None:
    a_patient.update(gender="female", birthDate="1981-06-17")
    a_patient["name"] = [{"use": "official", "family": "Krishnan", "given": ["Ananya"]}]
    a_patient["telecom"] = [{"system": "phone", "value": "555-201-0142", "use": "mobile"}]
    a_patient["address"] = [{"line": ["12 Lake View Road"], "city": "Pune", "postalCode": "411001", "country": "IN"}]

    b_patient.update(gender="female", birthDate="1981-06-17")
    b_patient["name"] = [{"use": "official", "family": "Krishnan", "given": ["Ananya", "S."]}]
    b_patient["telecom"] = [{"system": "phone", "value": "(555) 201-0142", "use": "home"}]
    b_patient["address"] = [{"line": ["Flat 4B, Banjara Residency"], "city": "Hyderabad", "postalCode": "500034", "country": "IN"}]

    near_miss.update(gender="female", birthDate="1988-02-11")
    near_miss["name"] = [{"use": "official", "family": "Krishnan", "given": ["Anjali"]}]
    near_miss["telecom"] = [{"system": "phone", "value": "555-433-7731", "use": "mobile"}]


def build(h: dict) -> list[tuple[dict, list[dict]]]:
    rng = random.Random(h["seed"])
    used: set = set()
    out = []
    for i in range(h["patients"]):
        p = make_patient(h, i, rng, used)
        out.append((p, clinical_history(h, i, p, rng)))
    return out


def wait_for(url: str, name: str) -> None:
    for _ in range(30):
        try:
            if httpx.get(f"{url}/metadata", timeout=3).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(1)
    raise SystemExit(f"{name} is not reachable at {url}. Start the simulators first: python scripts/dev.py")


def load(url: str, resources: list[dict]) -> None:
    with httpx.Client(timeout=60) as client:
        for k in range(0, len(resources), 300):
            chunk = resources[k : k + 300]
            bundle = {"resourceType": "Bundle", "type": "transaction", "entry": [{"resource": r, "request": {"method": "PUT", "url": f"{r['resourceType']}/{r['id']}"}} for r in chunk]}
            r = client.post(url, json=bundle, headers={"Content-Type": "application/fhir+json"})
            if r.status_code != 200 or r.json().get("type") != "transaction-response":
                raise SystemExit(f"Load failed: HTTP {r.status_code} {r.text[:300]}")


def main() -> None:
    data = {h["slug"]: build(h) for h in HOSPITALS}
    apply_scenario(data["metrocare"][0][0], data["sunrise"][0][0], data["sunrise"][1][0])
    for h in HOSPITALS:
        url = os.environ.get(h["url_env"], h["url"])
        wait_for(url, h["name"])
        resources = [r for p, hist in data[h["slug"]] for r in [p, *hist]]
        load(url, resources)
        total = httpx.get(f"{url}/Patient", params={"_summary": "count"}).json()["total"]
        print(f"[seed] {h['name']}: {len(data[h['slug']])} synthetic patients, {len(resources)} resources loaded (server reports {total} patients)")
    print("[seed] Scenario patient: Ananya Krishnan (MetroCare MRN MC-100200, Sunrise MRN SG-100200). All data is synthetic.")


if __name__ == "__main__":
    sys.exit(main())
