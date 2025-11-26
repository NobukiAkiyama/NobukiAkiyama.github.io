const storageKey = "stamina-calculator.cards";

const refs = {
  list: document.querySelector("[data-card-list]"),
  cardsSection: document.querySelector("[data-cards-section]"),
  emptyState: document.querySelector("[data-empty-state]"),
  calculator: document.querySelector("[data-calculator]"),
  calculatorGrid: document.querySelector("[data-calculator-grid]"),
  display: document.querySelector("[data-display]"),
  selectedCardName: document.querySelector("[data-selected-card-name]"),
  calculatorStatus: document.querySelector("[data-calculator-status]"),
  addButton: document.querySelector("[data-open-modal]"),
  modal: document.querySelector("[data-card-modal]"),
  form: document.querySelector("[data-card-form]"),
  closeModal: document.querySelector("[data-close-modal]"),
  presetModalTrigger: document.querySelector("[data-preset-modal-trigger]"),
  presetModal: document.querySelector("[data-preset-modal]"),
  presetForm: document.querySelector("[data-preset-form]"),
  closePresetModal: document.querySelector("[data-close-preset-modal]"),
  selectionBar: document.querySelector("[data-selection-bar]"),
  selectionCount: document.querySelector("[data-selection-count]"),
  selectAllButton: document.querySelector("[data-select-all]"),
  cancelSelectionButton: document.querySelector("[data-cancel-selection]"),
  deleteSelectedButton: document.querySelector("[data-floating-delete]"),
  addButtonFloating: document.querySelector("[data-open-modal]")
};

let cards = [];
let selectedCardId = null;
let calculatorState = {
  tokens: [],
  currentInput: "0"
};

const LONG_PRESS_DURATION = 550;
let longPressTimeoutId = null;

const selectionState = {
  isActive: false,
  selectedIds: new Set()
};

init();

function init() {
  loadCards();
  renderCards();
  bindEvents();
  // preventDoubleTapZoom(); ← これが遅延の原因だったので削除しました！
  refreshCalculator();
  updateSelectionUi();
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function refreshDisplay() {
  const tokenText = calculatorState.tokens
    .map((t) => (t === "*" ? "×" : t))
    .join(" ");
  let text = "";

  if (calculatorState.currentInput !== "" && calculatorState.currentInput != null) {
    text = tokenText ? `${tokenText} ${calculatorState.currentInput}` : calculatorState.currentInput;
  } else {
    text = tokenText;
  }

  refs.display.textContent = text.trim() || "0";
}

function isOperator(token) {
  return token === "+" || token === "-" || token === "*" || token === "/";
}

// ※ preventDoubleTapZoom 関数は削除しました

function loadCards() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      cards = parsed.map((card) => ({
        ...card,
        max: Number(card.max),
        current: Number(card.current)
      }));
    }
  } catch (error) {
    console.error("Failed to load cards", error);
  }
}

function saveCards() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(cards));
  } catch (error) {
    console.error("Failed to save cards", error);
  }
}

