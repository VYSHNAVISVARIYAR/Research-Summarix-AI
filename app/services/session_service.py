import os
import json
from datetime import datetime

HISTORY_FILE = os.path.join("data", "chat_history.json")

def _load_history():
    if not os.path.exists(HISTORY_FILE):
        return {}
    with open(HISTORY_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def _save_history(data):
    with open(HISTORY_FILE, "w") as f:
        json.dump(data, f, indent=4)

def get_chat_history(paper_id: str):
    data = _load_history()
    return data.get(paper_id, [])

def add_chat_message(paper_id: str, role: str, content: str):
    data = _load_history()
    if paper_id not in data:
        data[paper_id] = []
    
    data[paper_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat()
    })
    _save_history(data)

def get_all_papers_for_user(user_email: str = None):
    # This is slightly hacked. Normally you map paper_id to a user. For now, since user uploads don't link to users currently, we'll just return all keys as "papers". We really should link uploads to users.
    # We can retrieve all papers.
    data = _load_history()
    return list(data.keys())
