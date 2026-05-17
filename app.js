// HSC Business Studies — past paper practice app
// All data lives in questions.json. Answers persist in localStorage.

const STORAGE_KEY = "hsc-bs-answers-v1";
const COLLAPSE_KEY = "hsc-bs-collapsed-v1";

const state = {
  data: null,
  current: null,        // current question object
  filter: "all",        // mcq | short | report | extended | all
  search: "",
  answers: loadAnswers(),
  collapsed: loadCollapsed(),
};

// ===== Storage =====
function loadAnswers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveAnswers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.answers));
}
function loadCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || []); }
  catch { return new Set(); }
}
function saveCollapsed() {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...state.collapsed]));
}

// ===== Boot =====
async function boot() {
  try {
    const res = await fetch("questions.json");
    state.data = await res.json();
  } catch (err) {
    document.getElementById("content").innerHTML =
      `<div class="welcome"><h2>Couldn't load questions.json</h2>
       <p class="lede">Make sure questions.json sits next to index.html.</p></div>`;
    return;
  }
  buildSidebar();
  attachSidebarEvents();
  updateProgressSummary();
}

// ===== Sidebar tree =====
function buildSidebar() {
  const tree = document.getElementById("topic-tree");
  tree.innerHTML = "";

  const q = state.search.toLowerCase().trim();

  for (const topic of state.data.topics) {
    const topicEl = document.createElement("div");
    topicEl.className = "topic";
    if (state.collapsed.has(topic.id)) topicEl.classList.add("collapsed");

    const totalQs = topic.subtopics.reduce((n, s) => n + filterQs(s.questions).length, 0);
    if (totalQs === 0 && (state.filter !== "all" || q)) continue;

    topicEl.innerHTML = `
      <button class="topic-header" data-topic="${topic.id}">
        <span class="chevron">▼</span>
        ${topic.name}
        <span class="topic-count">${totalQs}</span>
      </button>
      <div class="subtopics"></div>
    `;
    const subWrap = topicEl.querySelector(".subtopics");

    for (const sub of topic.subtopics) {
      const qs = filterQs(sub.questions);
      if (qs.length === 0) continue;

      const subEl = document.createElement("div");
      subEl.className = "subtopic";
      subEl.innerHTML = `<div class="subtopic-header">${sub.name}</div>`;

      for (const ques of qs) {
        const isAnswered = !!state.answers[ques.id]?.answer;
        const isActive = state.current?.id === ques.id;
        const btn = document.createElement("button");
        btn.className = "q-link" +
          (isAnswered ? " answered" : "") +
          (isActive ? " active" : "");
        btn.dataset.qid = ques.id;
        btn.innerHTML = `
          <span class="q-meta">${ques.year}·${(ques.type || "").toUpperCase().slice(0,3)}</span>
          <span class="q-text">${escapeHtml(ques.prompt).slice(0, 90)}</span>
        `;
        subEl.appendChild(btn);
      }
      subWrap.appendChild(subEl);
    }
    tree.appendChild(topicEl);
  }
}

function filterQs(qs) {
  return qs.filter(q => {
    if (state.filter !== "all" && q.type !== state.filter) return false;
    if (state.search) {
      const hay = (q.prompt + " " + q.year).toLowerCase();
      if (!hay.includes(state.search.toLowerCase())) return false;
    }
    return true;
  });
}

function attachSidebarEvents() {
  document.getElementById("topic-tree").addEventListener("click", e => {
    const topicBtn = e.target.closest(".topic-header");
    if (topicBtn) {
      const tid = topicBtn.dataset.topic;
      if (state.collapsed.has(tid)) state.collapsed.delete(tid);
      else state.collapsed.add(tid);
      saveCollapsed();
      buildSidebar();
      return;
    }
    const qBtn = e.target.closest(".q-link");
    if (qBtn) loadQuestion(qBtn.dataset.qid);
  });

  document.getElementById("search").addEventListener("input", e => {
    state.search = e.target.value;
    buildSidebar();
  });

  document.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.filter = btn.dataset.type;
      buildSidebar();
    });
  });
}

// ===== Question view =====
function loadQuestion(qid) {
  const found = findQuestion(qid);
  if (!found) return;
  state.current = found.question;
  renderQuestion(found.question, found.topic, found.subtopic);
  buildSidebar();
}