function bindEvents() {
  refs.addButton.addEventListener("click", () => {
    refs.form.reset();
    refs.modal.showModal();
    try {
      refs.modal.focus();
    } catch (e) {
      // ignore if focus() not supported
    }
  });

  refs.closeModal.addEventListener("click", () => refs.modal.close());

  refs.modal.addEventListener("close", () => {
    const maxInput = refs.form.querySelector('input[name="max"]');
    if (maxInput) maxInput.disabled = false;
    delete refs.modal.dataset.editCardId;
    const header = refs.form.querySelector('header h2');
    if (header) header.textContent = 'カードを追加';
    refs.form.reset();
  });

  refs.form.addEventListener("submit", handleCreateCard);

  refs.list.addEventListener("click", handleListClick);
  refs.list.addEventListener("pointerdown", handleCardPointerDown);
  refs.list.addEventListener("pointerup", cancelLongPressDetection);
  refs.list.addEventListener("pointerleave", cancelLongPressDetection);
  refs.list.addEventListener("pointercancel", cancelLongPressDetection);

  refs.calculatorGrid.addEventListener("click", handleCalculatorClick);

  refs.calculator.addEventListener("click", (e) => {
    if (selectionState.isActive) return;
    const btn = e.target.closest("[data-edit-card]");
    if (!btn) return;
    openEditModal();
  });

  document.addEventListener("keydown", handleKeyboardInput);

  if (refs.presetModalTrigger) {
    refs.presetModalTrigger.addEventListener("click", () => {
      refs.modal.close();
      refs.presetModal.showModal();
      try {
        refs.presetModal.focus();
      } catch (e) {
        // ignore if focus() not supported
      }
    });
  }

  if (refs.closePresetModal) {
    refs.closePresetModal.addEventListener("click", () => {
      refs.presetModal.close();
    });
  }

  if (refs.presetForm) {
    refs.presetForm.addEventListener("submit", handlePresetSubmit);
  }

  if (refs.cancelSelectionButton) {
    refs.cancelSelectionButton.addEventListener("click", exitSelectionMode);
  }

  if (refs.selectAllButton) {
    refs.selectAllButton.addEventListener("click", handleSelectAllCards);
  }

  if (refs.deleteSelectedButton) {
    refs.deleteSelectedButton.addEventListener("click", handleDeleteSelectedCards);
  }
}

function handleCardPointerDown(event) {
  if (selectionState.isActive) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const deleteButton = event.target.closest("[data-delete-card]");
  if (deleteButton) return;
  const card = event.target.closest("[data-card]");
  if (!card) return;
  cancelLongPressDetection();
  longPressTimeoutId = window.setTimeout(() => {
    if (!card.isConnected) return;
    enterSelectionMode(card.dataset.cardId);
  }, LONG_PRESS_DURATION);
}

function cancelLongPressDetection() {
  if (!longPressTimeoutId) return;
  window.clearTimeout(longPressTimeoutId);
  longPressTimeoutId = null;
}

function handlePresetSubmit(event) {
  event.preventDefault();
  const formData = new FormData(refs.presetForm);

  const parts = [
    { key: 'head', name: '頭' },
    { key: 'torso', name: '胴' },
    { key: 'right_hand', name: '右手' },
    { key: 'left_hand', name: '左手' },
    { key: 'right_leg', name: '右足' },
    { key: 'left_leg', name: '左足' }
  ];

  const newCards = parts.map(part => {
    const raw = formData.get(part.key);
    const parsed = raw === null || String(raw).trim() === "" ? 10000 : Number(raw);
    const clampedMax = Math.max(1, Math.floor(Number.isNaN(parsed) ? 10000 : parsed));
    return {
      id: generateUUID(),
      name: part.name,
      max: clampedMax,
      current: clampedMax
    };
  });

  cards.push(...newCards);
  saveCards();
  renderCards();

  // Select the first new card
  if (newCards.length > 0) {
    selectCard(newCards[0].id);
  }

  refs.presetModal.close();
  refs.presetForm.reset();
}

function handleKeyboardInput(event) {
  if (!refs.calculator.classList.contains("calculator--active")) return;
  if (refs.modal.open) return;

  const key = event.key;
  let selector = null;

  if (/[0-9.]/.test(key)) {
    selector = `button[data-value="${key}"]`;
  } else if (["+", "-", "*", "/"].includes(key)) {
    selector = `button[data-operator="${key}"]`;
  } else if (key === "Enter" || key === "=") {
    selector = 'button[data-action="equals"]';
    event.preventDefault();
  } else if (key === "Backspace") {
    selector = 'button[data-action="undo"]';
  } else if (key === "Escape" || key.toLowerCase() === "c") {
    selector = 'button[data-action="clear"]';
  } else if (key === "(" || key === ")") {
    selector = `button[data-value="${key}"]`;
  }

  if (selector) {
    const button = refs.calculatorGrid.querySelector(selector);
    if (button) {
      button.focus();
      button.click();
    }
  }
}

