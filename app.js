const fallbackTranscript = 'Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে। এই process-এ carbon dioxide এবং water থেকে glucose তৈরি হয়, আর oxygen একটি by-product হিসেবে release হয়। মনে রাখবে, chlorophyll হলো সেই pigment যা light energy absorb করে।';
const state = {
  transcript: localStorage.getItem('lecturebook.transcript') || '',
  outputs: null,
  currentView: 'workspace',
  examTab: 'questions',
};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 3000);
}

function showLoading(title, message, duration = 900) {
  $('#loading-title').textContent = title;
  $('#loading-message').textContent = message;
  $('#loading').classList.add('show');
  return new Promise((resolve) => setTimeout(() => { $('#loading').classList.remove('show'); resolve(); }, duration));
}

function navigate(view) {
  state.currentView = view;
  $$('.view').forEach((item) => item.classList.toggle('active-view', item.id === `view-${view}`));
  $$('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  const labels = { workspace: 'Overview', transcript: 'Transcript workspace', notes: 'Study notes', exam: 'Exam pack', book: 'Book designer' };
  $('#breadcrumb-current').textContent = labels[view] || 'Overview';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function safeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function setTranscript(text) {
  state.transcript = text || '';
  localStorage.setItem('lecturebook.transcript', state.transcript);
  const terms = ['plants sunlight', 'food', 'carbon dioxide', 'water', 'glucose', 'oxygen', 'chlorophyll', 'light energy'];
  let highlighted = safeText(state.transcript);
  terms.forEach((term) => { highlighted = highlighted.replace(new RegExp(`(${term})`, 'gi'), '<mark>$1</mark>'); });
  $('#transcript-text').innerHTML = highlighted.split(/(?<=[।.!?])\s+/).filter(Boolean).map((part) => `<p>${part}</p>`).join('');
}

function fallbackPack(transcript) {
  const source = transcript || fallbackTranscript;
  return {
    cleanTranscript: source.replace(/\s+/g, ' ').trim(),
    summary: 'Photosynthesis হলো এমন একটি process যেখানে plants sunlight ব্যবহার করে carbon dioxide ও water থেকে glucose তৈরি করে। Chlorophyll light energy absorb করে এবং oxygen by-product হিসেবে বের হয়।',
    keyPoints: [
      'Sunlight is the primary energy source for photosynthesis.',
      'Carbon dioxide + water → glucose + oxygen.',
      'Chlorophyll absorbs light energy inside the leaf.',
      'Oxygen is released as a by-product of the process.',
    ],
    definitions: [
      { term: 'Photosynthesis', meaning: 'Plants-এর food তৈরির process using light energy.' },
      { term: 'Chlorophyll', meaning: 'Green pigment যা sunlight absorb করে।' },
      { term: 'By-product', meaning: 'মূল reaction-এর সঙ্গে তৈরি হওয়া secondary product.' },
    ],
    questions: [
      { q: 'What is the role of chlorophyll?', a: 'It absorbs light energy needed for photosynthesis.' },
      { q: 'Which substances are used to make glucose?', a: 'Carbon dioxide and water, using sunlight as energy.' },
      { q: 'What is released as a by-product?', a: 'Oxygen is released as a by-product.' },
    ],
    mcqs: [
      { q: 'Which pigment absorbs light energy?', options: ['Hemoglobin', 'Chlorophyll', 'Melanin', 'Keratin'], answer: 'Chlorophyll' },
      { q: 'The main energy source in photosynthesis is—', options: ['Moonlight', 'Heat', 'Sunlight', 'Sound'], answer: 'Sunlight' },
    ],
    flashcards: [
      { front: 'Photosynthesis', back: 'The process by which plants make food using light.' },
      { front: 'Inputs', back: 'Carbon dioxide, water and sunlight.' },
      { front: 'Output', back: 'Glucose and oxygen.' },
    ],
  };
}

function renderExamTab(tab = state.examTab) {
  state.examTab = tab;
  $$('.exam-tabs button').forEach((button, index) => button.classList.toggle('active', ['questions', 'mcqs', 'flashcards', 'revision'][index] === tab));
  const list = $('#question-list');
  if (!state.outputs) return;
  if (tab === 'mcqs') {
    list.innerHTML = (state.outputs.mcqs || []).map((item, index) => `<div class="question-card"><span class="question-number">${String(index + 1).padStart(2, '0')}</span><div><b>${safeText(item.q)}</b><p>${(item.options || []).map((option) => `<span style="display:block">${safeText(option)}</span>`).join('')}<strong style="display:block;color:var(--mint);margin-top:7px">Answer: ${safeText(item.answer)}</strong></p></div></div>`).join('');
    return;
  }
  if (tab === 'flashcards') {
    list.innerHTML = (state.outputs.flashcards || []).map((item, index) => `<div class="question-card"><span class="question-number">${String(index + 1).padStart(2, '0')}</span><div><b>${safeText(item.front)}</b><p>${safeText(item.back)}</p></div></div>`).join('');
    return;
  }
  if (tab === 'revision') {
    list.innerHTML = `<div class="question-card"><span class="question-number">REV</span><div><b>One-minute revision</b><p>${safeText(state.outputs.summary || '')}</p><p>${(state.outputs.keyPoints || []).map((point) => `• ${safeText(point)}`).join('<br>')}</p></div></div>`;
    return;
  }
  list.innerHTML = (state.outputs.questions || []).map((item, index) => {
    const question = typeof item === 'string' ? item : item.q;
    const answer = typeof item === 'string' ? '' : item.a;
    return `<div class="question-card"><span class="question-number">${String(index + 1).padStart(2, '0')}</span><div><b>${safeText(question)}</b><p>${safeText(answer)}</p></div><button>✎</button></div>`;
  }).join('');
}

function renderOutputs(outputs) {
  state.outputs = outputs;
  $('#summary-content').textContent = outputs.summary || '';
  $('#key-points-list').innerHTML = (outputs.keyPoints || []).map((point) => `<li>${safeText(point)}</li>`).join('');
  $('#definitions-list').innerHTML = (outputs.definitions || []).map((item) => `<div><b>${safeText(item.term)}</b><span>${safeText(item.meaning || item.definition)}</span></div>`).join('');
  renderExamTab('questions');
}

async function generatePack() {
  if (!state.transcript) state.transcript = fallbackTranscript;
  await showLoading('Building your study pack', 'Protecting language, extracting key ideas and shaping your notes…', 1100);
  try {
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: state.transcript, kind: 'study-pack' }) });
    if (!response.ok) throw new Error(`Generate failed: ${response.status}`);
    const data = await response.json();
    renderOutputs(data.outputs || fallbackPack(state.transcript));
    toast(data.mode === 'groq-live' ? 'Live Groq study pack ready.' : 'Study pack ready in demo mode.');
  } catch (error) {
    renderOutputs(fallbackPack(state.transcript));
    toast('Study pack ready — offline fallback used.');
  }
  navigate('notes');
}

