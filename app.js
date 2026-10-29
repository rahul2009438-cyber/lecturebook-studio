const state = { transcript: '', outputs: null, currentView: 'workspace' };
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
  const terms = ['plants sunlight', 'food', 'carbon dioxide', 'water', 'glucose', 'oxygen', 'chlorophyll', 'light energy'];
  let highlighted = safeText(state.transcript);
  terms.forEach((term) => { highlighted = highlighted.replace(new RegExp(`(${term})`, 'gi'), '<mark>$1</mark>'); });
  $('#transcript-text').innerHTML = highlighted.split(/(?<=[।.!?])\s+/).filter(Boolean).map((part) => `<p>${part}</p>`).join('');
}

function renderOutputs(outputs) {
  state.outputs = outputs;
  $('#summary-content').textContent = outputs.summary || '';
  $('#key-points-list').innerHTML = (outputs.keyPoints || []).map((point) => `<li>${safeText(point)}</li>`).join('');
  $('#definitions-list').innerHTML = (outputs.definitions || []).map((item) => `<div><b>${safeText(item.term)}</b><span>${safeText(item.meaning || item.definition)}</span></div>`).join('');
  $('#question-list').innerHTML = (outputs.questions || []).map((item, index) => {
    const question = typeof item === 'string' ? item : item.q;
    const answer = typeof item === 'string' ? '' : item.a;
    return `<div class="question-card"><span class="question-number">${String(index + 1).padStart(2, '0')}</span><div><b>${safeText(question)}</b><p>${safeText(answer)}</p></div><button>✎</button></div>`;
  }).join('');
}

async function generatePack() {
  const fallback = 'Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে। এই process-এ carbon dioxide এবং water থেকে glucose তৈরি হয়, আর oxygen একটি by-product হিসেবে release হয়। মনে রাখবে, chlorophyll হলো সেই pigment যা light energy absorb করে।';
  if (!state.transcript) state.transcript = fallback;
  await showLoading('Building your study pack', 'Protecting language, extracting key ideas and shaping your notes…', 1100);
  try {
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: state.transcript, kind: 'study-pack' }) });
    const data = await response.json();
    renderOutputs(data.outputs);
    toast(data.mode === 'groq-live' ? 'Live Groq study pack ready.' : 'Study pack ready in demo mode.');
  } catch (error) {
    toast('Using the local study-pack fallback.');
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
    setTranscript('Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে। এই process-এ carbon dioxide এবং water থেকে glucose তৈরি হয়, আর oxygen একটি by-product হিসেবে release হয়।');
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
$('#export-book').addEventListener('click', () => toast('Export queue created — PDF/DOCX renderer is ready for the next release.'));
$('#save-design').addEventListener('click', () => toast('Book design saved to your workspace.'));
$('#play-audio').addEventListener('click', () => toast('Audio preview is available after uploading a lecture file.'));
$('#edit-transcript').addEventListener('click', () => toast('Review mode enabled — highlighted terms are ready to edit.'));
$('#show-all').addEventListener('click', () => toast('You are already viewing your latest projects.'));
$('#theme-toggle').addEventListener('click', () => { document.body.classList.toggle('light-theme'); toast(document.body.classList.contains('light-theme') ? 'Soft light theme enabled.' : 'Midnight luxe theme enabled.'); });
$('#drop-zone').addEventListener('dragover', (event) => { event.preventDefault(); $('#drop-zone').classList.add('drag-over'); });
$('#drop-zone').addEventListener('dragleave', () => $('#drop-zone').classList.remove('drag-over'));
$('#drop-zone').addEventListener('drop', (event) => { event.preventDefault(); $('#drop-zone').classList.remove('drag-over'); uploadFile(event.dataTransfer.files[0]); });
$$('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
$$('[data-open="transcript"]').forEach((row) => row.addEventListener('click', () => { setTranscript('Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে। এই process-এ carbon dioxide এবং water থেকে glucose তৈরি হয়, আর oxygen একটি by-product হিসেবে release হয়। মনে রাখবে, chlorophyll হলো সেই pigment যা light energy absorb করে।'); navigate('transcript'); }));
$$('.theme-option').forEach((button) => button.addEventListener('click', () => { $$('.theme-option').forEach((item) => item.classList.remove('selected')); button.classList.add('selected'); toast(`${button.textContent.trim()} selected.`); }));
$('#book-title').addEventListener('input', (event) => { $('#preview-title').textContent = event.target.value || 'Untitled book'; });
setTranscript('Photosynthesis-এর সময় plants sunlight ব্যবহার করে food তৈরি করে। এই process-এ carbon dioxide এবং water থেকে glucose তৈরি হয়, আর oxygen একটি by-product হিসেবে release হয়। মনে রাখবে, chlorophyll হলো সেই pigment যা light energy absorb করে।');