function handleCreateCard(event) {
  event.preventDefault();
  const formData = new FormData(refs.form);
  let name = (formData.get("name") || "").toString().trim();
  const maxRaw = formData.get("max");
  let max;
  if (maxRaw === null || String(maxRaw).trim() === "") {
    // If user didn't input a value, default to 10000 as requested
    max = 10000;
  } else {
    max = Number(maxRaw);
    if (Number.isNaN(max)) {
      max = 10000;
    }
  }

  const clampedMax = Math.max(1, Math.floor(max));

  if (!name) {
    const nextIndex = cards.length + 1;
    name = `カード_${nextIndex}`;
  }

  const editId = refs.modal.dataset.editCardId;
  if (editId) {
    const idx = cards.findIndex((c) => c.id === editId);
    if (idx !== -1) {
      cards[idx] = {
        ...cards[idx],
        name,
        max: clampedMax,
        current: Math.min(cards[idx].current, clampedMax)
      };
      saveCards();
      renderCards();
      if (selectedCardId === editId) {
        calculatorState.tokens = [];
        calculatorState.currentInput = String(cards[idx].current);
        refreshCalculator();
      } else {
        selectCard(editId);
      }
    }
    delete refs.modal.dataset.editCardId;
    refs.modal.close();
    return;
  }

  const newCard = {
    id: generateUUID(),
    name,
    max: clampedMax,
    current: clampedMax
  };

  cards.push(newCard);
  saveCards();
  renderCards();
  selectCard(newCard.id);
  refs.modal.close();
}

function handleListClick(event) {
  const deleteButton = event.target.closest("[data-delete-card]");
  if (deleteButton) {
    if (selectionState.isActive) return;
    const card = deleteButton.closest("[data-card]");
    if (!card) return;

    const cardName = card.querySelector("[data-card-name]").textContent;
    if (window.confirm(`「${cardName}」を削除しますか？`)) {
      const id = card.dataset.cardId;
      deleteCard(id);
    }
    return;
  }

  const editButton = event.target.closest("[data-edit-card]");
  if (editButton) {
    if (selectionState.isActive) return;
    const card = editButton.closest("[data-card]");
    if (!card) return;
    const id = card.dataset.cardId;
    openEditModal(id);
    return;
  }

  const card = event.target.closest("[data-card]");
  if (!card) return;

  if (selectionState.isActive) {
    toggleSelectionForCard(card.dataset.cardId);
    return;
  }

  const selectButton = event.target.closest("[data-select-card]");
  if (selectButton) {
    selectCard(card.dataset.cardId);
  }
}

function openEditModal(id) {
  const targetId = id || selectedCardId;
  if (!targetId) return;
  const card = cards.find((c) => c.id === targetId);
  if (!card) return;
  const nameInput = refs.form.querySelector('input[name="name"]');
  const maxInput = refs.form.querySelector('input[name="max"]');
  if (nameInput) nameInput.value = card.name;
  if (maxInput) {
    maxInput.value = card.max;
    maxInput.disabled = false;
  }
  refs.modal.dataset.editCardId = targetId;
  const header = refs.form.querySelector('header h2');
  if (header) header.textContent = 'カードを編集';
  refs.modal.showModal();
  try {
    refs.modal.focus();
  } catch (e) {
    // ignore
  }
}

function deleteCard(id) {
  cards = cards.filter((card) => card.id !== id);
  if (selectedCardId === id) {
    selectedCardId = null;
  }
  saveCards();
  renderCards();
  refreshCalculator();
}

function selectCard(id) {
  if (selectionState.isActive) return;
  if (selectedCardId === id) return;
  selectedCardId = id;
  renderCards();
  const card = cards.find((item) => item.id === selectedCardId);
  if (card) {
    calculatorState.tokens = [];
    calculatorState.currentInput = formatNumber(card.current);
  } else {
    calculatorState.tokens = [];
    calculatorState.currentInput = "0";
  }
  refreshCalculator();
}

