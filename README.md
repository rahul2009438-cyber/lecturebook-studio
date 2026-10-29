# LectureBook Studio

Lecture-to-Book AI Studio-এর একটি self-contained MVP। এটি বাংলা, English এবং Bengali-English mixed lecture-এর faithful transcript থেকে study notes, exam pack এবং textbook-style book preview তৈরি করে।

## এখন যা কাজ করে

- Mobile-safe audio/video/text upload flow, same-file retry reset এবং 60 MB preflight
- Bengali-English code-switching preservation UI
- Immutable raw transcript, confidence indicator, language intelligence review panel
- Classroom Intelligence: subject, topic hint, Strict/Balanced/Complete filtering এবং output type
- Evidence-linked segment classification: CORE_LECTURE, RELEVANT_EXAMPLE, STUDENT_QUESTION, ADMIN_NOISE, OFF_TOPIC, UNCLEAR_AUDIO
- Approximate timestamps in demo mode; Whisper verbose segment timestamps in Groq live mode
- Review Queue for uncertain audio and strict-topic misses
- Study notes: summary, key points, definitions, exam tip
- Exam pack: questions, MCQs, flashcards এবং revision sheet
- Book Designer: title, subtitle, theme selection, editable A4 preview
- Groq integration adapter (optional): `whisper-large-v3-turbo` transcription এবং structured Groq study-pack generation
- No API key থাকলেও পুরো UI demo mode-এ চালানো যায়

## চালানোর পদ্ধতি

Python 3.10+ লাগবে; external package দরকার নেই।

```powershell
cd "C:\Users\dutta\.openmausbot\task-workspaces\a3557570-92c6-4354-998b-309d7b1113af\d4fda2f3-1644-44c7-899c-470bf885dc20"
python server.py
```

তারপর ব্রাউজারে খুলুন: `http://127.0.0.1:3897`

Live Groq transcription চালাতে process শুরু করার আগে environment-এ নিজের key দিন:

```powershell
$env:GROQ_API_KEY = "your-key"
python server.py
```

Key কখনো source file বা chat-এ রাখবেন না। API key ছাড়া app demo mode-এ থাকে এবং sample workflow test করা যায়।

`GROQ_API_KEY` থাকলে `/api/generate` live Groq output-এর জন্য clean transcript, summary, key points, definitions, questions, MCQ এবং flashcards একসঙ্গে তৈরি করে। JSON অসম্পূর্ণ বা invalid হলে backend নিজে থেকেই safe demo fallback ব্যবহার করে।

## Classroom Intelligence configuration

প্রতিটি lecture-এর জন্য UI থেকে এই configuration পাঠানো যায়:

```json
{
  "subject": "Political Science / Civics",
  "topicHint": "দ্বিকক্ষবিশিষ্ট আইনসভার পক্ষে ও বিপক্ষে যুক্তি",
  "filtering": "balanced",
  "outputType": "exam-ready",
  "preserveSource": true
}
```

`preserveSource=true` থাকলে raw transcript overwrite হয় না। `/api/transcribe` uploaded source ও raw transcript-এর metadata `storage/`-এ রেখে দেয়। Live Whisper response-এ `verbose_json` + segment timestamps চাওয়া হয়; demo mode-এ segment time estimate হিসেবে দেখানো হয়।

## পরের production steps

1. FastAPI + SQLite job queue-তে stdlib server বদলানো
2. FFmpeg chunking, resumable jobs এবং speaker diarization যোগ করা
3. Shared document model থেকে Chromium PDF ও `python-docx` export
4. Bengali font embedding এবং PDF/DOCX regression tests
5. React + TypeScript frontend-এ component split, auth ও persistent projects
