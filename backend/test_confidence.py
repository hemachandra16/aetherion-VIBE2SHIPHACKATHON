import sys
sys.path.insert(0, '.')
from agents.session_store import get_session, set_plan, mark_step_completed
from agents.confidence import calculate_confidence

sid = 'test-session-001'
s = get_session(sid)
set_plan(sid, [
    {'title': 'Step A', 'duration_minutes': 20, 'cut_if_behind': False, 'completed': False},
    {'title': 'Step B', 'duration_minutes': 30, 'cut_if_behind': True,  'completed': False},
    {'title': 'Step C', 'duration_minutes': 15, 'cut_if_behind': False, 'completed': False},
])
s['triage_result'] = {'time_remaining_minutes': 65}

c1 = calculate_confidence(sid)
print("Before: score=%d%%, label=%s, completed=%d/%d" % (c1['score'], c1['label'], c1['completed'], c1['total']))

mark_step_completed(sid, 0)
c2 = calculate_confidence(sid)
print("After step 0: score=%d%%, completed=%d/%d" % (c2['score'], c2['completed'], c2['total']))

assert c2['completed'] > c1['completed'], "Step completion not tracked"
assert c2['score'] >= c1['score'], "Score should not drop after completing a step"
print("PASS: confidence updates correctly with step completion")