function renderCards() {
  // Handle empty state
  if (cards.length === 0) {
    refs.emptyState.hidden = false;
    // Clear list if it has items (though cards is empty, just to be safe)
    refs.list.innerHTML = "";
    if (selectionState.isActive) {
      selectionState.isActive = false;
      selectionState.selectedIds.clear();
      updateSelectionUi();
    }
    return;
  }

  refs.emptyState.hidden = true;

  // 1. Create a map of existing elements by card ID
  const existingElements = new Map();
  Array.from(refs.list.children).forEach((el) => {
    if (el.dataset.cardId) {
      existingElements.set(el.dataset.cardId, el);
    }
  });

  // 2. Iterate through cards and update or create elements
  const template = document.getElementById("card-template");

  // Keep track of IDs processed to know which ones to remove later
  const processedIds = new Set();

  cards.forEach((card, index) => {
    processedIds.add(card.id);
    let li = existingElements.get(card.id);
    const isNew = !li;

    if (isNew) {
      const clone = template.content.cloneNode(true);
      li = clone.querySelector("[data-card]");
      li.dataset.cardId = card.id;
      // Add animation class for new items
      li.style.animationDelay = `${index * 0.05}s`;
      li.classList.add("card--enter");
    }

    // Update content
    const nameEl = li.querySelector("[data-card-name]");
    if (nameEl.textContent !== card.name) {
      nameEl.textContent = card.name;
    }

    const valuesEl = li.querySelector("[data-card-values]");
    const valuesText = `${formatNumber(card.current)} / ${formatNumber(card.max)}`;
    if (valuesEl.textContent !== valuesText) {
      valuesEl.textContent = valuesText;
    }

    const progressEl = li.querySelector("[data-card-progress]");
    const barEl = li.querySelector("[data-card-progress-bar]");
    const percentage = Math.round((card.current / card.max) * 100);

    if (progressEl.getAttribute("aria-valuenow") !== String(percentage)) {
      progressEl.setAttribute("aria-valuenow", String(percentage));
      progressEl.setAttribute("aria-valuetext", `残り ${percentage}%`);
      const { gradient, accent, glow } = getProgressVisual(percentage);
      barEl.style.width = `${percentage}%`;
      barEl.style.background = gradient;
      li.style.setProperty("--card-accent", accent);
      li.style.setProperty("--card-glow", glow);
    }

    // Update active state
    if (card.id === selectedCardId) {
      li.classList.add("card--active");
    } else {
      li.classList.remove("card--active");
    }

    // Update selection state
    if (selectionState.isActive) {
      li.classList.add("card--selection-mode");
      if (selectionState.selectedIds.has(card.id)) {
        li.classList.add("card--selection-checked");
      } else {
        li.classList.remove("card--selection-checked");
      }
    } else {
      li.classList.remove("card--selection-mode", "card--selection-checked");
    }

    // Append if new, or ensure order if existing
    if (isNew) {
      refs.list.appendChild(li);
    } else {
      // Check if it's in the right position
      const currentChild = refs.list.children[index];
      if (currentChild !== li) {
        // If the element at this index is not the one we expect, move it here
        if (currentChild) {
          refs.list.insertBefore(li, currentChild);
        } else {
          refs.list.appendChild(li);
        }
      }
    }
  });

  // 3. Remove elements that are no longer in the cards array
  existingElements.forEach((el, id) => {
    if (!processedIds.has(id)) {
      // Optional: Add exit animation here
      el.remove();
    }
  });
}

function enterSelectionMode(initialId) {
  if (cards.length === 0) return;
  selectionState.isActive = true;
  if (!selectionState.selectedIds) {
    selectionState.selectedIds = new Set();
  }
  if (selectedCardId != null) {
    selectedCardId = null;
    refreshCalculator();
  } else {
    refreshCalculator();
  }
  if (initialId) {
    selectionState.selectedIds.add(initialId);
  }
  updateSelectionUi();
  renderCards();
}

function exitSelectionMode() {
  if (!selectionState.isActive) return;
  selectionState.isActive = false;
  selectionState.selectedIds.clear();
  updateSelectionUi();
  renderCards();
}

function toggleSelectionForCard(cardId) {
  if (!selectionState.isActive || !cardId) return;
  if (selectionState.selectedIds.has(cardId)) {
    selectionState.selectedIds.delete(cardId);
  } else {
    selectionState.selectedIds.add(cardId);
  }
  updateSelectionUi();
  renderCards();
}

