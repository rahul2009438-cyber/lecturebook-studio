# LectureBook Studio

Lecture-to-Book AI Studio-à¦à¦° à¦à¦•à¦Ÿà¦¿ self-contained MVPà¥¤ à¦à¦Ÿà¦¿ à¦¬à¦¾à¦‚à¦²à¦¾, English à¦à¦¬à¦‚ Bengali-English mixed lecture-à¦à¦° faithful transcript à¦¥à§‡à¦•à§‡ study notes, exam pack à¦à¦¬à¦‚ textbook-style book preview à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§‡à¥¤

## à¦à¦–à¦¨ à¦¯à¦¾ à¦•à¦¾à¦œ à¦•à¦°à§‡

- Audio/video/text upload flow à¦à¦¬à¦‚ demo transcription fallback
- Bengali-English code-switching preservation UI
- Original transcript, confidence indicator, language intelligence review panel
- Study notes: summary, key points, definitions, exam tip
- Exam pack: questions
- Book Designer: title, subtitle, theme selection, editable A4 preview
- Groq integration adapter (optional): `whisper-large-v3-turbo` transcription à¦à¦¬à¦‚ structured Groq study-pack generation
- No API key à¦¥à¦¾à¦•à¦²à§‡à¦“ à¦ªà§à¦°à§‹ UI demo mode-à¦ à¦šà¦¾à¦²à¦¾à¦¨à§‹ à¦¯à¦¾à¦¯à¦¼

## à¦šà¦¾à¦²à¦¾à¦¨à§‹à¦° à¦ªà¦¦à§à¦§à¦¤à¦¿

Python 3.10+ à¦²à¦¾à¦—à¦¬à§‡; external package à¦¦à¦°à¦•à¦¾à¦° à¦¨à§‡à¦‡à¥¤

```powershell
cd "C:\Users\dutta\.openmausbot\task-workspaces\a3557570-92c6-4354-998b-309d7b1113af\d4fda2f3-1644-44c7-899c-470bf885dc20"
python server.py
```

à¦¤à¦¾à¦°à¦ªà¦° à¦¬à§à¦°à¦¾à¦‰à¦œà¦¾à¦°à§‡ à¦–à§à¦²à§à¦¨: `http://127.0.0.1:3897`

Live Groq transcription à¦šà¦¾à¦²à¦¾à¦¤à§‡ process à¦¶à§à¦°à§ à¦•à¦°à¦¾à¦° à¦†à¦—à§‡ environment-à¦ à¦¨à¦¿à¦œà§‡à¦° key à¦¦à¦¿à¦¨:

```powershell
$env:GROQ_API_KEY = "your-key"
python server.py
```

Key à¦•à¦–à¦¨à§‹ source file à¦¬à¦¾ chat-à¦ à¦°à¦¾à¦–à¦¬à§‡à¦¨ à¦¨à¦¾à¥¤ API key à¦›à¦¾à¦¡à¦¼à¦¾ app demo mode-à¦ à¦¥à¦¾à¦•à§‡ à¦à¦¬à¦‚ sample workflow test à¦•à¦°à¦¾ à¦¯à¦¾à¦¯à¦¼à¥¤

`GROQ_API_KEY` à¦¥à¦¾à¦•à¦²à§‡ `/api/generate` live Groq output-à¦à¦° à¦œà¦¨à§à¦¯ clean transcript, summary, key points, definitions, questions, MCQ à¦à¦¬à¦‚ flashcards à¦à¦•à¦¸à¦™à§à¦—à§‡ à¦¤à§ˆà¦°à¦¿ à¦•à¦°à§‡à¥¤ JSON à¦…à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£ à¦¬à¦¾ invalid à¦¹à¦²à§‡ backend à¦¨à¦¿à¦œà§‡ à¦¥à§‡à¦•à§‡à¦‡ safe demo fallback à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§‡à¥¤

## à¦ªà¦°à§‡à¦° production steps

1. FastAPI + SQLite job queue-à¦¤à§‡ stdlib server à¦¬à¦¦à¦²à¦¾à¦¨à§‹
2. FFmpeg chunking, resumable jobs à¦à¦¬à¦‚ timestamp alignment à¦¯à§‹à¦— à¦•à¦°à¦¾
3. Shared document model à¦¥à§‡à¦•à§‡ Chromium PDF à¦“ `python-docx` export
4. Bengali font embedding à¦à¦¬à¦‚ PDF/DOCX regression tests
5. React + TypeScript frontend-à¦ component split, auth à¦“ persistent projects

