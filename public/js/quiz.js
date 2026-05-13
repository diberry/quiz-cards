// quiz.js — quiz mode UI

import { apiFetch, showView, showToast } from './app.js';

let quizCards = [];
let quizIndex = 0;
let quizScore = 0;
let quizDeckId = null;

export async function startQuiz(deckId) {
  quizDeckId = deckId;
  quizScore = 0;
  quizIndex = 0;

  let data;
  try {
    data = await apiFetch(`/api/quiz/start/${deckId}`, { method: 'POST' });
  } catch (err) {
    showToast(err.message);
    return;
  }

  quizCards = data.cards;

  showView('quiz');
  renderQuizQuestion();

  document.getElementById('btn-back-from-quiz').onclick = () => {
    showView('deck-detail');
  };
}

function renderQuizQuestion() {
  const body = document.getElementById('quiz-body');

  if (quizIndex >= quizCards.length) {
    renderQuizResults();
    return;
  }

  const card = quizCards[quizIndex];
  body.innerHTML = `
    <div class="quiz-progress">Question ${quizIndex + 1} of ${quizCards.length} &nbsp;·&nbsp; Score: ${quizScore}</div>
    <div class="quiz-question">
      <div class="quiz-term">${esc(card.term)}</div>
      <input class="quiz-answer-input" id="quiz-input" type="text"
        placeholder="Type the definition…" autocomplete="off" />
      <div class="quiz-feedback" id="quiz-feedback"></div>
      <button class="btn btn-primary" id="btn-submit-answer">Submit</button>
    </div>`;

  const input = document.getElementById('quiz-input');
  const submitBtn = document.getElementById('btn-submit-answer');

  input.focus();
  input.addEventListener('keydown', e => { if (e.key === 'Enter') checkAnswer(); });
  submitBtn.addEventListener('click', checkAnswer);
}

function normalise(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function checkAnswer() {
  const input = document.getElementById('quiz-input');
  const feedback = document.getElementById('quiz-feedback');
  const submitBtn = document.getElementById('btn-submit-answer');

  const card = quizCards[quizIndex];
  const userAnswer = input.value;
  const correct = normalise(userAnswer) === normalise(card.definition);

  input.disabled = true;
  submitBtn.disabled = true;

  if (correct) {
    quizScore++;
    input.classList.add('correct');
    feedback.textContent = '✓ Correct!';
    feedback.className = 'quiz-feedback correct';
  } else {
    input.classList.add('incorrect');
    feedback.innerHTML = `✗ The answer was: <strong>${esc(card.definition)}</strong>`;
    feedback.className = 'quiz-feedback incorrect';
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn btn-primary';
  nextBtn.style.marginTop = '12px';
  nextBtn.textContent = quizIndex < quizCards.length - 1 ? 'Next Question →' : 'See Results';
  nextBtn.addEventListener('click', () => {
    quizIndex++;
    renderQuizQuestion();
  });
  submitBtn.parentNode.appendChild(nextBtn);
}

async function renderQuizResults() {
  const body = document.getElementById('quiz-body');
  const total = quizCards.length;
  const pct = total > 0 ? Math.round((quizScore / total) * 100) : 0;

  body.innerHTML = `
    <div class="quiz-score-card">
      <div class="quiz-score-number">${pct}%</div>
      <p>${quizScore} of ${total} correct</p>
      <p style="margin-top:16px;color:var(--color-text-muted)">${resultMessage(pct)}</p>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" id="btn-retake">Retake Quiz</button>
        <button class="btn btn-ghost" id="btn-back-to-deck">Back to Deck</button>
      </div>
    </div>`;

  document.getElementById('btn-retake').addEventListener('click', () => startQuiz(quizDeckId));
  document.getElementById('btn-back-to-deck').addEventListener('click', () => showView('deck-detail'));

  // Save score
  try {
    await apiFetch(`/api/quiz/submit/${quizDeckId}`, {
      method: 'POST',
      body: JSON.stringify({ score: quizScore, total }),
    });
  } catch { /* non-critical */ }
}

function resultMessage(pct) {
  if (pct === 100) return '🎉 Perfect score!';
  if (pct >= 80) return '💪 Great work!';
  if (pct >= 60) return '📚 Keep studying!';
  return '🔄 Keep practicing — you\'ll get it!';
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