function handleSelectAllCards() {
  if (!selectionState.isActive) return;
  if (selectionState.selectedIds.size === cards.length) {
    selectionState.selectedIds.clear();
  } else {
    cards.forEach((card) => selectionState.selectedIds.add(card.id));
  }
  updateSelectionUi();
  renderCards();
}

function handleDeleteSelectedCards() {
  if (!selectionState.isActive || selectionState.selectedIds.size === 0) return;
  const count = selectionState.selectedIds.size;
  const confirmation = window.confirm(`${count} 件のカードを削除しますか？`);
  if (!confirmation) return;

  const selectedIds = new Set(selectionState.selectedIds);
  cards = cards.filter((card) => !selectedIds.has(card.id));
  if (!cards.some((card) => card.id === selectedCardId)) {
    selectedCardId = null;
  }
  selectionState.selectedIds.clear();
  selectionState.isActive = false;
  saveCards();
  renderCards();
  refreshCalculator();
  updateSelectionUi();
}

function updateSelectionUi() {
  const count = selectionState.selectedIds.size;
  if (refs.selectionBar) {
    refs.selectionBar.hidden = !selectionState.isActive;
  }
  if (refs.cardsSection) {
    refs.cardsSection.classList.toggle("cards--selection", selectionState.isActive);
  }
  if (refs.selectionCount) {
    refs.selectionCount.textContent = count > 0 ? `${count} 件を選択` : "カードを選択";
  }
  if (refs.deleteSelectedButton) {
    refs.deleteSelectedButton.hidden = !selectionState.isActive;
    refs.deleteSelectedButton.disabled = count === 0;
  }
  if (refs.selectAllButton) {
    const isAllSelected = count === cards.length && cards.length > 0;
    refs.selectAllButton.textContent = isAllSelected ? "すべて解除" : "すべて選択";
  }
  if (refs.addButtonFloating) {
    refs.addButtonFloating.classList.toggle("add-button--hidden", selectionState.isActive);
  }
  if (refs.calculator) {
    refs.calculator.classList.toggle("calculator--locked", selectionState.isActive);
  }
}

function refreshCalculator() {
  const card = cards.find((item) => item.id === selectedCardId);

  if (!card) {
    refs.calculator.classList.remove("calculator--active");
    refs.selectedCardName.textContent = "カードを選択してください";
    refs.calculatorStatus.textContent = "";
    calculatorState.tokens = [];
    calculatorState.currentInput = "0";
    refreshDisplay();
    const editBtn = refs.calculator.querySelector('[data-edit-card]');
    if (editBtn) editBtn.disabled = true;
    return;
  }

  refs.calculator.classList.add("calculator--active");
  refs.selectedCardName.textContent = card.name;
  refs.calculatorStatus.textContent = `体力: ${formatNumber(card.current)} / ${formatNumber(card.max)}`;
  const editBtn = refs.calculator.querySelector('[data-edit-card]');
  if (editBtn) editBtn.disabled = false;
  if (calculatorState.tokens.length === 0 && (calculatorState.currentInput === "" || calculatorState.currentInput == null)) {
    calculatorState.currentInput = formatNumber(card.current);
  }
  refreshDisplay();
}

function handleCalculatorClick(event) {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (selectionState.isActive) return;

  // 振動処理（Android用。iOSでは無視されます）
  if (typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(10);
    } catch (e) { }
  }

  if (!selectedCardId) {
    return;
  }

  const { value, operator, action } = button.dataset;

  if (value !== undefined) {
    if (value === "(" || value === ")") {
      inputParenthesis(value);
    } else {
      inputDigit(value);
    }
    return;
  }

  if (operator) {
    handleOperator(operator);
    return;
  }

  switch (action) {
    case "clear":
      resetCalculator();
      break;
    case "undo":
      removeLast();
      break;
    case "percent":
      applyPercent();
      break;
    case "equals":
      performCalculation();
      break;
    default:
      break;
  }
}

