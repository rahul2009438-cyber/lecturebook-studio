from __future__ import annotations

import cgi
import json
import os
import re
import tempfile
import urllib.error
import urllib.request
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).parent
STORAGE = ROOT / "storage"
STORAGE.mkdir(exist_ok=True)
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "3897"))
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
WHISPER_MODEL = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")

DEMO_TRANSCRIPT = (
    "Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে। "
    "এই process-এ carbon dioxide এবং water থেকে glucose তৈরি হয়, আর oxygen "
    "একটি by-product হিসেবে release হয়। মনে রাখবে, chlorophyll হলো সেই pigment "
    "যা light energy absorb করে।"
)

DEFAULT_ANALYSIS_CONFIG = {
    "subject": "Education",
    "topicHint": "",
    "filtering": "balanced",
    "outputType": "exam-ready",
    "preserveSource": True,
}


def normalize_analysis_config(value: dict | None = None) -> dict:
    value = value if isinstance(value, dict) else {}
    config = {**DEFAULT_ANALYSIS_CONFIG, **value}
    if config["filtering"] not in {"strict", "balanced", "complete"}:
        config["filtering"] = "balanced"
    if config["outputType"] not in {"exam-ready", "chapter", "revision", "transcript"}:
        config["outputType"] = "exam-ready"
    config["topicHint"] = str(config.get("topicHint") or "").strip()
    config["subject"] = str(config.get("subject") or "Education").strip()
    config["preserveSource"] = bool(config.get("preserveSource", True))
    return config


def format_timestamp(seconds: int) -> str:
    seconds = max(0, int(seconds))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def make_analysis(transcript: str, config: dict | None = None, source_segments: list | None = None) -> dict:
    """Create a deterministic, evidence-linked classification fallback.

    The raw transcript is never changed. Filtering only controls `included` on
    derived segments, so a later review can restore anything the user needs.
    """
    config = normalize_analysis_config(config)
    pieces = [piece.strip() for piece in re.split(r"(?<=[।.!?])\s+", transcript.strip()) if piece.strip()]
    hint_words = [word for word in re.split(r"[^\w\u0980-\u09FF]+", config["topicHint"].lower()) if len(word) > 2]
    segments = []
    for index, content in enumerate(pieces):
        lowered = content.lower()
        category = "CORE_LECTURE"
        if re.search(r"\?|\b(why|what|how|student|question)\b|কেন|কীভাবে|প্রশ্ন|স্যার", lowered):
            category = "STUDENT_QUESTION"
        elif re.search(r"for example|example|উদাহরণ|যেমন|ধরো|ধরা যাক", lowered):
            category = "RELEVANT_EXAMPLE"
        elif re.search(r"attendance|present|roll call|চুপ|শান্ত|বিরতি|নোটিশ|উপস্থিত", lowered):
            category = "ADMIN_NOISE"
        elif re.search(r"unclear|inaudible|noise|হইচই|শোনা যাচ্ছে না", lowered):
            category = "UNCLEAR_AUDIO"
        elif re.search(r"football|খেলা|গতকাল|মজা|গল্প", lowered):
            category = "OFF_TOPIC"
        topic_match = not hint_words or any(word in lowered for word in hint_words)
        if config["filtering"] == "complete":
            included = True
        elif config["filtering"] == "strict":
            included = topic_match
        else:
            included = category not in {"ADMIN_NOISE", "OFF_TOPIC", "UNCLEAR_AUDIO"}
        review = category == "UNCLEAR_AUDIO" or (config["filtering"] == "strict" and not topic_match)
        source_start = source_segments[index].get("start", index * 12) if source_segments and index < len(source_segments) else index * 12
        segments.append({
            "id": f"seg-{index + 1}",
            "timestamp": format_timestamp(source_start),
            "content": content,
            "category": category,
            "confidence": 0.48 if category == "UNCLEAR_AUDIO" else 0.94 if topic_match else 0.72,
            "topicMatch": topic_match,
            "included": included,
            "review": review,
        })
    return {
        "config": config,
        "segments": segments,
        "reviewQueue": [segment for segment in segments if segment["review"]],
        "topicMatches": sum(1 for segment in segments if segment["topicMatch"]),
    }