function findQuestion(qid) {
  for (const topic of state.data.topics) {
    for (const sub of topic.subtopics) {
      const question = sub.questions.find(q => q.id === qid);
      if (question) return { question, topic, subtopic: sub };
    }
  }
  return null;
}

function renderQuestion(q, topic, subtopic) {
  const content = document.getElementById("content");
  const saved = state.answers[q.id] || {};

  const stimulusHtml = q.stimulus
    ? `<div class="q-stimulus">${escapeHtml(q.stimulus)}</div>` : "";

  const answerArea = q.type === "mcq"
    ? renderMCQ(q, saved)
    : renderTextAnswer(q, saved);

  content.innerHTML = `
    <article class="q-view">
      <div class="q-breadcrumb">
        ${topic.name} <span class="sep">›</span> ${subtopic.name}
      </div>
      <div class="q-meta-bar">
        <span class="tag year">${q.year} HSC</span>
        <span class="tag">${typeLabel(q.type)}</span>
        ${q.marks ? `<span class="tag marks">${q.marks} mark${q.marks > 1 ? "s" : ""}</span>` : ""}
      </div>
      <h2 class="q-prompt">${escapeHtml(q.prompt)}</h2>
      ${stimulusHtml}

      <div class="section-label">Your Answer</div>
      ${answerArea}

      ${renderRevealPanels(q)}
    </article>
  `;

  attachQuestionEvents(q);
}

function renderTextAnswer(q, saved) {
  const wordCount = (saved.answer || "").trim().split(/\s+/).filter(Boolean).length;
  const target = q.suggested_words || suggestedWords(q.type);
  return `
    <textarea
      class="answer-box"
      id="answer-box"
      data-type="${q.type}"
      placeholder="Type your response here…"
    >${escapeHtml(saved.answer || "")}</textarea>
    <div class="word-count">
      <span id="word-count-display">${wordCount} words</span>
      ${target ? `<span>Suggested: ~${target} words</span>` : ""}
    </div>
    <div class="action-row">
      <button class="btn btn-primary" id="copy-marking">Copy for AI marking</button>
      <button class="btn" id="clear-answer">Clear answer</button>
    </div>
  `;
}

function renderMCQ(q, saved) {
  const selected = saved.answer || "";
  const submitted = saved.submitted;
  return `
    <ul class="mcq-options" id="mcq-list">
      ${q.options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        let cls = "";
        if (submitted && selected === letter) {
          cls = letter === q.correct ? "correct" : "incorrect";
        } else if (selected === letter) {
          cls = "selected";
        }
        if (submitted && letter === q.correct) cls = "correct";
        return `
          <li class="${cls}" data-letter="${letter}">
            <span class="mcq-letter">${letter}.</span>
            <span>${escapeHtml(opt)}</span>
          </li>`;
      }).join("")}
    </ul>
    <div class="action-row">
      <button class="btn btn-primary" id="submit-mcq" ${!selected ? "disabled" : ""}>
        ${submitted ? "Reset" : "Check answer"}
      </button>
    </div>
  `;
}

function renderRevealPanels(q) {
  const criteriaHtml = q.criteria && q.criteria.length
    ? q.criteria.map(c => `
        <div class="criteria-band">
          <div class="band">${escapeHtml(c.band || "")}</div>
          <div>${escapeHtml(c.description || "")}</div>
        </div>`).join("")
    : "<p>Add marking criteria for this question in questions.json.</p>";

  const exemplarHtml = q.exemplar
    ? `<p>${escapeHtml(q.exemplar).replace(/\n\n/g, "</p><p>")}</p>`
    : "<p>Add a model band 6 response in questions.json.</p>";

  if (q.type === "mcq") {
    return `
      <details class="reveal">
        <summary>Explanation</summary>
        <div class="reveal-body">
          <p>${escapeHtml(q.explanation || "Add an explanation in questions.json.")}</p>
        </div>
      </details>
    `;
  }

  return `
    <details class="reveal">
      <summary>Marking criteria</summary>
      <div class="reveal-body">${criteriaHtml}</div>
    </details>
    <details class="reveal">
      <summary>Model response (Band 6)</summary>
      <div class="reveal-body">${exemplarHtml}</div>
    </details>
  `;
}

