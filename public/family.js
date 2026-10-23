const titles = { today: 'Your family learning space', library: 'Trusted library', lesson: 'Sound Safari', progress: 'Learning at a glance', settings: 'Family controls' };
let family = null;
let activeSession = null;
let pendingLesson = null;

function open(id) {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item.id === id));
  document.querySelectorAll('aside button').forEach(item => item.classList.toggle('active', item.dataset.tab === id));
  document.querySelector('#title').textContent = titles[id];
}

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message; element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Something went wrong');
  return value;
}

function render() {
  const child = family?.children?.[0];
  if (!child) {
    document.querySelector('#title').textContent = 'Create a child profile to begin';
    document.querySelector('#today').innerHTML = `<div class="welcome"><div><span>FIRST, SET UP YOUR FAMILY SPACE</span><h2>One safe profile.<br><em>Then the adventure begins.</em></h2><p>Add a display name and age band, then choose whether voice is available. Raw audio stays off.</p><a class="primary" style="text-decoration:none;display:inline-block" href="/">Create a safe profile</a></div><div class="pye"><i></i><i></i><div>π</div><p>Pye is ready!</p></div></div>`;
    toast('Start on the home page to create a protected child profile.');
    return;
  }
  document.querySelector('.child').textContent = child.avatar || child.displayName[0];
  document.querySelector('#familyLabel').textContent = `${child.displayName.toUpperCase()}’S LEARNING SPACE`;
  document.querySelector('#title').textContent = `Welcome back, ${child.displayName}’s family.`;
  document.querySelector('#learnerGreeting').textContent = `${child.displayName}, Pye is ready!`;
  document.querySelector('#progressTitle').textContent = `What ${child.displayName} practised`;
  const nameInput = document.querySelector('.settings input[value]');
  if (nameInput) nameInput.value = child.displayName;
  const toggles = document.querySelectorAll('.settings input[type=checkbox]');
  if (toggles[0]) toggles[0].checked = child.voiceEnabled;
  if (toggles[1]) toggles[1].checked = false;
  if (toggles[2]) toggles[2].checked = child.personalisedPractice;
  const range = document.querySelector('.settings input[type=range]');
  if (range) range.value = child.dailyLimitMinutes;

  const progress = family.progress.filter(item => item.childId === child.id);
  const recent = document.querySelector('.progress-grid article:nth-child(2)');
  if (recent && progress.length) {
    const item = progress.at(-1);
    recent.querySelector('h3').textContent = item.attempts === 1 ? 'Solved on the first try' : `Solved after ${item.attempts} tries`;
    recent.querySelector('p').textContent = `${child.displayName} practised ${item.skill} with ${item.hintsUsed} hint${item.hintsUsed === 1 ? '' : 's'}.`;
  }
  const lesson = family.lessons.find(item => item.childId === child.id && item.status === 'approved');
  const startButton = document.querySelector('#startLesson');
  const childProgress = family.progress.filter(item => item.childId === child.id);
  document.querySelector('#completedCount').textContent = String(childProgress.length);
  document.querySelector('#currentLesson').textContent = lesson?.title || 'No approved lesson yet';
  document.querySelector('#lessonStatus').textContent = lesson ? 'Ready on this device and Fire TV.' : 'Start in the trusted library.';
  document.querySelector('#lessonBar').style.width = lesson ? '100%' : '0';
  document.querySelector('#nextStep').textContent = childProgress.length ? `Practise ${childProgress.at(-1).skill} again` : 'Approve a first checkpoint';
  if (lesson) {
    document.querySelector('#adventureLabel').textContent = 'YOUR APPROVED LESSON IS READY';
    document.querySelector('#adventureTitle').textContent = `${lesson.title} — one playful checkpoint.`;
    document.querySelector('#adventureCopy').textContent = 'Use the remote or optional voice input. Raw audio is never stored.';
    startButton.textContent = 'Start on this device'; startButton.dataset.open = 'lesson';
  } else {
    startButton.textContent = 'Create the first lesson'; startButton.dataset.open = 'library';
  }
  const checkpoint = lesson?.checkpoints?.[0];
  if (checkpoint) {
    document.querySelector('.checkpoint h2').textContent = checkpoint.prompt;
    const choices = checkpoint.choices?.length ? checkpoint.choices : [checkpoint.acceptedAnswers[0], 'cat', 'sun'];
    document.querySelectorAll('[data-answer]').forEach((button, index) => {
      const value = choices[index] || choices[0];
      button.dataset.answer = value;
      const label = button.querySelector('b'); if (label) label.textContent = value;
    });
  }
}

async function refresh() { family = await api('/api/family'); render(); }

async function ensureSession() {
  if (activeSession) return activeSession;
  const approved = family.lessons.find(item => item.status === 'approved');
  if (!approved) throw new Error('Review and approve content in the Library first.');
  activeSession = await api('/api/sessions', { method: 'POST', body: JSON.stringify({ lessonId: approved.id }) });
  return activeSession;
}

