"""
Anti-hardcoding test — 3 different inputs must produce genuinely different outputs.
This catches the exact bug from the previous build where a hardcoded
"2 hours / thermodynamics exam" scenario leaked into all responses.
"""
import asyncio
import json
import sys

# Test via HTTP to the running server
try:
    import httpx
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "-q"])
    import httpx

BASE = "http://localhost:8000"

TESTS = [
    {
        "name": "TEST 1: Exam with time given",
        "message": "I have a biology exam in 90 minutes and I haven't studied at all",
        "session_id": "anti-hc-test-1",
    },
    {
        "name": "TEST 2: Work deadline, different domain",
        "message": "My client presentation is due in 3 hours and the slides are half done",
        "session_id": "anti-hc-test-2",
    },
    {
        "name": "TEST 3: No time given at all — must ask clarification",
        "message": "I need to prepare for an interview but I'm totally unprepared",
        "session_id": "anti-hc-test-3",
    },
]


async def run_tests():
    results = []
    async with httpx.AsyncClient(timeout=300.0) as client:
        for test in TESTS:
            print(f"\n{'='*60}")
            print(f"Running: {test['name']}")
            print(f"Input: {test['message']}")
            print(f"{'='*60}")

            resp = await client.post(
                f"{BASE}/api/chat",
                json={
                    "message": test["message"],
                    "session_id": test["session_id"],
                    "conversation_history": [],
                },
            )
            data = resp.json()
            results.append(data)

            print(f"Response type: {data.get('type')}")
            if data.get("type") == "clarification":
                print(f"Clarification Q: {data.get('question')}")
            elif data.get("type") == "plan":
                plan = data.get("plan", {})
                print(f"Plan title: {plan.get('plan_title')}")
                steps = plan.get("steps", [])
                for i, s in enumerate(steps):
                    print(f"  Step {i}: [{s.get('duration_minutes')}m] {s.get('title')}")
                conf = data.get("confidence", {})
                print(f"Confidence: {conf.get('score')}% — {conf.get('label')}")
                print(f"RAG used: {data.get('rag_used')}")
                print(f"Was revised: {data.get('was_revised')}")
            elif data.get("error"):
                print(f"ERROR: {data.get('message')}")
            else:
                print(f"Unexpected response: {json.dumps(data, indent=2)[:500]}")

    # ── Cross-check: outputs must differ ─────────────────
    print(f"\n{'='*60}")
    print("CROSS-CHECK: Are outputs genuinely different?")
    print(f"{'='*60}")

    # Test 3 MUST be a clarification (no time given)
    t3 = results[2]
    if t3.get("type") == "clarification":
        print("PASS: Test 3 returned clarification (no time given -> agent asks)")
    else:
        print(f"FAIL: Test 3 should have asked for clarification but got type={t3.get('type')}")

    # Tests 1 and 2 — if both are plans, their titles must differ
    t1, t2 = results[0], results[1]
    if t1.get("type") == "plan" and t2.get("type") == "plan":
        title1 = t1["plan"].get("plan_title", "")
        title2 = t2["plan"].get("plan_title", "")
        steps1 = [s["title"] for s in t1["plan"].get("steps", [])]
        steps2 = [s["title"] for s in t2["plan"].get("steps", [])]
        if title1 == title2 and steps1 == steps2:
            print("FAIL: Tests 1 and 2 produced IDENTICAL plans — hardcoding bug!")
        else:
            print("PASS: Tests 1 and 2 produced different plans")
            print(f"  Plan 1: {title1}")
            print(f"  Plan 2: {title2}")
    elif t1.get("type") == "clarification" or t2.get("type") == "clarification":
        print(f"INFO: Test 1 type={t1.get('type')}, Test 2 type={t2.get('type')} — not directly comparable")
        print("  (clarification responses are fine as long as they're different)")
    else:
        print(f"INFO: Test 1 type={t1.get('type')}, Test 2 type={t2.get('type')}")

    if any(r.get("error") for r in results):
        print("\nWARNING: One or more tests returned errors — check above for details")


asyncio.run(run_tests())
