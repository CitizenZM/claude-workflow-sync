"""Klaviyo signup integration — push subscriber from Shopify form to Klaviyo + assign segment.

Usage:
  KLAVIYO_API_KEY=pk_xxx python3 klaviyo_signup.py --email <e> --first_name <n> --quiz_answers <json>

Reads quiz answers, computes segment, subscribes email, triggers welcome flow.
"""
import json, os, sys, urllib.request

KLAVIYO_API_VERSION = "2024-10-15"
WELCOME_FLOW_ID = os.environ.get("KLAVIYO_WELCOME_FLOW_ID", "")  # set after flow created
LIST_ID = os.environ.get("KLAVIYO_NEWSLETTER_LIST_ID", "")  # set after list created


def klaviyo_request(method, path, body=None):
    key = os.environ["KLAVIYO_API_KEY"]
    url = f"https://a.klaviyo.com/api{path}"
    headers = {
        "Authorization": f"Klaviyo-API-Key {key}",
        "Content-Type": "application/json",
        "revision": KLAVIYO_API_VERSION,
        "accept": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode()) if r.status < 300 else None


def determine_segment(quiz_answers: dict) -> str:
    """Map quiz answers to segment tag.
    Segments: beginner_couple, intermediate_couple, luxury_couple, wellness_focus,
              lgbtq_inclusive, travel_focus, anniversary_couple, default
    """
    exp = quiz_answers.get("experience_level", "")
    rel_duration = quiz_answers.get("relationship_duration", "")
    budget = quiz_answers.get("budget_tier", "")
    interests = quiz_answers.get("interests", [])

    if exp == "new" or rel_duration in ("new_couple", "single"):
        return "beginner_couple"
    if "wellness" in interests or "aftercare" in interests:
        return "wellness_focus"
    if budget == "luxury" or rel_duration == "10_plus":
        return "luxury_couple"
    if quiz_answers.get("partner_config") == "lgbtq":
        return "lgbtq_inclusive"
    if "travel" in interests:
        return "travel_focus"
    if rel_duration in ("4_10yr",):
        return "anniversary_couple"
    return "default"


def create_profile(email: str, first_name: str = None, quiz_answers: dict = None) -> dict:
    segment = determine_segment(quiz_answers or {})
    body = {
        "data": {
            "type": "profile",
            "attributes": {
                "email": email,
                "first_name": first_name or "",
                "properties": {
                    "segment_tag": segment,
                    "quiz_completed": True,
                    "quiz_answers_json": json.dumps(quiz_answers or {}),
                    "signup_source": "education_hub_quiz",
                    "consent": True,
                },
            },
        }
    }
    return klaviyo_request("POST", "/profiles/", body)


def subscribe_to_list(profile_id: str, list_id: str = None):
    list_id = list_id or LIST_ID
    if not list_id:
        return None
    body = {
        "data": {
            "type": "profile-subscription-bulk-create-job",
            "attributes": {
                "profiles": {"data": [{"type": "profile", "id": profile_id}]},
                "list_id": list_id,
                "custom_source": "Education Hub Quiz",
            },
        }
    }
    return klaviyo_request("POST", "/profile-subscription-bulk-create-jobs/", body)


def trigger_welcome_event(email: str, segment: str):
    """Trigger 'Quiz Completed' event — flow listens for this."""
    body = {
        "data": {
            "type": "event",
            "attributes": {
                "properties": {"segment": segment},
                "metric": {"data": {"type": "metric", "attributes": {"name": "Quiz Completed"}}},
                "profile": {"data": {"type": "profile", "attributes": {"email": email}}},
            },
        }
    }
    return klaviyo_request("POST", "/events/", body)


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    p.add_argument("--first_name", default="")
    p.add_argument("--quiz_answers", default="{}", help="JSON string of quiz answers")
    args = p.parse_args()

    answers = json.loads(args.quiz_answers)
    segment = determine_segment(answers)
    print(f"[klaviyo] segment: {segment}")

    profile = create_profile(args.email, args.first_name, answers)
    if not profile:
        print("[klaviyo] profile create failed")
        sys.exit(1)
    profile_id = profile["data"]["id"]
    print(f"[klaviyo] profile: {profile_id}")

    sub = subscribe_to_list(profile_id)
    print(f"[klaviyo] subscribed: {sub is not None}")

    evt = trigger_welcome_event(args.email, segment)
    print(f"[klaviyo] event fired: {evt is not None}")


if __name__ == "__main__":
    main()