function inputDigit(digit) {
  let { currentInput } = calculatorState;

  if (digit === "." && currentInput.includes(".")) {
    return;
  }

  const isNegativeSign = currentInput === "-";

  if (currentInput == null || currentInput === "") {
    if (digit === ".") {
      currentInput = "0.";
    } else if (digit === "00") {
      currentInput = "0";
    } else {
      currentInput = digit;
    }
  } else if (isNegativeSign) {
    if (digit === "00") {
      currentInput = "-0";
    } else if (digit === ".") {
      currentInput = "-0.";
    } else {
      currentInput = `-${digit}`;
    }
  } else if (currentInput === "0" || currentInput === "-0") {
    if (digit === ".") {
      currentInput = currentInput.startsWith("-") ? "-0." : "0.";
    } else if (digit === "00") {
      currentInput = currentInput;
    } else {
      currentInput = currentInput.startsWith("-") ? `-${digit}` : digit;
    }
  } else if (digit === "00") {
    currentInput = currentInput + "00";
  } else {
    currentInput += digit;
  }

  calculatorState.currentInput = currentInput;
  refreshDisplay();
}

function handleOperator(nextOperator) {
  const tokens = calculatorState.tokens;
  const input = calculatorState.currentInput;

  if (input !== "" && input != null) {
    if (input !== "-") {
      tokens.push(input);
    }
    calculatorState.currentInput = "";
  }

  if (tokens.length === 0) {
    if (nextOperator === "-") {
      calculatorState.currentInput = "-";
      refreshDisplay();
    }
    return;
  }

  const last = tokens[tokens.length - 1];
  if (isOperator(last)) {
    tokens[tokens.length - 1] = nextOperator;
  } else if (last !== "(") {
    tokens.push(nextOperator);
  }

  refreshDisplay();
}

