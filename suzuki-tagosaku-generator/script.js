"use strict";

const TWEET_HASHTAGS = "#スズキタゴサク構文 #爆弾";
const STORAGE_KEYS = {
  history: "tagosaku_history",
  favorites: "tagosaku_favorites",
  count: "tagosaku_generate_count"
};

const state = {
  words: null,
  history: [],
  favorites: [],
  generateCount: 0,
  currentText: "",
  bulkTexts: []
};

const elements = {
  resultText: document.getElementById("resultText"),
  statusMessage: document.getElementById("statusMessage"),
  generateButton: document.getElementById("generateButton"),
  copyButton: document.getElementById("copyButton"),
  tweetButton: document.getElementById("tweetButton"),
  favoriteButton: document.getElementById("favoriteButton"),
  bulkButton: document.getElementById("bulkButton"),
  historyList: document.getElementById("historyList"),
  favoriteList: document.getElementById("favoriteList"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  clearFavoritesButton: document.getElementById("clearFavoritesButton"),
  generateCount: document.getElementById("generateCount"),
  bulkOutput: document.getElementById("bulkOutput"),
  copyBulkButton: document.getElementById("copyBulkButton")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadLocalState();
  bindEvents();
  renderAll();
  loadEmbeddedWords();
}

function bindEvents() {
  elements.generateButton.addEventListener("click", handleGenerate);
  elements.copyButton.addEventListener("click", () => copyText(state.currentText, "生成文をコピーしました。"));
  elements.tweetButton.addEventListener("click", tweetCurrentText);
  elements.favoriteButton.addEventListener("click", addCurrentToFavorites);
  elements.bulkButton.addEventListener("click", handleBulkGenerate);
  elements.copyBulkButton.addEventListener("click", () => copyText(elements.bulkOutput.value, "100件分をコピーしました。"));
  elements.clearHistoryButton.addEventListener("click", clearHistory);
  elements.clearFavoritesButton.addEventListener("click", clearFavorites);
}

function loadEmbeddedWords() {
  setStatus("埋め込み単語帳を読み込んでいます。");

  try {
    const dataElement = document.getElementById("embeddedWords");

    if (!dataElement || !dataElement.textContent.trim()) {
      throw new Error("HTML内に埋め込み単語帳が見つかりません。");
    }

    const data = JSON.parse(dataElement.textContent);
    validateWords(data);
    state.words = data;
    setStatus("埋め込み単語帳を読み込みました。");

    if (!state.currentText) {
      handleGenerate();
    }
  } catch (error) {
    handleError(error);
    elements.resultText.textContent = "埋め込み単語帳を読み込めませんでした。HTML内のJSONを確認してください。";
  }
}

function validateWords(data) {
  if (!data || typeof data !== "object") {
    throw new Error("単語帳はJSONオブジェクトである必要があります。");
  }

  if (!Array.isArray(data.templates) || data.templates.length === 0) {
    throw new Error("templates は1件以上の配列にしてください。");
  }

  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw new Error("actions は1件以上の配列にしてください。");
  }

  if (!Array.isArray(data.subjects) || data.subjects.length === 0) {
    throw new Error("subjects は1件以上の配列にしてください。");
  }

  data.templates.forEach((template, index) => {
    if (typeof template !== "string" || !template.includes("{subject}") || !template.includes("{action}") || !template.includes("{reason}")) {
      throw new Error(`templates[${index}] は {subject}, {action}, {reason} を含む文字列にしてください。`);
    }
  });

  data.actions.forEach((action, index) => {
    if (typeof action !== "string" || action.trim() === "") {
      throw new Error(`actions[${index}] は空でない文字列にしてください。`);
    }
  });

  data.subjects.forEach((entry, index) => {
    if (!entry || typeof entry.subject !== "string" || entry.subject.trim() === "") {
      throw new Error(`subjects[${index}].subject は空でない文字列にしてください。`);
    }

    if (!Array.isArray(entry.reasons) || entry.reasons.length === 0) {
      throw new Error(`subjects[${index}].reasons は1件以上の配列にしてください。`);
    }

    entry.reasons.forEach((reason, reasonIndex) => {
      if (typeof reason !== "string" || reason.trim() === "") {
        throw new Error(`subjects[${index}].reasons[${reasonIndex}] は空でない文字列にしてください。`);
      }
    });
  });
}

function generateSentence() {
  if (!state.words) {
    throw new Error("単語帳が読み込まれていません。");
  }

  const template = pickRandom(state.words.templates);
  const subjectEntry = pickRandom(state.words.subjects);
  const action = pickRandom(state.words.actions);
  const reason = pickRandom(subjectEntry.reasons);

  return template
    .replaceAll("{subject}", subjectEntry.subject)
    .replaceAll("{action}", action)
    .replaceAll("{reason}", reason);
}

function handleGenerate() {
  try {
    const sentence = generateSentence();
    state.currentText = sentence;
    state.generateCount += 1;
    addHistory(sentence);
    saveCount();
    renderAll();
    animateResult();
    setStatus("生成しました。");
  } catch (error) {
    handleError(error);
  }
}

