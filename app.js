const fallbackTranscript = 'Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে। এই process-এ carbon dioxide এবং water থেকে glucose তৈরি হয়, আর oxygen একটি by-product হিসেবে release হয়। মনে রাখবে, chlorophyll হলো সেই pigment যা light energy absorb করে।';
const state = {
  transcript: localStorage.getItem('lecturebook.transcript') || '',
  outputs: null,
  analysis: null,
  fileName: localStorage.getItem('lecturebook.fileName') || '',
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

function getAnalysisConfig() {
  return {
    subject: $('#subject-select')?.value || 'Education',
    topicHint: $('#topic-hint')?.value.trim() || '',
    filtering: $('#filter-level')?.value || 'balanced',
    outputType: $('#output-type')?.value || 'exam-ready',
    preserveSource: $('#preserve-source')?.checked !== false,
  };
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function classifySegment(text, index, config) {
  const value = text.toLowerCase();
  let category = 'CORE_LECTURE';
  if (/\b(why|what|how|can you|student|প্রশ্ন|কেন|কীভাবে|স্যার)\b/.test(value) && /\?|প্রশ্ন|স্যার/.test(value)) category = 'STUDENT_QUESTION';
  else if (/for example|উদাহরণ|যেমন|ধরো|ধরা যাক|example/.test(value)) category = 'RELEVANT_EXAMPLE';
  else if (/attendance|present|roll call|চুপ|শান্ত|বিরতি|নোটিশ|উপস্থিত/.test(value)) category = 'ADMIN_NOISE';
  else if (/unclear|inaudible|শোনা যাচ্ছে না|হইচই|noise/.test(value)) category = 'UNCLEAR_AUDIO';
  else if (/football|খেলা|গতকাল|মজা|গল্প/.test(value)) category = 'OFF_TOPIC';
  const hintWords = (config.topicHint || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2);
  const topicMatch = !hintWords.length || hintWords.some((word) => value.includes(word));
  const keepByLevel = config.filtering === 'complete' || (config.filtering === 'balanced' && !['ADMIN_NOISE', 'OFF_TOPIC'].includes(category)) || (config.filtering === 'strict' && topicMatch);
  return { id: `seg-${index + 1}`, timestamp: formatTimestamp(index * 12), content: text.trim(), category, confidence: category === 'UNCLEAR_AUDIO' ? 0.48 : topicMatch ? 0.94 : 0.72, topicMatch, included: keepByLevel, review: category === 'UNCLEAR_AUDIO' || (config.filtering === 'strict' && !topicMatch) };
}

function fallbackAnalyze(transcript, config = getAnalysisConfig()) {
  const segments = (transcript || fallbackTranscript).split(/(?<=[।.!?])\s+/).filter(Boolean).map((text, index) => classifySegment(text, index, config));
  return { config, segments, reviewQueue: segments.filter((segment) => segment.review), topicMatches: segments.filter((segment) => segment.topicMatch).length };
}

function renderAnalysis(analysis) {
  state.analysis = analysis || fallbackAnalyze(state.transcript);
  const config = state.analysis.config || getAnalysisConfig();
  const segments = state.analysis.segments || [];
  const kept = segments.filter((segment) => segment.included);
  const review = state.analysis.reviewQueue || segments.filter((segment) => segment.review);
  const segmentList = $('#segment-list');
  const reviewList = $('#review-list');
  if (!segmentList || !reviewList) return;
  $('#analysis-status').innerHTML = `<i></i>${safeText(config.filtering || 'balanced')} · ${kept.length}/${segments.length} kept`;
  $('#review-count').textContent = String(review.length);
  segmentList.innerHTML = segments.map((segment) => `<article class="segment-card ${segment.included ? 'kept' : 'filtered'}"><div class="segment-meta"><time>${safeText(segment.timestamp)}</time><span class="segment-tag ${segment.category.toLowerCase()}">${safeText(segment.category.replaceAll('_', ' '))}</span><b>${Math.round((segment.confidence || 0) * 100)}%</b></div><p>${safeText(segment.content)}</p></article>`).join('') || '<p class="empty-state">No segments yet. Upload a lecture to begin.</p>';
  reviewList.innerHTML = review.length ? review.map((segment) => `<div class="review-item"><span>${safeText(segment.timestamp)}</span><p>${safeText(segment.content)}</p><b>Review</b></div>`).join('') : '<p class="empty-state">No uncertain segments. The queue is clear.</p>';
}

function ensureStudioEnhancements() {
  const transcriptView = $('#view-transcript');
  const notesView = $('#view-notes');
  if (transcriptView && !$('#topic-control-panel')) {
    transcriptView.querySelector('.progress-rail')?.insertAdjacentHTML('afterend', `<div id="topic-control-panel" class="topic-control-panel glass-card"><div class="panel-header"><div><span class="eyebrow">CLASSROOM INTELLIGENCE</span><h3>Focus this lecture</h3></div><span class="check-badge">✓</span></div><p class="control-help">Give the engine a topic and it will classify lecture segments without touching the original transcript.</p><div class="topic-controls-grid"><label>SUBJECT<select id="subject-select"><option>Education</option><option>Modern Computer Applications</option><option>Political Science / Civics</option><option>Biology</option><option>English</option><option>Other subject</option></select></label><label>TOPIC HINT / QUESTION<input id="topic-hint" placeholder="যেমন: দ্বিকক্ষবিশিষ্ট আইনসভার পক্ষে ও বিপক্ষে যুক্তি" /></label><label>FILTERING LEVEL<select id="filter-level"><option value="strict">Strict — exact topic</option><option value="balanced" selected>Balanced — topic + examples</option><option value="complete">Complete — full lecture</option></select></label><label>OUTPUT TYPE<select id="output-type"><option value="exam-ready">Exam-ready notes</option><option value="chapter">Detailed textbook chapter</option><option value="revision">Quick revision summary</option><option value="transcript">Clean transcript only</option></select></label></div><label class="preserve-toggle"><input id="preserve-source" type="checkbox" checked /> Preserve original transcript and timestamps</label><div class="topic-panel-footer"><span id="file-status">Source ready · Raw transcript preserved</span><button class="secondary-button" id="save-analysis">Save focus <span>✓</span></button></div></div>`);
  }
  if (notesView && !$('#analysis-panel')) {
    notesView.querySelector('.quote-card')?.insertAdjacentHTML('beforebegin', `<div id="analysis-panel" class="analysis-panel glass-card"><div class="panel-header"><div><span class="eyebrow">EVIDENCE-LINKED FILTER</span><h3>What the engine kept</h3></div><span id="analysis-status" class="success-label"><i></i>Balanced</span></div><p class="control-help">Original transcript stays untouched. Each extracted segment keeps a category, confidence and approximate source time.</p><div id="segment-list" class="segment-list"></div><div class="review-queue"><div><span class="eyebrow">REVIEW QUEUE</span><h4><span id="review-count">0</span> items need your attention</h4></div><div id="review-list"></div></div></div>`);
  }
  const input = $('#audio-input');
  if (input) { input.hidden = false; input.accept = 'audio/*,video/*,.mp3,.m4a,.wav,.aac,.ogg,.flac,.mp4,.m4v,.mov,.webm,.txt,.md'; input.name = 'lecture-file'; input.classList.add('visually-hidden'); }
  if (!document.getElementById('studio-enhancement-styles')) {
    const style = document.createElement('style');
    style.id = 'studio-enhancement-styles';
    style.textContent = `.visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.topic-control-panel,.analysis-panel{border-radius:17px;padding:20px;margin:0 0 17px}.control-help{color:#7f8da6;font-size:10px;line-height:1.6;margin:8px 0 16px}.topic-controls-grid{display:grid;grid-template-columns:1fr 1.5fr 1fr 1fr;gap:10px}.topic-controls-grid label{display:grid;gap:7px;color:#78869c;font-size:8px;letter-spacing:1px;font-weight:700}.topic-controls-grid input,.topic-controls-grid select{width:100%;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.045);color:#dbe5f5;padding:10px;font-size:10px;min-height:38px}.topic-controls-grid option{background:#111727;color:#eef3ff}.preserve-toggle{display:flex;align-items:center;gap:8px;color:#aab7ca;font-size:10px;margin-top:14px}.preserve-toggle input{accent-color:var(--mint)}.topic-panel-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--line);margin-top:15px;padding-top:13px;color:#6f7e95;font-size:9px}.segment-list{display:grid;gap:8px;max-height:360px;overflow:auto}.segment-card{border:1px solid var(--line);border-left:3px solid #718098;border-radius:10px;padding:10px 12px;background:rgba(255,255,255,.025)}.segment-card.kept{border-left-color:var(--mint)}.segment-card.filtered{opacity:.6;border-left-color:var(--gold)}.segment-meta{display:flex;align-items:center;gap:8px;color:#728199;font-size:9px}.segment-meta time{font-variant-numeric:tabular-nums}.segment-meta b{margin-left:auto;color:#9eddd3;font-size:9px}.segment-tag{border-radius:12px;padding:3px 6px;background:rgba(111,228,210,.1);color:#9eddd3;font-size:8px;letter-spacing:.2px}.segment-tag.admin_noise,.segment-tag.off_topic{background:rgba(255,190,115,.1);color:#f0c27f}.segment-tag.unclear_audio{background:rgba(246,154,181,.1);color:#f2a7bd}.segment-card p{color:#c5d1e2;line-height:1.55;font-size:10px;margin:7px 0 0}.review-queue{border-top:1px solid var(--line);margin-top:16px;padding-top:14px}.review-queue h4{font-size:12px;color:#dbe5f4;margin:7px 0 11px}.review-item{display:grid;grid-template-columns:42px 1fr auto;gap:8px;align-items:start;border:1px solid rgba(246,154,181,.16);border-radius:8px;padding:8px;color:#8795aa;font-size:9px}.review-item+ .review-item{margin-top:7px}.review-item span{color:#f1b0c2;font-variant-numeric:tabular-nums}.review-item p{margin:0;line-height:1.5}.review-item b{color:#f1b0c2;font-size:8px}.empty-state{color:#718097;font-size:10px;margin:0;padding:10px 0}@media(max-width:900px){.topic-controls-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.topic-controls-grid{grid-template-columns:1fr}.topic-control-panel,.analysis-panel{padding:15px}.topic-panel-footer{align-items:flex-start;flex-direction:column}.topic-panel-footer button{width:100%}.review-item{grid-template-columns:38px 1fr}.review-item b{grid-column:2}}`;
    document.head.appendChild(style);
  }
}

function fallbackPack(transcript, config = getAnalysisConfig()) {
  const source = transcript || fallbackTranscript;
  return {
    analysis: fallbackAnalyze(source, config),
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
  renderAnalysis(outputs.analysis || fallbackAnalyze(state.transcript));
  $('#summary-content').textContent = outputs.summary || '';
  $('#key-points-list').innerHTML = (outputs.keyPoints || []).map((point) => `<li>${safeText(point)}</li>`).join('');
  $('#definitions-list').innerHTML = (outputs.definitions || []).map((item) => `<div><b>${safeText(item.term)}</b><span>${safeText(item.meaning || item.definition)}</span></div>`).join('');
  renderExamTab('questions');
}

async function generatePack() {
  if (!state.transcript) state.transcript = fallbackTranscript;
  const config = getAnalysisConfig();
  await showLoading('Building your study pack', 'Protecting language, extracting key ideas and shaping your notes…', 1100);
  try {
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: state.transcript, kind: 'study-pack', config }) });
    if (!response.ok) throw new Error(`Generate failed: ${response.status}`);
    const data = await response.json();
    renderOutputs(data.outputs || fallbackPack(state.transcript, config));
    toast(data.mode === 'groq-live' ? 'Live Groq study pack ready.' : 'Study pack ready in demo mode.');
  } catch (error) {
    renderOutputs(fallbackPack(state.transcript, config));
    toast('Study pack ready — offline fallback used.');
  }
  navigate('notes');
}