document.querySelectorAll('[data-tab]').forEach(button => { button.onclick = () => open(button.dataset.tab); });
document.querySelectorAll('[data-open]').forEach(button => { button.onclick = () => open(button.dataset.open); });
const modal = document.querySelector('dialog');
document.querySelectorAll('#addContent,#discover').forEach(button => { button.onclick = () => modal.showModal(); });
document.querySelector('.close').onclick = () => modal.close();

document.querySelector('#review').onclick = async () => {
  const button = document.querySelector('#review'); button.disabled = true;
  try {
    if (!family.children.length) throw new Error('Create a child profile before approving a lesson.');
    const url = document.querySelector('#contentUrl').value.trim();
    const content = await api('/api/content/review', {
      method: 'POST', body: JSON.stringify({ url, rightsBasis: 'Parent-confirmed official embeddable link', embeddable: true, madeForKidsChecked: true })
    });
    const draft = await api('/api/ai/lesson-draft', {
      method: 'POST', body: JSON.stringify({ childId: family.children[0].id, contentId: content.id,
        skill: document.querySelector('#lessonSkill').value, learningGoal: document.querySelector('#learningGoal').value })
    });
    pendingLesson = { content, draft };
    document.querySelector('#draftTitle').textContent = draft.title;
    document.querySelector('#draftPrompt').textContent = draft.prompt;
    document.querySelector('#draftHint').textContent = `Hint: ${draft.hints[0]}`;
    document.querySelector('#draftPreview').hidden = false;
    document.querySelector('#approveDraft').hidden = false;
    button.hidden = true;
    toast('Gemini created a candidate. Review it before approving.');
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
};

document.querySelector('#approveDraft').onclick = async () => {
  const button = document.querySelector('#approveDraft'); button.disabled = true;
  try {
    if (!pendingLesson) throw new Error('Generate a lesson draft first.');
    const { content, draft } = pendingLesson;
    await api('/api/lessons', { method: 'POST', body: JSON.stringify({ childId: family.children[0].id, contentId: content.id,
      title: draft.title, skill: draft.skill, prompt: draft.prompt, acceptedAnswers: draft.acceptedAnswers,
      choices: draft.choices, hints: draft.hints, explanation: draft.explanation, parentApproved: true }) });
    modal.close(); pendingLesson = null; await refresh(); open('lesson');
    toast('Parent-approved AI lesson is ready to play.');
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
};

document.querySelectorAll('[data-answer]').forEach(button => {
  button.onclick = async () => {
    try {
      const session = await ensureSession();
      const result = await api(`/api/sessions/${session.id}/answer`, {
        method: 'POST', body: JSON.stringify({ answer: button.dataset.answer, channel: 'fire-tv-remote' })
      });
      document.querySelector('#hint').textContent = result.reply;
      button.style.borderColor = result.correct ? '#64a56f' : '#ed765d';
      if (result.correct) { activeSession = null; await refresh(); toast('Checkpoint saved to the parent progress view.'); }
    } catch (error) { toast(error.message); }
  };
});

document.querySelector('#reset').onclick = () => {
  activeSession = null;
  document.querySelector('#hint').textContent = 'Say your answer, or choose with the remote.';
  document.querySelectorAll('[data-answer]').forEach(button => { button.style.borderColor = ''; });
};

document.querySelector('#parentGate').onclick = () => open('settings');
document.querySelectorAll('.settings input').forEach(input => {
  input.addEventListener('change', async () => {
    const child = family.children[0]; if (!child) return;
    const inputs = document.querySelectorAll('.settings input[type=checkbox]');
    try {
      await api(`/api/children/${child.id}`, {
        method: 'PATCH', body: JSON.stringify({
          displayName: document.querySelector('.settings input[value]').value,
          voiceEnabled: inputs[0].checked, personalisedPractice: inputs[2].checked,
          dailyLimitMinutes: Number(document.querySelector('.settings input[type=range]').value)
        })
      });
      await refresh(); toast('Family settings saved. Raw audio remains off.');
    } catch (error) { toast(error.message); }
  });
});

document.querySelector('#exportChild').onclick = () => {
  const child = family?.children?.[0];
  if (!child) return toast('There is no child profile to export.');
  const lessonIds = new Set(family.lessons.filter(item => item.childId === child.id).map(item => item.id));
  const exportData = {
    exportedAt: new Date().toISOString(),
    child,
    lessons: family.lessons.filter(item => item.childId === child.id),
    sessions: family.sessions.filter(item => item.childId === child.id || lessonIds.has(item.lessonId)),
    progress: family.progress.filter(item => item.childId === child.id)
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tenderteddy-${child.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'child'}-export.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast('Child data export downloaded.');
};

document.querySelector('#deleteChild').onclick = async () => {
  const child = family?.children?.[0];
  if (!child) return toast('There is no child profile to delete.');
  if (!confirm(`Delete ${child.displayName} and all of their lessons and progress? This cannot be undone.`)) return;
  try {
    await api(`/api/children/${child.id}`, { method: 'DELETE' });
    activeSession = null; pendingLesson = null; await refresh();
    toast('Child profile and learning records deleted.');
  } catch (error) { toast(error.message); }
};

refresh().catch(error => toast(error.message));