// ===== Events on question view =====
function attachQuestionEvents(q) {
  if (q.type === "mcq") {
    const list = document.getElementById("mcq-list");
    const submitBtn = document.getElementById("submit-mcq");

    list.addEventListener("click", e => {
      const li = e.target.closest("li");
      if (!li) return;
      const saved = state.answers[q.id] || {};
      if (saved.submitted) return;
      list.querySelectorAll("li").forEach(x => x.classList.remove("selected"));
      li.classList.add("selected");
      state.answers[q.id] = { ...saved, answer: li.dataset.letter };
      saveAnswers();
      submitBtn.disabled = false;
    });

    submitBtn.addEventListener("click", () => {
      const saved = state.answers[q.id] || {};
      if (saved.submitted) {
        state.answers[q.id] = { ...saved, submitted: false };
      } else {
        state.answers[q.id] = { ...saved, submitted: true };
      }
      saveAnswers();
      renderQuestion(q,
        findQuestion(q.id).topic,
        findQuestion(q.id).subtopic);
      buildSidebar();
      updateProgressSummary();
    });
    return;
  }

  // Text answers
  const box = document.getElementById("answer-box");
  const wc = document.getElementById("word-count-display");

  box.addEventListener("input", () => {
    const text = box.value;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    wc.textContent = `${words} words`;
    state.answers[q.id] = { ...state.answers[q.id], answer: text };
    saveAnswers();
    updateProgressSummary();
  });

  // Debounced sidebar refresh so the answered dot updates without lag
  let refreshTimer;
  box.addEventListener("input", () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(buildSidebar, 600);
  });

  document.getElementById("copy-marking").addEventListener("click", () => {
    copyMarkingPrompt(q);
  });

  document.getElementById("clear-answer").addEventListener("click", () => {
    if (!confirm("Clear your answer for this question?")) return;
    delete state.answers[q.id];
    saveAnswers();
    renderQuestion(q,
      findQuestion(q.id).topic,
      findQuestion(q.id).subtopic);
    buildSidebar();
    updateProgressSummary();
  });
}

// ===== Copy-for-marking =====
function copyMarkingPrompt(q) {
  const saved = state.answers[q.id] || {};
  const answer = saved.answer || "(no answer written yet)";

  const criteriaText = q.criteria && q.criteria.length
    ? q.criteria.map(c => `- ${c.band}: ${c.description}`).join("\n")
    : "(no criteria provided)";

  const prompt = `You are an experienced HSC Business Studies marker. Mark the following student response strictly according to the NESA marking criteria below.

QUESTION (${q.year} HSC, ${q.marks || "?"} marks):
${q.prompt}
${q.stimulus ? `\nStimulus: ${q.stimulus}` : ""}

MARKING CRITERIA:
${criteriaText}

${q.exemplar ? `BAND 6 MODEL RESPONSE FOR REFERENCE:\n${q.exemplar}\n` : ""}
STUDENT RESPONSE:
${answer}

Please:
1. Award a mark out of ${q.marks || "the available marks"} and identify the band.
2. List 3 specific strengths.
3. List 3 specific things to improve, quoting from the student's response where helpful.
4. Suggest how to redraft the weakest paragraph to push it to band 6.
5. Note any missing syllabus content (e.g. case studies, theory, business examples).

Be direct and specific. Don't pad with praise.`;

  navigator.clipboard.writeText(prompt).then(() => {
    const btn = document.getElementById("copy-marking");
    btn.textContent = "Copied — paste into Claude.ai";
    btn.classList.add("copied");
    showToast("Marking prompt copied. Open Claude.ai and paste.");
    setTimeout(() => {
      btn.textContent = "Copy for AI marking";
      btn.classList.remove("copied");
    }, 3000);
  }).catch(() => {
    showToast("Couldn't access clipboard. Select the answer and copy manually.");
  });
}

// ===== Progress =====
function updateProgressSummary() {
  let total = 0, done = 0;
  for (const t of state.data.topics) {
    for (const s of t.subtopics) {
      for (const q of s.questions) {
        total++;
        if (state.answers[q.id]?.answer) done++;
      }
    }
  }
  document.getElementById("progress-summary").textContent =
    `${done} of ${total} answered`;
}

// ===== Helpers =====
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function typeLabel(t) {
  return { mcq: "Multiple Choice", short: "Short Answer",
           report: "Business Report", extended: "Extended Response" }[t] || t;
}

function suggestedWords(type) {
  return { short: 100, report: 800, extended: 1000 }[type] || null;
}

function showToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

boot();
