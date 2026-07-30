(function () {
  "use strict";

  const data = window.ONCOLOGY_EXAM_DATA;
  if (!data || !Array.isArray(data.questions)) {
    throw new Error("题库数据未加载");
  }

  const STORAGE_KEY = "oncology-exam-progress-v1";
  const state = {
    activeGroup: data.groups[0].id,
    search: "",
    status: "all",
    answers: loadAnswers()
  };

  const elements = {
    tabs: document.querySelector("#tabs"),
    list: document.querySelector("#question-list"),
    empty: document.querySelector("#empty-state"),
    search: document.querySelector("#search-input"),
    status: document.querySelector("#status-filter"),
    sectionTitle: document.querySelector("#section-title"),
    sectionSummary: document.querySelector("#section-summary"),
    progressFill: document.querySelector("#progress-fill"),
    totalCount: document.querySelector("#total-count"),
    completedCount: document.querySelector("#completed-count"),
    correctCount: document.querySelector("#correct-count"),
    accuracyRate: document.querySelector("#accuracy-rate"),
    resetSection: document.querySelector("#reset-section"),
    resetAll: document.querySelector("#reset-all"),
    backToTop: document.querySelector("#back-to-top")
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadAnswers() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveAnswers() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.answers));
  }

  function answerState(questionId) {
    return state.answers[questionId] || {
      selected: [],
      checked: false,
      correct: false,
      revealed: false
    };
  }

  function sameLetters(left, right) {
    return [...left].sort().join("") === [...right].sort().join("");
  }

  function groupQuestions(groupId) {
    return data.questions.filter((question) => question.groupId === groupId);
  }

  function matchesStatus(question) {
    const answer = answerState(question.id);
    if (state.status === "unanswered") return !answer.checked;
    if (state.status === "correct") return answer.checked && answer.correct;
    if (state.status === "incorrect") return answer.checked && !answer.correct;
    if (state.status === "revealed") return answer.revealed;
    return true;
  }

  function visibleQuestions() {
    const needle = state.search.trim().toLocaleLowerCase("zh-CN");
    return groupQuestions(state.activeGroup).filter((question) => {
      const searchable = [
        question.stem,
        question.answerText,
        ...question.options.map((option) => option.text)
      ].join(" ").toLocaleLowerCase("zh-CN");
      return (!needle || searchable.includes(needle)) && matchesStatus(question);
    });
  }

  function renderTabs() {
    elements.tabs.innerHTML = data.groups.map((group) => {
      const count = groupQuestions(group.id).length;
      const selected = group.id === state.activeGroup;
      return `<button class="tab" type="button" role="tab" data-group="${escapeHtml(group.id)}" aria-selected="${selected}">
        ${escapeHtml(group.title)}<small>${count}</small>
      </button>`;
    }).join("");
  }

  function sourceLabel(question) {
    const pages = [...new Set(question.sources.map((source) => source.page))];
    const occurrence = question.sources.length > 1 ? ` · 原卷出现 ${question.sources.length} 次` : "";
    return `来源页 ${pages.join("、")}${occurrence}`;
  }

  function renderQuestion(question, visibleIndex) {
    const answer = answerState(question.id);
    const inputType = question.correct.length > 1 ? "checkbox" : "radio";
    const result = answer.checked ? (answer.correct ? "correct" : "incorrect") : "";
    const options = question.options.map((option) => {
      const selected = answer.selected.includes(option.letter);
      const correctClass = answer.checked && question.correct.includes(option.letter) ? " is-correct" : "";
      const wrongClass = answer.checked && selected && !question.correct.includes(option.letter) ? " is-wrong" : "";
      return `<label class="option${correctClass}${wrongClass}">
        <input type="${inputType}" name="${escapeHtml(question.id)}" value="${escapeHtml(option.letter)}" ${selected ? "checked" : ""}>
        <span class="option__letter">${escapeHtml(option.letter)}</span>
        <span>${escapeHtml(option.text)}</span>
      </label>`;
    }).join("");

    const message = answer.checked
      ? answer.correct
        ? "回答正确"
        : "答案不完全正确，可调整后再次提交"
      : "";
    const messageClass = answer.checked
      ? answer.correct ? " is-correct" : " is-incorrect"
      : "";

    return `<article class="question-card" data-id="${escapeHtml(question.id)}" data-result="${result}">
      <div class="question-meta">
        <span class="pill">${escapeHtml(question.type)}</span>
        <span>本区第 ${visibleIndex + 1} 题</span>
        <span>原题号 ${question.sourceNumber}</span>
        <span>${escapeHtml(sourceLabel(question))}</span>
      </div>
      <h2>${escapeHtml(question.stem)}</h2>
      <fieldset class="options" aria-label="备选答案">${options}</fieldset>
      <div class="question-actions">
        <button class="button check-answer" type="button">提交本题</button>
        <button class="button button--answer toggle-answer" type="button">${answer.revealed ? "隐藏答案" : "显示答案"}</button>
        <span class="result-message${messageClass}" role="status">${message}</span>
      </div>
      <div class="answer-panel" ${answer.revealed ? "" : "hidden"}>
        <p><strong>正确答案：</strong>${escapeHtml(question.answerText)}</p>
        <p><strong>解析：</strong>${escapeHtml(question.explanation)}</p>
        <p class="source-line">${escapeHtml(sourceLabel(question))}</p>
      </div>
    </article>`;
  }

  function renderQuestions() {
    const questions = visibleQuestions();
    elements.list.innerHTML = questions.map(renderQuestion).join("");
    elements.empty.hidden = questions.length > 0;
    updateStats();
  }

  function updateStats() {
    const allAnswers = Object.values(state.answers);
    const completed = allAnswers.filter((answer) => answer.checked).length;
    const correct = allAnswers.filter((answer) => answer.checked && answer.correct).length;
    elements.totalCount.textContent = String(data.questions.length);
    elements.completedCount.textContent = String(completed);
    elements.correctCount.textContent = String(correct);
    elements.accuracyRate.textContent = completed ? `${Math.round(correct / completed * 100)}%` : "—";

    const group = data.groups.find((item) => item.id === state.activeGroup);
    const questions = groupQuestions(state.activeGroup);
    const groupCompleted = questions.filter((question) => answerState(question.id).checked).length;
    elements.sectionTitle.textContent = group.title;
    elements.sectionSummary.textContent = `${groupCompleted} / ${questions.length} 已作答`;
    elements.progressFill.style.width = questions.length ? `${groupCompleted / questions.length * 100}%` : "0";
  }

  function selectedLetters(card) {
    return [...card.querySelectorAll("input:checked")].map((input) => input.value);
  }

  function setAnswer(questionId, patch) {
    state.answers[questionId] = { ...answerState(questionId), ...patch };
    saveAnswers();
  }

  elements.tabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-group]");
    if (!tab) return;
    state.activeGroup = tab.dataset.group;
    renderTabs();
    renderQuestions();
    window.scrollTo({ top: document.querySelector(".toolbar").offsetTop - 8, behavior: "smooth" });
  });

  elements.list.addEventListener("change", (event) => {
    const card = event.target.closest(".question-card");
    if (!card || !event.target.matches("input")) return;
    setAnswer(card.dataset.id, {
      selected: selectedLetters(card),
      checked: false,
      correct: false
    });
    const message = card.querySelector(".result-message");
    message.textContent = "";
    message.className = "result-message";
    card.dataset.result = "";
  });

  elements.list.addEventListener("click", (event) => {
    const card = event.target.closest(".question-card");
    if (!card) return;
    const question = data.questions.find((item) => item.id === card.dataset.id);
    if (!question) return;

    if (event.target.closest(".check-answer")) {
      const selected = selectedLetters(card);
      if (!selected.length) {
        const message = card.querySelector(".result-message");
        message.textContent = "请先选择答案";
        message.className = "result-message is-incorrect";
        return;
      }
      setAnswer(question.id, {
        selected,
        checked: true,
        correct: sameLetters(selected, question.correct)
      });
      renderQuestions();
    }

    if (event.target.closest(".toggle-answer")) {
      setAnswer(question.id, { revealed: !answerState(question.id).revealed });
      renderQuestions();
      document.querySelector(`[data-id="${question.id}"]`)?.scrollIntoView({ block: "center" });
    }
  });

  elements.search.addEventListener("input", () => {
    state.search = elements.search.value;
    renderQuestions();
  });

  elements.status.addEventListener("change", () => {
    state.status = elements.status.value;
    renderQuestions();
  });

  elements.resetSection.addEventListener("click", () => {
    if (!confirm("确定重置当前题型的作答记录吗？")) return;
    groupQuestions(state.activeGroup).forEach((question) => delete state.answers[question.id]);
    saveAnswers();
    renderQuestions();
  });

  elements.resetAll.addEventListener("click", () => {
    if (!confirm("确定清空全部作答记录吗？")) return;
    state.answers = {};
    saveAnswers();
    renderQuestions();
  });

  elements.backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  renderTabs();
  renderQuestions();
}());