def json_response(handler: BaseHTTPRequestHandler, payload: dict, status=HTTPStatus.OK):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def groq_chat(system: str, user: str) -> str | None:
    if not GROQ_API_KEY:
        return None
    data = json.dumps(
        {
            "model": GROQ_MODEL,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=data,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            parsed = json.loads(response.read().decode("utf-8"))
        return parsed["choices"][0]["message"]["content"]
    except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError):
        return None


def groq_generate_pack(transcript: str, config: dict | None = None) -> dict | None:
    """Ask Groq for the structured study pack, then validate the JSON shape."""
    config = normalize_analysis_config(config)
    raw = groq_chat(
        (
            "You are LectureBook Studio's accuracy-first language engine. "
            "Preserve Bengali-English code-switching in cleanTranscript. Keep "
            "technical English terms, formulas, proper nouns and quotations unchanged. "
            "Do not add facts not present in the lecture. Use the topic hint only to "
            "find supported content, never to invent missing facts. Keep relevant "
            "student questions and examples; remove only unrelated chatter. Mark "
            "uncertain claims for review. Return JSON only with exactly "
            "these keys: cleanTranscript, summary, keyPoints, definitions, questions, "
            "mcqs, flashcards. definitions must contain term and meaning; questions must "
            "contain q and a; mcqs must contain q, options and answer; flashcards must "
            "contain front and back."
        ),
        json.dumps({"transcript": transcript, "analysisConfig": config}, ensure_ascii=False),
    )
    if not raw:
        return None
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    required = {"cleanTranscript", "summary", "keyPoints", "definitions", "questions", "mcqs", "flashcards"}
    if not required.issubset(parsed) or not isinstance(parsed["keyPoints"], list):
        return None
    return parsed


def make_structured_outputs(transcript: str) -> dict:
    transcript = transcript.strip() or DEMO_TRANSCRIPT
    clean = re.sub(r"\s+", " ", transcript).strip()
    return {
        "cleanTranscript": clean,
        "summary": (
            "Photosynthesis is a process যেখানে plants sunlight ব্যবহার করে "
            "carbon dioxide ও water থেকে glucose তৈরি করে। Chlorophyll light "
            "energy absorb করে এবং oxygen by-product হিসেবে বের হয়।"
        ),
        "keyPoints": [
            "Sunlight is the primary energy source for photosynthesis.",
            "Carbon dioxide + water → glucose + oxygen.",
            "Chlorophyll absorbs light energy inside the leaf.",
            "Oxygen is released as a by-product of the process.",
        ],
        "definitions": [
            {"term": "Photosynthesis", "meaning": "Plants-এর food তৈরির process using light energy."},
            {"term": "Chlorophyll", "meaning": "Green pigment যা sunlight absorb করে।"},
            {"term": "By-product", "meaning": "মূল reaction-এর সঙ্গে তৈরি হওয়া secondary product."},
        ],
        "questions": [
            {"q": "What is the role of chlorophyll?", "a": "It absorbs light energy needed for photosynthesis."},
            {"q": "Which substances are used to make glucose?", "a": "Carbon dioxide and water, using sunlight as energy."},
            {"q": "What is released as a by-product?", "a": "Oxygen is released as a by-product."},
        ],
        "mcqs": [
            {"q": "Which pigment absorbs light energy?", "options": ["Hemoglobin", "Chlorophyll", "Melanin", "Keratin"], "answer": "Chlorophyll"},
            {"q": "The main energy source in photosynthesis is—", "options": ["Moonlight", "Heat", "Sunlight", "Sound"], "answer": "Sunlight"},
        ],
        "flashcards": [
            {"front": "Photosynthesis", "back": "The process by which plants make food using light."},
            {"front": "Inputs", "back": "Carbon dioxide, water and sunlight."},
            {"front": "Output", "back": "Glucose and oxygen."},
        ],
    }


def multipart_upload(content_type: str, audio: bytes, filename: str) -> bytes:
    boundary = "----LectureBook" + uuid.uuid4().hex
    chunks = [
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="model"\r\n\r\n{WHISPER_MODEL}\r\n'.encode(),
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n',
        f"--{boundary}\r\n".encode(),
        b'Content-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nsegment\r\n',
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {content_type or 'application/octet-stream'}\r\n\r\n".encode(),
        audio,
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        data=b"".join(chunks),
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        parsed = json.loads(response.read().decode("utf-8"))
    return {"text": parsed.get("text", ""), "segments": parsed.get("segments", [])}


class AppHandler(BaseHTTPRequestHandler):
    server_version = "LectureBookStudio/0.1"

    def log_message(self, format, *args):
        # Keep the development console useful without leaking request bodies.
        print(f"[{self.log_date_time_string()}] {format % args}")

    def do_GET(self):
        if self.path == "/api/health":
            json_response(self, {"ok": True, "provider": "groq", "live": bool(GROQ_API_KEY)})
            return
        path = self.path.split("?", 1)[0]
        if path == "/":
            path = "/index.html"
        target = (ROOT / path.lstrip("/")).resolve()
        if not str(target).startswith(str(ROOT.resolve())) or not target.is_file():
            json_response(self, {"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return
        mime = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".svg": "image/svg+xml",
            ".json": "application/json",
        }.get(target.suffix, "application/octet-stream")
        body = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path == "/api/transcribe":
            self.handle_transcribe()
            return
        if self.path == "/api/generate":
            self.handle_generate()
            return
        json_response(self, {"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def handle_transcribe(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length > 60 * 1024 * 1024:
            json_response(self, {"error": "File is larger than 60 MB."}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return
        content_type = self.headers.get("Content-Type", "")
        transcript = ""
        segments = []
        live_transcription = False
        config = normalize_analysis_config()
        filename = "lecture-audio"
        if content_type.startswith("multipart/form-data"):
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": content_type},
            )
            if "file" in form:
                file_field = form["file"]
                filename = Path(file_field.filename or filename).name
                audio = file_field.file.read()
                config = normalize_analysis_config({
                    "subject": form.getfirst("subject", DEFAULT_ANALYSIS_CONFIG["subject"]),
                    "topicHint": form.getfirst("topic_hint", ""),
                    "filtering": form.getfirst("filtering", DEFAULT_ANALYSIS_CONFIG["filtering"]),
                    "outputType": form.getfirst("output_type", DEFAULT_ANALYSIS_CONFIG["outputType"]),
                    "preserveSource": form.getfirst("preserve_source", "true").lower() == "true",
                })
                source_id = uuid.uuid4().hex[:10]
                safe_name = f"{source_id}_{filename}"
                (STORAGE / safe_name).write_bytes(audio)
                if GROQ_API_KEY:
                    try:
                        result = multipart_upload(content_type, audio, filename)
                        transcript = result.get("text", "")
                        segments = result.get("segments", [])
                        live_transcription = bool(transcript)
                    except Exception as exc:
                        print(f"Groq transcription fallback: {exc}")
        else:
            self.rfile.read(content_length)
        transcript = transcript or DEMO_TRANSCRIPT
        if not segments:
            segments = make_analysis(transcript, config)["segments"]
        source_id = locals().get("source_id", uuid.uuid4().hex[:10])
        (STORAGE / f"{source_id}.json").write_text(
            json.dumps({"id": source_id, "filename": filename, "rawTranscript": transcript, "analysisConfig": config}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        json_response(
            self,
            {
                "id": source_id,
                "filename": filename,
                "transcript": transcript,
                "segments": segments,
                "analysis": make_analysis(transcript, config, segments),
                "mode": "groq-live" if live_transcription else "demo",
                "language": "bn+en",
            },
        )

    def handle_generate(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            json_response(self, {"error": "Invalid JSON"}, HTTPStatus.BAD_REQUEST)
            return
        transcript = payload.get("transcript", "")
        config = normalize_analysis_config(payload.get("config"))
        analysis = make_analysis(transcript or DEMO_TRANSCRIPT, config)
        outputs = groq_generate_pack(transcript, config) if GROQ_API_KEY else None
        if outputs is None:
            outputs = make_structured_outputs(transcript)
        outputs["analysis"] = analysis
        json_response(self, {"outputs": outputs, "mode": "groq-live" if GROQ_API_KEY and outputs else "demo"})


if __name__ == "__main__":
    print(f"LectureBook Studio running at http://{HOST}:{PORT}")
    print("Groq live mode:", "enabled" if GROQ_API_KEY else "demo fallback (set GROQ_API_KEY to enable live transcription)")
    ThreadingHTTPServer((HOST, PORT), AppHandler).serve_forever()