function handleBulkGenerate() {
  try {
    const texts = Array.from({ length: 100 }, () => generateSentence());
    state.bulkTexts = texts;
    elements.bulkOutput.value = texts.map((text, index) => `${index + 1}. ${text}`).join("\n\n");
    state.generateCount += 100;
    texts.slice(0, 20).forEach(addHistory);
    saveCount();
    renderAll();
    setStatus("ランダム100件を生成しました。履歴には最新20件を追加しました。");
  } catch (error) {
    handleError(error);
  }
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function addHistory(text) {
  state.history = [createEntry(text), ...state.history.filter((item) => item.text !== text)].slice(0, 100);
  saveHistory();
}

function addCurrentToFavorites() {
  if (!state.currentText) {
    setStatus("お気に入りに追加する文章がありません。", true);
    return;
  }

  addFavorite(state.currentText);
  renderFavorites();
  setStatus("お気に入りに登録しました。");
}

function addFavorite(text) {
  state.favorites = [createEntry(text), ...state.favorites.filter((item) => item.text !== text)].slice(0, 100);
  saveFavorites();
}

function removeHistory(id) {
  state.history = state.history.filter((item) => item.id !== id);
  saveHistory();
  renderHistory();
}

function removeFavorite(id) {
  state.favorites = state.favorites.filter((item) => item.id !== id);
  saveFavorites();
  renderFavorites();
}

function clearHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
  setStatus("履歴を削除しました。");
}

function clearFavorites() {
  state.favorites = [];
  saveFavorites();
  renderFavorites();
  setStatus("お気に入りを削除しました。");
}

function createEntry(text) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
    createdAt: new Date().toISOString()
  };
}

async function copyText(text, successMessage) {
  if (!text) {
    setStatus("コピーする内容がありません。", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage);
  } catch (error) {
    handleError(new Error(`コピーに失敗しました: ${error.message}`));
  }
}

function tweetCurrentText() {
  if (!state.currentText) {
    setStatus("投稿する文章がありません。", true);
    return;
  }

  const tweetUrl = new URL("https://twitter.com/intent/tweet");
  tweetUrl.searchParams.set("text", `${state.currentText}\n${TWEET_HASHTAGS}`);
  window.open(tweetUrl.toString(), "_blank", "noopener,noreferrer");
  setStatus("Xの投稿画面を開きました。");
}

function renderAll() {
  renderResult();
  renderHistory();
  renderFavorites();
  renderCount();
}

function renderResult() {
  if (state.currentText) {
    elements.resultText.textContent = state.currentText;
  }
}

function renderHistory() {
  renderList(elements.historyList, state.history, {
    emptyText: "履歴はまだありません。",
    actions: [
      { label: "コピー", handler: (item) => copyText(item.text, "履歴をコピーしました。") },
      { label: "★", handler: (item) => addFavorite(item.text), title: "お気に入りに追加" },
      { label: "削除", handler: (item) => removeHistory(item.id) }
    ]
  });
}

function renderFavorites() {
  renderList(elements.favoriteList, state.favorites, {
    emptyText: "お気に入りはまだありません。",
    actions: [
      { label: "コピー", handler: (item) => copyText(item.text, "お気に入りをコピーしました。") },
      { label: "削除", handler: (item) => removeFavorite(item.id) }
    ]
  });
}

function renderList(listElement, items, options) {
  listElement.textContent = "";

  if (items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = options.emptyText;
    listElement.appendChild(emptyItem);
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = "item-card";

    const text = document.createElement("p");
    text.textContent = item.text;

    const actions = document.createElement("div");
    actions.className = "item-actions";

    options.actions.forEach((action) => {
      const button = document.createElement("button");
      button.className = "icon-button";
      button.type = "button";
      button.textContent = action.label;
      button.title = action.title || action.label;
      button.addEventListener("click", () => {
        action.handler(item);
        renderAll();
      });
      actions.appendChild(button);
    });

    listItem.append(text, actions);
    fragment.appendChild(listItem);
  });

  listElement.appendChild(fragment);
}

function renderCount() {
  elements.generateCount.textContent = state.generateCount.toLocaleString("ja-JP");
}

function animateResult() {
  elements.resultText.classList.remove("is-updated");
  requestAnimationFrame(() => {
    elements.resultText.classList.add("is-updated");
  });
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle("is-error", isError);
}

function handleError(error) {
  console.error(error);
  setStatus(error.message || "予期しないエラーが発生しました。", true);
}

function loadLocalState() {
  state.history = readStorageArray(STORAGE_KEYS.history);
  state.favorites = readStorageArray(STORAGE_KEYS.favorites);
  state.generateCount = Number(localStorage.getItem(STORAGE_KEYS.count)) || 0;
}

function readStorageArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`${key} の読み込みに失敗しました。`, error);
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
}

function saveFavorites() {
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(state.favorites));
}

function saveCount() {
  localStorage.setItem(STORAGE_KEYS.count, String(state.generateCount));
}
