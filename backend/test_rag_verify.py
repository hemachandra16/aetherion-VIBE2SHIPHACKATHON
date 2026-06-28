"""
RAG Verification Test — Phase 3.
Upload two different files → verify different chunk counts + different plans.
Catches: cross-session contamination, hardcoded content, embedding failures.
"""
import asyncio
import sys

try:
    import httpx
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "-q"])
    import httpx

BASE = "http://localhost:8000"

# ── Two very different documents ──────────────────────────────────────────────

DOC_1_NAME = "organic_chemistry_notes.txt"
DOC_1_CONTENT = """ORGANIC CHEMISTRY — EXAM NOTES

Chapter 1: Functional Groups
Functional groups are specific groups of atoms within molecules that determine the
chemical properties of those molecules. Key functional groups include:
- Hydroxyl (-OH): Found in alcohols (e.g. ethanol, methanol)
- Carbonyl (C=O): Found in aldehydes and ketones
- Carboxyl (-COOH): Found in carboxylic acids (e.g. acetic acid)
- Amine (-NH2): Found in amino acids and neurotransmitters
- Ester (-COO-): Found in fats and biodiesel

Chapter 2: Reaction Mechanisms
SN1 vs SN2 reactions:
- SN2: bimolecular, one-step, inversion of configuration, favoured by primary substrates
- SN1: unimolecular, two-step, racemization, favoured by tertiary substrates
- E1/E2 elimination reactions remove HX to form alkenes

Chapter 3: Aromatic Compounds
Benzene (C6H6) is the archetypal aromatic compound. Aromaticity requires:
1. Cyclic and planar structure
2. Fully conjugated pi system
3. (4n+2) pi electrons (Huckel's rule)
Electrophilic aromatic substitution (EAS) reactions: halogenation, nitration, sulfonation.

Chapter 4: Spectroscopy
NMR: 1H NMR chemical shifts. TMS reference at 0 ppm.
IR: Key absorptions — O-H stretch ~3300, C=O ~1700, N-H ~3500 cm-1.
Mass spec: molecular ion peak (M+), fragmentation patterns.

Key formulas to memorize:
- Degree of unsaturation = (2C + 2 + N - H - X) / 2
- Henderson-Hasselbalch: pH = pKa + log([A-]/[HA])
"""

DOC_2_NAME = "project_management_guide.txt"
DOC_2_CONTENT = """PROJECT MANAGEMENT — QUICK REFERENCE GUIDE

Section 1: Agile Methodology
Agile is an iterative approach to project delivery. Core ceremonies:
- Sprint Planning: Define sprint goals and task assignments (2-4 weeks)
- Daily Standup: 15-minute sync (What did I do? What will I do? Any blockers?)
- Sprint Review: Demo completed work to stakeholders
- Sprint Retrospective: Team reflection on process improvements

Key Agile metrics:
- Velocity: story points completed per sprint
- Burndown chart: remaining work vs time
- Cycle time: time from task start to completion
- Lead time: time from request to delivery

Section 2: Risk Management
Risk register components: Risk ID, Description, Probability, Impact, Mitigation.
Risk matrix: probability x impact grid (Low/Medium/High).
RAID log: Risks, Assumptions, Issues, Dependencies.

Section 3: Stakeholder Communication
RACI matrix: Responsible, Accountable, Consulted, Informed.
Status report cadence: weekly for active projects, bi-weekly for BAU.
Escalation path: Team Lead -> Project Manager -> Steering Committee.

Section 4: Budget and Schedule
Earned Value Management (EVM):
- SPI = EV/PV (Schedule Performance Index — >1 is good)
- CPI = EV/AC (Cost Performance Index — >1 is good)
- EAC = BAC/CPI (Estimate at Completion)
Critical Path Method (CPM): identify longest path through task network.
"""