async function uploadFile(file) {
  if (!file) return;
  if (file.size > 60 * 1024 * 1024) { toast('File is larger than 60 MB. Choose a smaller recording.'); return; }
  state.fileName = file.name || 'lecture-audio';
  localStorage.setItem('lecturebook.fileName', state.fileName);
  if ($('#file-status')) $('#file-status').textContent = `${state.fileName} · ${(file.size / 1024 / 1024).toFixed(1)} MB · Source preserved`;
  await showLoading('Transcribing your lecture', 'Preserving Bengali, English and technical terms…', 800);
  const formData = new FormData();
  formData.append('file', file);
  const config = getAnalysisConfig();
  formData.append('subject', config.subject);
  formData.append('topic_hint', config.topicHint);
  formData.append('filtering', config.filtering);
  formData.append('output_type', config.outputType);
  formData.append('preserve_source', String(config.preserveSource));
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    const response = await fetch('/api/transcribe', { method: 'POST', body: formData, signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    const data = await response.json();
    setTranscript(data.transcript || fallbackTranscript);
    state.analysis = data.analysis || fallbackAnalyze(state.transcript, getAnalysisConfig());
    renderAnalysis(state.analysis);
    toast(data.mode === 'groq-live' ? 'Live transcription complete.' : 'Sample transcript loaded — connect Groq for live audio.');
  } catch (error) {
    setTranscript(fallbackTranscript);
    state.analysis = fallbackAnalyze(state.transcript, getAnalysisConfig());
    renderAnalysis(state.analysis);
    toast(error.name === 'AbortError' ? 'Upload timed out — sample transcript loaded.' : 'Server unavailable — sample transcript loaded.');
  }
  $('#audio-input').value = '';
  navigate('transcript');
}

ensureStudioEnhancements();
function openFilePicker() { const input = $('#audio-input'); if (!input) return; input.value = ''; input.click(); }
$('#upload-trigger').addEventListener('click', openFilePicker);
$('#hero-upload').addEventListener('click', openFilePicker);
$('#browse-button').addEventListener('click', openFilePicker);
$('#audio-input').addEventListener('change', (event) => uploadFile(event.target.files?.[0]));
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
$('#save-analysis').addEventListener('click', () => { localStorage.setItem('lecturebook.analysisConfig', JSON.stringify(getAnalysisConfig())); state.analysis = fallbackAnalyze(state.transcript || fallbackTranscript, getAnalysisConfig()); renderAnalysis(state.analysis); toast('Topic focus saved. Original transcript remains unchanged.'); });
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
const savedAnalysisConfig = JSON.parse(localStorage.getItem('lecturebook.analysisConfig') || 'null');
if (savedAnalysisConfig) {
  if ($('#subject-select')) $('#subject-select').value = savedAnalysisConfig.subject || 'Education';
  if ($('#topic-hint')) $('#topic-hint').value = savedAnalysisConfig.topicHint || '';
  if ($('#filter-level')) $('#filter-level').value = savedAnalysisConfig.filtering || 'balanced';
  if ($('#output-type')) $('#output-type').value = savedAnalysisConfig.outputType || 'exam-ready';
  if ($('#preserve-source')) $('#preserve-source').checked = savedAnalysisConfig.preserveSource !== false;
}
if (!state.transcript) setTranscript(fallbackTranscript);
renderAnalysis(state.analysis || fallbackAnalyze(state.transcript, getAnalysisConfig()));
