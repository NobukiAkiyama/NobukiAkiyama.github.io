const storageKey = "stamina-calculator.cards";

const refs = {
  list: document.querySelector("[data-card-list]"),
  emptyState: document.querySelector("[data-empty-state]"),
  calculator: document.querySelector("[data-calculator]"),
  calculatorGrid: document.querySelector("[data-calculator-grid]"),
  display: document.querySelector("[data-display]"),
  selectedCardName: document.querySelector("[data-selected-card-name]"),
  calculatorStatus: document.querySelector("[data-calculator-status]"),
  addButton: document.querySelector("[data-open-modal]"),
  modal: document.querySelector("[data-card-modal]"),
  form: document.querySelector("[data-card-form]"),
  closeModal: document.querySelector("[data-close-modal]")
};

let cards = [];
let selectedCardId = null;
let calculatorState = {
  tokens: [],
  currentInput: "0"
};

init();

function init() {
  loadCards();
  renderCards();
  bindEvents();
  preventDoubleTapZoom();
  refreshCalculator();
}

function refreshDisplay() {
  const tokenText = calculatorState.tokens.join(" ");
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

function preventDoubleTapZoom() {
  if (typeof window === "undefined" || !("ontouchstart" in window)) {
    return;
  }

  let lastTouchTime = 0;

  function isInteractive(element) {
    if (!element) return false;
    const tag = element.tagName && element.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (element.isContentEditable) return true;
    if (element.closest && element.closest("[data-card-modal]")) return true;
    return false;
  }

  document.addEventListener(
    "touchstart",
    (event) => {
      const target = event.target;
      if (isInteractive(target)) {
        lastTouchTime = Date.now();
        return;
      }

      const now = Date.now();
      if (now - lastTouchTime <= 300) {
        event.preventDefault();
      }
      lastTouchTime = now;
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturestart",
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );
}

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
  });

  refs.closeModal.addEventListener("click", () => refs.modal.close());

  refs.modal.addEventListener("close", () => {
    // clear any edit state and re-enable inputs
    const maxInput = refs.form.querySelector('input[name="max"]');
    if (maxInput) maxInput.disabled = false;
    delete refs.modal.dataset.editCardId;
    const header = refs.form.querySelector('header h2');
    if (header) header.textContent = 'カードを追加';
    refs.form.reset();
  });

  refs.form.addEventListener("submit", handleCreateCard);

  refs.list.addEventListener("click", handleListClick);

  refs.calculatorGrid.addEventListener("click", handleCalculatorClick);
  // calculator header edit button
  refs.calculator.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-card]");
    if (!btn) return;
    // open edit modal for currently selected card
    openEditModal();
  });
}

function handleCreateCard(event) {
  event.preventDefault();
  const formData = new FormData(refs.form);
  let name = (formData.get("name") || "").toString().trim();
  const max = Number(formData.get("max"));

  if (Number.isNaN(max)) {
    return;
  }

  const clampedMax = Math.max(1, Math.floor(max));

  if (!name) {
    const nextIndex = cards.length + 1;
    name = `カード_${nextIndex}`;
  }

  // If editing an existing card, update it instead of creating a new one
  const editId = refs.modal.dataset.editCardId;
  if (editId) {
    const idx = cards.findIndex((c) => c.id === editId);
    if (idx !== -1) {
      cards[idx] = {
        ...cards[idx],
        name,
        max: clampedMax,
        // keep current health but clamp to new max
        current: Math.min(cards[idx].current, clampedMax)
      };
      saveCards();
      renderCards();
      // If the edited card is currently selected, update calculator display
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
    id: crypto.randomUUID(),
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
    const card = deleteButton.closest("[data-card]");
    if (!card) return;
    const id = card.dataset.cardId;
    deleteCard(id);
    return;
  }

  const editButton = event.target.closest("[data-edit-card]");
  if (editButton) {
    const card = editButton.closest("[data-card]");
    if (!card) return;
    const id = card.dataset.cardId;
    openEditModal(id);
    return;
  }

  const selectButton = event.target.closest("[data-select-card]");
  if (selectButton) {
    const card = selectButton.closest("[data-card]");
    if (!card) return;
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
  refs.list.innerHTML = "";

  if (cards.length === 0) {
    refs.emptyState.hidden = false;
    return;
  }

  refs.emptyState.hidden = true;

  const fragment = document.createDocumentFragment();
  const template = document.getElementById("card-template");

  cards.forEach((card) => {
    const clone = template.content.cloneNode(true);
    const li = clone.querySelector("[data-card]");
    li.dataset.cardId = card.id;

    const nameEl = clone.querySelector("[data-card-name]");
    nameEl.textContent = card.name;

    const valuesEl = clone.querySelector("[data-card-values]");
    valuesEl.textContent = `${formatNumber(card.current)} / ${formatNumber(card.max)}`;

    const progressEl = clone.querySelector("[data-card-progress]");
    const barEl = clone.querySelector("[data-card-progress-bar]");
    const percentage = Math.round((card.current / card.max) * 100);
    progressEl.setAttribute("aria-valuenow", String(percentage));
    progressEl.setAttribute("aria-valuetext", `残り ${percentage}%`);
    const { gradient, accent, glow } = getProgressVisual(percentage);
    barEl.style.width = `${percentage}%`;
    barEl.style.background = gradient;
    li.style.setProperty("--card-accent", accent);
    li.style.setProperty("--card-glow", glow);

    if (card.id === selectedCardId) {
      li.classList.add("card--active");
    }

    fragment.appendChild(clone);
  });

  refs.list.appendChild(fragment);
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
