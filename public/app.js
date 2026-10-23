const $ = selector => document.querySelector(selector);
const dialog = $('#onboarding');

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 3200);
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Something went wrong');
  return value;
}

for (const id of ['start', 'finalStart', 'login']) $(`#${id}`).onclick = () => dialog.showModal();
$('.close').onclick = () => dialog.close();
$('#saveChild').onclick = async () => {
  const button = $('#saveChild');
  button.disabled = true;
  try {
    const name = $('#childName').value.trim() || 'Your learner';
    const ageBand = dialog.querySelector('select').value.replace('–', '-');
    const voiceEnabled = dialog.querySelector('input[type=checkbox]').checked;
    await api('/api/children', { method: 'POST', body: JSON.stringify({ displayName: name, ageBand, voiceEnabled }) });
    dialog.close();
    toast(`${name}’s protected profile is ready. Opening your family space…`);
    setTimeout(() => { location.href = '/family.html'; }, 900);
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
};
$('#demo').onclick = () => $('#tvDemo').scrollIntoView({ behavior: 'smooth' });
$('#copyInvite').onclick = () => {
  navigator.clipboard?.writeText('https://tenderteddy.com/invite/family-7KQ');
  toast('Family invite copied—no child details are included.');
};

let attempt = 0;
document.querySelectorAll('[data-answer]').forEach(button => {
  button.onclick = () => {
    attempt += 1;
    const correct = button.dataset.answer === 'ball';
    if (correct) {
      $('#feedback').innerHTML = '<b>That’s it! B-b-ball.</b> You earned 3 kindness stars ★★★';
      document.querySelectorAll('.lesson-side li').forEach(item => item.classList.add('active'));
      button.classList.add('correct');
    } else {
      $('#feedback').innerHTML = attempt === 1 ? '<b>Good thinking.</b> Stretch the sound with me: b-b-b… Which one begins that way?' : 'Let’s tap each picture and say its first sound together.';
      button.classList.add('try');
      document.querySelectorAll('.lesson-side li')[2].classList.add('active');
    }
  };
});
$('#resetLesson').onclick = () => {
  attempt = 0; $('#feedback').textContent = 'You can say it, or use the TV remote.';
  document.querySelectorAll('[data-answer]').forEach(item => { item.className = ''; });
  document.querySelectorAll('.lesson-side li').forEach((item, index) => item.classList.toggle('active', index === 0));
};
