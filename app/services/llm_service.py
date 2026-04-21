import os
import itertools
import threading
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

# ── Key Pools ────────────────────────────────────────────────────────────────
def _load_keys(prefix: str, count: int = 3):
    """Load numbered API keys from env (e.g. GROQ_API_KEY_1, _2, _3)."""
    keys = []
    for i in range(1, count + 1):
        k = os.getenv(f"{prefix}_{i}")
        if k:
            keys.append(k)
    return keys

GROQ_KEYS = _load_keys("GROQ_API_KEY") or [os.getenv("GROQ_API_KEY", "")]
GEMINI_KEYS = _load_keys("GEMINI_API_KEY")
OPENROUTER_KEYS = _load_keys("OPENROUTER_API_KEY")

# Thread-safe round-robin iterators
_lock = threading.Lock()
_groq_cycle = itertools.cycle(GROQ_KEYS) if GROQ_KEYS else None
_gemini_cycle = itertools.cycle(GEMINI_KEYS) if GEMINI_KEYS else None
_openrouter_cycle = itertools.cycle(OPENROUTER_KEYS) if OPENROUTER_KEYS else None

def _next_key(cycle):
    if cycle is None:
        return None
    with _lock:
        return next(cycle)


# ── Provider call implementations ────────────────────────────────────────────
def _call_groq(system_prompt: str, user_prompt: str, key: str):
    client = Groq(api_key=key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=2048,
    )
    return response.choices[0].message.content


def _call_gemini(system_prompt: str, user_prompt: str, key: str):
    """Call Google Gemini via REST (no SDK dependency needed)."""
    import urllib.request, json
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={key}"
    )
    body = json.dumps({
        "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2048},
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _call_openrouter(system_prompt: str, user_prompt: str, key: str):
    """Call OpenRouter (OpenAI-compatible API)."""
    import urllib.request, json
    url = "https://openrouter.ai/api/v1/chat/completions"
    body = json.dumps({
        "model": "meta-llama/llama-3.3-70b-instruct",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 2048,
    }).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}",
    })
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    return data["choices"][0]["message"]["content"]


# ── Provider cascade with per-key retry ──────────────────────────────────────
# Order: Groq (fastest) → Gemini → OpenRouter (fallback)
_PROVIDERS = [
    ("Groq",       _groq_cycle,       _call_groq,       len(GROQ_KEYS)),
    ("Gemini",     _gemini_cycle,     _call_gemini,     len(GEMINI_KEYS)),
    ("OpenRouter", _openrouter_cycle, _call_openrouter, len(OPENROUTER_KEYS)),
]


def call_llm(system_prompt: str, user_prompt: str):
    """
    Call the LLM with automatic key rotation and provider fallback.
    Tries every key in each provider pool before falling through to the next.
    """
    errors = []

    for provider_name, cycle, call_fn, pool_size in _PROVIDERS:
        if cycle is None or pool_size == 0:
            continue
        # Try each key in the pool at most once
        for _ in range(pool_size):
            key = _next_key(cycle)
            try:
                result = call_fn(system_prompt, user_prompt, key)
                return result
            except Exception as e:
                errors.append(f"{provider_name}: {e}")
                print(f"[LLM] {provider_name} key failed, rotating... ({e})")

    # All providers exhausted
    error_summary = " | ".join(errors[-6:])  # last 6 errors for brevity
    print(f"[LLM] All providers failed: {error_summary}")
    return f"AI Error: All API providers are currently unavailable. Details: {error_summary}"