function performCalculation() {
  const tokens = [...calculatorState.tokens];
  if (calculatorState.currentInput !== "" && calculatorState.currentInput != null && calculatorState.currentInput !== "-") {
    tokens.push(calculatorState.currentInput);
  }

  if (tokens.length === 0) {
    commitDisplayToCard();
    return;
  }

  if (isOperator(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  if (tokens.length === 0) return;

  const expression = tokens.join(" ");

  try {
    const result = evaluateExpression(expression);
    if (result == null || Number.isNaN(result) || !Number.isFinite(result)) {
      return;
    }
    calculatorState.tokens = [];
    calculatorState.currentInput = formatNumber(result);
    refreshDisplay();
    commitDisplayToCard();
  } catch (error) {
    console.error("Failed to evaluate", error);
  }
}

function resetCalculator() {
  const card = cards.find((item) => item.id === selectedCardId);
  calculatorState.tokens = [];
  calculatorState.currentInput = card ? formatNumber(card.current) : "0";
  refreshDisplay();
}

function removeLast() {
  if (calculatorState.currentInput && calculatorState.currentInput !== "") {
    if (calculatorState.currentInput.length <= 1) {
      calculatorState.currentInput = "0";
    } else {
      calculatorState.currentInput = calculatorState.currentInput.slice(0, -1);
    }
    refreshDisplay();
    return;
  }

  if (calculatorState.tokens.length === 0) return;

  const removed = calculatorState.tokens.pop();
  if (!isOperator(removed) && removed !== "(" && removed !== ")") {
    calculatorState.currentInput = removed;
  }
  refreshDisplay();
}

function applyPercent() {
  const value = parseFloat(calculatorState.currentInput);
  if (Number.isNaN(value)) return;
  calculatorState.currentInput = String(value / 100);
  refreshDisplay();
}

function inputParenthesis(symbol) {
  const tokens = calculatorState.tokens;
  const input = calculatorState.currentInput;

  if (symbol === "(") {
    if (input !== "" && input != null && input !== "0" && input !== "-" && input !== "-0" && input !== "0.") {
      tokens.push(input);
      calculatorState.currentInput = "";
      const last = tokens[tokens.length - 1];
      if (!isOperator(last) && last !== "(") {
        tokens.push("*");
      }
    } else if (input === "0" || input === "-0" || input === "0.") {
      calculatorState.currentInput = "";
    }

    const lastToken = tokens[tokens.length - 1];
    if (lastToken && !isOperator(lastToken) && lastToken !== "(") {
      tokens.push("*");
    }

    tokens.push("(");
    refreshDisplay();
    return;
  }

  // handle closing parenthesis
  let openCount = 0;
  tokens.forEach((token) => {
    if (token === "(") openCount += 1;
    if (token === ")") openCount -= 1;
  });

  if (calculatorState.currentInput !== "" && calculatorState.currentInput != null && calculatorState.currentInput !== "-") {
    tokens.push(calculatorState.currentInput);
    calculatorState.currentInput = "";
  }

  if (openCount <= 0) {
    refreshDisplay();
    return;
  }

  const last = tokens[tokens.length - 1];
  if (isOperator(last) || last === "(") {
    refreshDisplay();
    return;
  }

  tokens.push(")");
  refreshDisplay();
}

function commitDisplayToCard() {
  const cardIndex = cards.findIndex((card) => card.id === selectedCardId);
  if (cardIndex === -1) return;

  const card = cards[cardIndex];
  const value = parseFloat(calculatorState.currentInput);
  if (Number.isNaN(value)) return;

  const clampedValue = Math.min(card.max, Math.max(0, value));
  const normalized = Number(clampedValue.toFixed(6));

  cards[cardIndex] = {
    ...card,
    current: normalized
  };

  calculatorState.tokens = [];
  calculatorState.currentInput = formatNumber(normalized);
  refreshDisplay();
  saveCards();
  renderCards();
  refreshCalculatorStatus(cardIndex);
}

function refreshCalculatorStatus(cardIndex) {
  const card = cards[cardIndex];
  if (!card) return;
  refs.calculatorStatus.textContent = `体力: ${formatNumber(card.current)} / ${formatNumber(card.max)}`;
}

function getProgressVisual(rawPercentage) {
  const percent = Math.max(0, Math.min(100, Number.isFinite(rawPercentage) ? rawPercentage : 0));

  if (percent >= 70) {
    return {
      gradient: "linear-gradient(90deg, #26d0ce, #1a2980)",
      accent: "#1fb5ff",
      glow: "rgba(31, 181, 255, 0.35)"
    };
  }

  if (percent >= 30) {
    return {
      gradient: "linear-gradient(90deg, #f6d365, #fda085)",
      accent: "#f6a21a",
      glow: "rgba(246, 162, 26, 0.35)"
    };
  }

  return {
    gradient: "linear-gradient(90deg, #ff758c, #ff7eb3)",
    accent: "#ff5f7a",
    glow: "rgba(255, 95, 122, 0.35)"
  };
}

function evaluateExpression(expression) {
  const tokens = expression.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const output = [];
  const operators = [];
  const precedence = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2
  };

  tokens.forEach((token) => {
    if (!Number.isNaN(parseFloat(token)) && isFinite(token)) {
      output.push(parseFloat(token));
    } else if (token === "(") {
      operators.push(token);
    } else if (token === ")") {
      while (operators.length > 0 && operators[operators.length - 1] !== "(") {
        const op = operators.pop();
        const right = output.pop();
        const left = output.pop();
        output.push(applyOperator(left, right, op));
      }
      if (operators.length > 0 && operators[operators.length - 1] === "(") {
        operators.pop();
      }
    } else if (isOperator(token)) {
      while (
        operators.length > 0 &&
        operators[operators.length - 1] !== "(" &&
        precedence[operators[operators.length - 1]] >= precedence[token]
      ) {
        const op = operators.pop();
        const right = output.pop();
        const left = output.pop();
        output.push(applyOperator(left, right, op));
      }
      operators.push(token);
    }
  });

  while (operators.length > 0) {
    const op = operators.pop();
    if (op === "(") {
      continue;
    }
    const right = output.pop();
    const left = output.pop();
    output.push(applyOperator(left, right, op));
  }

  return output.pop();
}

function applyOperator(left, right, operator) {
  if (left == null || right == null) return 0;

  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return right === 0 ? 0 : left / right;
    default:
      return right;
  }
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) {
    return String(value);
  }
  return Number(value.toFixed(6)).toString();
}