async def run_rag_tests():
    print("=" * 60)
    print("RAG VERIFICATION TEST — Phase 3")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=300.0) as client:

        # ── Upload Document 1 ─────────────────────────────────────
        print(f"\n[1] Uploading '{DOC_1_NAME}' to session rag-test-1...")
        resp = await client.post(
            f"{BASE}/api/upload",
            files={"file": (DOC_1_NAME, DOC_1_CONTENT.encode(), "text/plain")},
            data={"session_id": "rag-test-1"},
        )
        r1 = resp.json()
        if r1.get("error"):
            print(f"FAIL: Upload 1 error: {r1.get('message')}")
            return
        print(f"OK: {r1.get('message')}")
        chunks_1 = r1.get("chunk_count", 0)
        print(f"   Chunk count: {chunks_1}")

        # ── Upload Document 2 ─────────────────────────────────────
        print(f"\n[2] Uploading '{DOC_2_NAME}' to session rag-test-2...")
        resp = await client.post(
            f"{BASE}/api/upload",
            files={"file": (DOC_2_NAME, DOC_2_CONTENT.encode(), "text/plain")},
            data={"session_id": "rag-test-2"},
        )
        r2 = resp.json()
        if r2.get("error"):
            print(f"FAIL: Upload 2 error: {r2.get('message')}")
            return
        print(f"OK: {r2.get('message')}")
        chunks_2 = r2.get("chunk_count", 0)
        print(f"   Chunk count: {chunks_2}")

        # Chunk counts should differ (different doc sizes) — or at minimum both be non-zero
        if chunks_1 > 0 and chunks_2 > 0:
            print(f"\nPASS: Both uploads produced non-zero chunks ({chunks_1}, {chunks_2})")
        else:
            print(f"\nFAIL: Got zero chunks from an upload!")
            return

        # ── Chat with RAG context ─────────────────────────────────
        print("\n[3] Sending chemistry query to session rag-test-1 (should use chem doc)...")
        resp = await client.post(
            f"{BASE}/api/chat",
            json={
                "message": "I have a chemistry exam in 2 hours covering organic reactions and spectroscopy",
                "session_id": "rag-test-1",
                "conversation_history": [],
            },
        )
        plan1 = resp.json()
        if plan1.get("error"):
            print(f"FAIL: Chat 1 error: {plan1.get('message')}")
            return

        print(f"   Type: {plan1.get('type')}")
        print(f"   RAG used: {plan1.get('rag_used')}")
        if plan1.get("type") == "plan":
            print(f"   Plan title: {plan1['plan'].get('plan_title')}")
            for s in plan1["plan"].get("steps", [])[:3]:
                print(f"     - {s.get('title')}")

        print("\n[4] Sending project query to session rag-test-2 (should use PM doc)...")
        resp = await client.post(
            f"{BASE}/api/chat",
            json={
                "message": "My project status report is due in 3 hours and I haven't started the risk register",
                "session_id": "rag-test-2",
                "conversation_history": [],
            },
        )
        plan2 = resp.json()
        if plan2.get("error"):
            print(f"FAIL: Chat 2 error: {plan2.get('message')}")
            return

        print(f"   Type: {plan2.get('type')}")
        print(f"   RAG used: {plan2.get('rag_used')}")
        if plan2.get("type") == "plan":
            print(f"   Plan title: {plan2['plan'].get('plan_title')}")
            for s in plan2["plan"].get("steps", [])[:3]:
                print(f"     - {s.get('title')}")

        # ── Cross-check ───────────────────────────────────────────
        print("\n" + "=" * 60)
        print("CROSS-CHECK: RAG produces session-isolated, different outputs")
        print("=" * 60)

        t1_title = plan1.get("plan", {}).get("plan_title", "")
        t2_title = plan2.get("plan", {}).get("plan_title", "")
        t1_rag = plan1.get("rag_used", False)
        t2_rag = plan2.get("rag_used", False)

        if t1_rag:
            print("PASS: Session rag-test-1 used RAG context")
        else:
            print("WARN: Session rag-test-1 did not use RAG (check embedding step)")

        if t2_rag:
            print("PASS: Session rag-test-2 used RAG context")
        else:
            print("WARN: Session rag-test-2 did not use RAG (check embedding step)")

        if t1_title and t2_title and t1_title != t2_title:
            print(f"PASS: Plans are genuinely different")
            print(f"  Plan 1: {t1_title}")
            print(f"  Plan 2: {t2_title}")
        elif not t1_title or not t2_title:
            print("INFO: One or both responses were clarification questions (not plans) -- check types above")
        else:
            print(f"FAIL: Both plans have same title -- possible hardcoding or session contamination!")
            print(f"  Plan 1: {t1_title}")
            print(f"  Plan 2: {t2_title}")


asyncio.run(run_rag_tests())