async function uploadFile(file) {
  if (!file) return;
  await showLoading('Transcribing your lecture', 'Preserving Bengali, English and technical terms…', 800);
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
    const data = await response.json();
    setTranscript(data.transcript);
    toast(data.mode === 'groq-live' ? 'Live transcription complete.' : 'Sample transcript loaded — connect Groq for live audio.');
  } catch (error) {
    setTranscript(fallbackTranscript);
    toast('Server unavailable — sample transcript loaded.');
  }
  navigate('transcript');
}

$('#upload-trigger').addEventListener('click', () => $('#audio-input').click());
$('#hero-upload').addEventListener('click', () => $('#audio-input').click());
$('#browse-button').addEventListener('click', () => $('#audio-input').click());
$('#audio-input').addEventListener('change', (event) => uploadFile(event.target.files[0]));
$('#sample-trigger').addEventListener('click', () => uploadFile(new File(['sample lecture'], 'photosynthesis-sample.txt', { type: 'text/plain' })));
$('#paste-trigger').addEventListener('click', () => {
  const value = window.prompt('Paste your transcript here:', 'Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে।');
  if (value) { setTranscript(value); navigate('transcript'); toast('Transcript added — ready for review.'); }
});
$('#generate-all').addEventListener('click', generatePack);
$('#generate-side').addEventListener('click', generatePack);
$('#book-from-notes').addEventListener('click', () => navigate('book'));
function slugify(value) { return (value || 'lecturebook').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lecturebook'; }
function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportBook() {
  const title = $('#book-title').value.trim() || 'Untitled book';
  const pack = state.outputs || fallbackPack(state.transcript || fallbackTranscript);
  const rows = (pack.keyPoints || []).map((point) => `<li>${safeText(point)}</li>`).join('');
  const definitions = (pack.definitions || []).map((item) => `<p><strong>${safeText(item.term)}</strong> — ${safeText(item.meaning)}</p>`).join('');
  const questions = (pack.questions || []).map((item) => `<p><strong>${safeText(item.q)}</strong><br>${safeText(item.a)}</p>`).join('');
  const html = `<!doctype html><html lang="bn"><head><meta charset="UTF-8"><title>${safeText(title)}</title><style>body{font-family:Arial,"Noto Sans Bengali",sans-serif;max-width:760px;margin:48px auto;color:#17233d;line-height:1.7}h1{color:#168f83;font-size:34px}h2{border-bottom:2px solid #6fe4d2;padding-bottom:6px;margin-top:34px}li{margin:7px 0}.byline{color:#6d7890}</style></head><body><h1>${safeText(title)}</h1><p class="byline">LectureBook Studio · Created by Rahul</p><h2>Clean transcript</h2><p>${safeText(pack.cleanTranscript || state.transcript)}</p><h2>Summary</h2><p>${safeText(pack.summary)}</p><h2>Key points</h2><ul>${rows}</ul><h2>Definitions</h2>${definitions}<h2>Exam questions</h2>${questions}</body></html>`;
  const base = slugify(title);
  downloadBlob(`${base}.html`, html, 'text/html;charset=utf-8');
  downloadBlob(`${base}.doc`, html, 'application/msword;charset=utf-8');
  toast('HTML and Word-compatible DOC files downloaded. Print the HTML for PDF.');
}
$('#export-book').addEventListener('click', exportBook);
$('#save-design').addEventListener('click', () => { localStorage.setItem('lecturebook.bookTitle', $('#book-title').value); toast('Book design saved to your workspace.'); });
$('#play-audio').addEventListener('click', () => toast('Audio preview is available after uploading a lecture file.'));
$('#edit-transcript').addEventListener('click', () => toast('Review mode enabled — highlighted terms are ready to edit.'));
$('#show-all').addEventListener('click', () => toast('You are already viewing your latest projects.'));
$('#theme-toggle').addEventListener('click', () => { document.body.classList.toggle('light-theme'); localStorage.setItem('lecturebook.theme', document.body.classList.contains('light-theme') ? 'light' : 'dark'); toast(document.body.classList.contains('light-theme') ? 'Soft light theme enabled.' : 'Midnight luxe theme enabled.'); });
$('#drop-zone').addEventListener('dragover', (event) => { event.preventDefault(); $('#drop-zone').classList.add('drag-over'); });
$('#drop-zone').addEventListener('dragleave', () => $('#drop-zone').classList.remove('drag-over'));
$('#drop-zone').addEventListener('drop', (event) => { event.preventDefault(); $('#drop-zone').classList.remove('drag-over'); uploadFile(event.dataTransfer.files[0]); });
$$('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
$$('[data-open="transcript"]').forEach((row) => row.addEventListener('click', () => { setTranscript('Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে। এই process-এ carbon dioxide এবং water থেকে glucose তৈরি হয়, আর oxygen একটি by-product হিসেবে release হয়। মনে রাখবে, chlorophyll হলো সেই pigment যা light energy absorb করে।'); navigate('transcript'); }));
$$('.theme-option').forEach((button, index) => button.addEventListener('click', () => {
  $$('.theme-option').forEach((item) => item.classList.remove('selected')); button.classList.add('selected');
  const cover = $('.preview-cover'); const page = $('.preview-page'); const wrap = $('.book-preview-wrap');
  const themes = [
    ['linear-gradient(155deg,#1a3870,#111a3c 65%,#0c1730)', '#f9fbfc', 'linear-gradient(135deg,rgba(30,37,61,.75),rgba(13,18,30,.84))'],
    ['linear-gradient(155deg,#344d73,#193f4a 62%,#17243d)', '#f3fbf8', 'linear-gradient(135deg,rgba(35,70,73,.78),rgba(14,28,39,.86))'],
    ['linear-gradient(155deg,#f4efe5,#ddd2bd 65%,#c2b39b)', '#fffdf8', 'linear-gradient(135deg,rgba(245,239,228,.9),rgba(210,199,180,.72))'],
  ];
  const [coverBg, pageBg, wrapBg] = themes[index] || themes[0];
  cover.style.background = coverBg; page.style.background = pageBg; wrap.style.background = wrapBg;
  toast(`${button.textContent.trim()} selected.`);
}));
$$('.exam-tabs button').forEach((button, index) => button.addEventListener('click', () => renderExamTab(['questions', 'mcqs', 'flashcards', 'revision'][index])));
$('.search-box input').addEventListener('input', (event) => { const query = event.target.value.trim().toLowerCase(); $$('.project-row').forEach((row) => { row.hidden = query && !row.textContent.toLowerCase().includes(query); }); });
window.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('.search-box input').focus(); } });
$('#book-title').addEventListener('input', (event) => { $('#preview-title').textContent = event.target.value || 'Untitled book'; });
const savedTheme = localStorage.getItem('lecturebook.theme');
if (savedTheme === 'light') document.body.classList.add('light-theme');
const savedTitle = localStorage.getItem('lecturebook.bookTitle');
if (savedTitle) { $('#book-title').value = savedTitle; $('#preview-title').textContent = savedTitle; }
if (!state.transcript) setTranscript(fallbackTranscript);
