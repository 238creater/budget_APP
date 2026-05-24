const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});
const compactYen = new Intl.NumberFormat("ja-JP", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1
});

const colors = ["#1f8a70", "#f2b84b", "#dc5b57", "#2679c6", "#8b6bd6", "#e2774f", "#2aa6a1", "#5e8d4e"];
const defaultCategories = {
  expense: [
    { name: "食費", color: "#1f8a70" },
    { name: "日用品", color: "#f2b84b" },
    { name: "交通", color: "#2679c6" },
    { name: "住居", color: "#8b6bd6" },
    { name: "水道光熱", color: "#e2774f" },
    { name: "通信", color: "#2aa6a1" },
    { name: "娯楽", color: "#dc5b57" },
    { name: "医療", color: "#5e8d4e" },
    { name: "その他", color: "#69756f" }
  ],
  income: [
    { name: "給与", color: "#2679c6" },
    { name: "副業", color: "#1f8a70" },
    { name: "臨時収入", color: "#f2b84b" },
    { name: "その他", color: "#69756f" }
  ]
};
const state = {
  selectedType: "expense",
  settingsCategoryType: "expense",
  selectedMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  chartPeriod: "month",
  chartMonth: new Date(),
  chartSelectedCategory: "",
  chartPickerYear: new Date().getFullYear(),
  chartWeekPickerYear: new Date().getFullYear(),
  chartWeekPickerMonth: null,
  entryDate: toDateInput(new Date()),
  entryPickerMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  receiptPickerMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDay: toDateInput(new Date()),
  pickerYear: new Date().getFullYear(),
  homeCalendarOpen: false,
  homePickerYear: new Date().getFullYear(),
  searchQuery: "",
  searchType: "all",
  searchCategory: "all",
  receiptCandidate: null,
  receiptFile: null,
  receiptOcrLoading: false,
  data: loadData()
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let navDrag = null;
let suppressNextNavClick = false;
const customSelectIds = [
  "categoryInput",
  "chartType",
  "searchType",
  "searchCategory",
  "fixedDayInput",
  "fixedCategoryInput",
  "receiptCategoryInput"
];

function loadData() {
  const saved = localStorage.getItem("budget-app-data");
  if (!saved) {
    return normalizeData({ categories: defaultCategories, transactions: seedTransactions() });
  }

  try {
    const parsed = JSON.parse(saved);
    return normalizeData(parsed);
  } catch {
    return normalizeData({ categories: defaultCategories, transactions: [] });
  }
}

function normalizeData(data) {
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const recurring = normalizeRecurringList(data.recurring);
  const recurringSkips = Array.isArray(data.recurringSkips) ? data.recurringSkips.map(String) : [];
  if (Array.isArray(data.categories)) {
    const expenseNames = new Set(["食費", "日用品", "交通", "住居", "水道光熱", "通信", "娯楽", "医療", "その他"]);
    const categories = {
      expense: data.categories
        .filter((name) => name !== "給与")
        .map((name) => makeCategory(String(name), "expense")),
      income: data.categories
        .filter((name) => name === "給与" || !expenseNames.has(name))
        .map((name) => makeCategory(String(name), "income"))
    };
    return ensureDefaultCategories({ categories, transactions, recurring, recurringSkips });
  }

  return ensureDefaultCategories({
    categories: {
      expense: normalizeCategoryList(data.categories?.expense, "expense"),
      income: normalizeCategoryList(data.categories?.income, "income")
    },
    transactions,
    recurring,
    recurringSkips
  });
}

function normalizeCategoryList(list, type) {
  if (!Array.isArray(list)) return defaultCategories[type].map((item) => ({ ...item }));
  return list.map((item) => {
    if (typeof item === "string") return makeCategory(item, type);
    return makeCategory(item.name, type, item.color);
  }).filter((item) => item.name);
}

function ensureDefaultCategories(data) {
  ["expense", "income"].forEach((type) => {
    const names = new Set(data.categories[type].map((item) => item.name));
    defaultCategories[type].forEach((item) => {
      if (!names.has(item.name)) data.categories[type].push({ ...item });
    });
  });
  return data;
}

function makeCategory(name, type, color) {
  return {
    name: String(name || "").trim(),
    color: normalizeColor(color) || fallbackCategoryColor(name, type)
  };
}

function normalizeColor(color) {
  const value = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "";
}

function normalizeRecurringList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    id: String(item.id || makeId()),
    name: String(item.name || "").trim(),
    amount: Number(item.amount) || 0,
    category: String(item.category || "その他").trim(),
    day: Math.min(31, Math.max(1, Number(item.day) || 1)),
    startMonth: normalizeMonthKey(item.startMonth),
    active: item.active !== false
  })).filter((item) => item.name && item.amount > 0);
}

function seedTransactions() {
  const today = new Date();
  const iso = toDateInput(today);
  return [
    {
      id: makeId(),
      type: "expense",
      amount: 1280,
      category: "食費",
      date: iso,
      memo: "サンプル: ランチ"
    },
    {
      id: makeId(),
      type: "income",
      amount: 240000,
      category: "給与",
      date: toDateInput(new Date(today.getFullYear(), today.getMonth(), 25)),
      memo: "サンプル: 給与"
    }
  ];
}

function saveData() {
  localStorage.setItem("budget-app-data", JSON.stringify(state.data));
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthTransactions() {
  const key = monthKey(state.selectedMonth);
  return state.data.transactions.filter((item) => item.date.startsWith(key));
}

function recurringKey(id, month) {
  return `${id}:${month}`;
}

function normalizeMonthKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : "";
}

function dueDateForMonth(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function nearestRecurringStartMonth(day, baseDate = new Date()) {
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const candidates = [-1, 0, 1].map((offset) => {
    const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return dueDateForMonth(month.getFullYear(), month.getMonth(), day);
  });
  const nearest = candidates.reduce((best, candidate) => {
    const bestDistance = Math.abs(best.getTime() - today.getTime());
    const candidateDistance = Math.abs(candidate.getTime() - today.getTime());
    if (candidateDistance !== bestDistance) return candidateDistance < bestDistance ? candidate : best;
    return candidate <= today ? candidate : best;
  });
  return monthKey(nearest);
}

function applyRecurringForMonth(monthDate) {
  const month = monthKey(monthDate);
  const rules = state.data.recurring || [];
  const skips = new Set(state.data.recurringSkips || []);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let added = false;

  rules.forEach((rule) => {
    if (!rule.active) return;
    if (rule.startMonth && month < rule.startMonth) return;
    if (skips.has(recurringKey(rule.id, month))) return;
    const alreadyExists = state.data.transactions.some((item) => item.recurringId === rule.id && item.recurringMonth === month);
    if (alreadyExists) return;

    const [year, monthNumber] = month.split("-").map(Number);
    const dueDate = dueDateForMonth(year, monthNumber - 1, rule.day);
    const dueDay = dueDate.getDate();
    if (dueDate > todayStart) return;

    const date = `${month}-${String(dueDay).padStart(2, "0")}`;
    state.data.transactions.unshift({
      id: makeId(),
      type: "expense",
      amount: rule.amount,
      category: rule.category,
      date,
      memo: `固定費: ${rule.name}`,
      recurringId: rule.id,
      recurringMonth: month
    });
    added = true;
  });

  if (added) saveData();
}

function chartMonthTransactions() {
  const range = chartRange();
  return state.data.transactions.filter((item) => item.date >= range.start && item.date <= range.end);
}

function monthTransactions(date) {
  const key = monthKey(date);
  return state.data.transactions.filter((item) => item.date.startsWith(key));
}

function typeTotal(items, type) {
  return items.filter((item) => item.type === type).reduce((sum, item) => sum + Number(item.amount), 0);
}

function formatCompactYen(value) {
  if (!value) return "";
  if (Math.abs(value) < 1000) return `¥${Math.round(value)}`;
  if (Math.abs(value) < 10000) return `${Math.round(value / 1000)}千`;
  return `${compactYen.format(value)}円`;
}

function formatCalendarAmount(value) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value);
}

function calendarAmountClass(value) {
  const length = formatCalendarAmount(value).length;
  if (length >= 8) return "is-tiny";
  if (length >= 6) return "is-small";
  return "";
}

function carriedBalanceUntil(date) {
  const monthEnd = `${monthKey(date)}-31`;
  const items = state.data.transactions.filter((item) => item.date <= monthEnd);
  return typeTotal(items, "income") - typeTotal(items, "expense");
}

function init() {
  setEntryDate(toDateInput(new Date()));
  bindEvents();
  applyRecurringForMonth(state.selectedMonth);
  renderAll();
}

function bindEvents() {
  $$("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      if (suppressNextNavClick && button.closest(".bottom-nav")) return;
      navigate(button.dataset.nav);
    });
  });
  initBottomNavDrag();

  $$(".segmented [data-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedType = button.dataset.type;
      $$(".segmented [data-type]").forEach((target) => target.classList.toggle("is-selected", target === button));
      renderCategories();
    });
  });

  $$("[data-settings-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settingsCategoryType = button.dataset.settingsType;
      $$("[data-settings-type]").forEach((target) => target.classList.toggle("is-selected", target === button));
      renderCategories();
    });
  });

  $("#prevMonth").addEventListener("click", () => changeMonth(-1));
  $("#nextMonth").addEventListener("click", () => changeMonth(1));
  $("#homeMonthToggle").addEventListener("click", toggleHomeCalendar);
  $("#homeTodayMonth").addEventListener("click", goCurrentHomeMonth);
  $("#homeCalendar").addEventListener("click", handleHomeCalendarClick);
  $("#calendarPrevMonth").addEventListener("click", () => changeMonth(-1));
  $("#calendarNextMonth").addEventListener("click", () => changeMonth(1));
  $("#datePickerButton").addEventListener("click", toggleEntryDatePicker);
  $("#datePickerPrev").addEventListener("click", () => changeEntryPickerMonth(-1));
  $("#datePickerNext").addEventListener("click", () => changeEntryPickerMonth(1));
  $("#datePickerToday").addEventListener("click", () => {
    setEntryDate(toDateInput(new Date()));
    renderEntryDatePicker();
  });
  $("#receiptDatePickerButton").addEventListener("click", toggleReceiptDatePicker);
  $("#receiptDatePickerPrev").addEventListener("click", () => changeReceiptPickerMonth(-1));
  $("#receiptDatePickerNext").addEventListener("click", () => changeReceiptPickerMonth(1));
  $("#receiptDatePickerToday").addEventListener("click", () => {
    setReceiptDate(toDateInput(new Date()));
    renderReceiptDatePicker();
  });
  $("#calendarMonthButton").addEventListener("click", toggleMonthPicker);
  $("#pickerPrevYear").addEventListener("click", () => changePickerYear(-1));
  $("#pickerNextYear").addEventListener("click", () => changePickerYear(1));
  $("#pickerYearButton").addEventListener("click", closeMonthPicker);
  document.addEventListener("click", (event) => {
    if (!$("#calendarMonthPicker").contains(event.target)) closeMonthPicker();
    if (!$("#datePickerWrap").contains(event.target)) closeEntryDatePicker();
    if (!$("#receiptDatePickerWrap").contains(event.target)) closeReceiptDatePicker();
    if (!$("#chartPicker").contains(event.target)) closeChartPicker();
    if (!$("#view-home .month-card").contains(event.target)) closeHomeCalendar();
    if (!event.target.closest(".custom-select")) closeCustomSelects();
  });
  $("#todayButton").addEventListener("click", () => {
    state.selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    state.selectedDay = toDateInput(new Date());
    state.pickerYear = state.selectedMonth.getFullYear();
    renderAll();
  });

  $("#entryForm").addEventListener("submit", addTransactionFromForm);
  $("#addCategory").addEventListener("click", () => addCategoryFrom("#newCategoryInput", "#newCategoryColor", state.selectedType));
  $("#settingsAddCategory").addEventListener("click", () => addCategoryFrom("#settingsCategoryInput", "#settingsCategoryColor", state.settingsCategoryType));
  $("#addFixedCost").addEventListener("click", addRecurringFromSettings);
  $("#chartType").addEventListener("change", () => {
    state.chartSelectedCategory = "";
    renderChart();
  });
  $$("[data-chart-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.chartPeriod = button.dataset.chartPeriod;
      state.chartSelectedCategory = "";
      $$("[data-chart-period]").forEach((target) => target.classList.toggle("is-selected", target === button));
      renderChart();
    });
  });
  $("#chartPrevMonth").addEventListener("click", () => changeChartPeriod(-1));
  $("#chartNextMonth").addEventListener("click", () => changeChartPeriod(1));
  $("#chartPeriodButton").addEventListener("click", toggleChartPicker);
  $("#chartPicker").addEventListener("click", (event) => event.stopPropagation());
  $("#chartTodayPeriod").addEventListener("click", goCurrentChartPeriod);
  $("#searchInput").addEventListener("input", () => {
    state.searchQuery = $("#searchInput").value;
    renderSearch();
  });
  $("#searchType").addEventListener("change", () => {
    state.searchType = $("#searchType").value;
    state.searchCategory = "all";
    renderSearch();
  });
  $("#searchCategory").addEventListener("change", () => {
    state.searchCategory = $("#searchCategory").value;
    renderSearch();
  });
  $("#themeToggle").addEventListener("click", () => document.body.classList.toggle("dark"));
  $("#openReceipt").addEventListener("click", openReceiptDialog);
  $("#takeReceiptPhoto").addEventListener("click", () => openFileInput("#receiptCameraInput"));
  $("#chooseReceiptPhoto").addEventListener("click", () => openFileInput("#receiptImage"));
  $("#receiptCameraInput").addEventListener("change", previewReceipt);
  $("#receiptImage").addEventListener("change", previewReceipt);
  $("#retakeReceipt").addEventListener("click", () => openFileInput("#receiptCameraInput"));
  $("#useReceiptPhoto").addEventListener("click", showReceiptFields);
  $("#parseReceipt").addEventListener("click", parseReceipt);
  $("#applyReceipt").addEventListener("click", applyReceipt);
  $("#exportData").addEventListener("click", exportData);
  $("#restoreData").addEventListener("click", () => openFileInput("#importData"));
  $("#importData").addEventListener("change", importData);
}

function navigate(view) {
  $$(".view").forEach((panel) => panel.classList.toggle("is-active", panel.id === `view-${view}`));
  $$(".bottom-nav button").forEach((button) => button.classList.toggle("is-active", button.dataset.nav === view));
  updateBottomNavIndicator($(`.bottom-nav button[data-nav="${view}"]`));
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "auto" });
}

function initBottomNavDrag() {
  const nav = $(".bottom-nav");
  if (!nav || !globalThis.PointerEvent) return;
  const activeButton = nav.querySelector(".is-active") || nav.querySelector("button");
  updateBottomNavIndicator(activeButton, true);

  nav.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("button[data-nav]");
    if (!button || event.button > 0) return;
    navDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      started: false,
      target: button
    };
    nav.setPointerCapture(event.pointerId);
  });

  nav.addEventListener("pointermove", (event) => {
    if (!navDrag || navDrag.pointerId !== event.pointerId) return;
    const distance = Math.abs(event.clientX - navDrag.startX);
    if (!navDrag.started && distance < 8) return;
    navDrag.started = true;
    nav.classList.add("is-dragging");
    const target = closestBottomNavButton(event.clientX);
    if (target) {
      navDrag.target = target;
      $$(".bottom-nav button").forEach((button) => button.classList.toggle("is-drag-target", button === target));
      updateBottomNavIndicator(target);
    }
    event.preventDefault();
  });

  nav.addEventListener("pointerup", finishBottomNavDrag);
  nav.addEventListener("pointercancel", cancelBottomNavDrag);
  window.addEventListener("resize", () => updateBottomNavIndicator(nav.querySelector(".is-active"), true));
}

function finishBottomNavDrag(event) {
  const nav = $(".bottom-nav");
  if (!navDrag || navDrag.pointerId !== event.pointerId) return;
  const wasDragging = navDrag.started;
  const target = wasDragging ? (closestBottomNavButton(event.clientX) || navDrag.target) : navDrag.target;
  clearBottomNavDrag();
  if (target) {
    suppressNextNavClick = true;
    navigate(target.dataset.nav);
    window.setTimeout(() => {
      suppressNextNavClick = false;
    }, 120);
  }
}

function cancelBottomNavDrag() {
  clearBottomNavDrag();
  updateBottomNavIndicator($(".bottom-nav .is-active"));
}

function clearBottomNavDrag() {
  const nav = $(".bottom-nav");
  nav?.classList.remove("is-dragging");
  $$(".bottom-nav button").forEach((button) => button.classList.remove("is-drag-target"));
  navDrag = null;
}

function closestBottomNavButton(clientX) {
  const buttons = $$(".bottom-nav button");
  return buttons.reduce((closest, button) => {
    const rect = button.getBoundingClientRect();
    const distance = Math.abs(clientX - (rect.left + rect.width / 2));
    return !closest || distance < closest.distance ? { button, distance } : closest;
  }, null)?.button || null;
}

function updateBottomNavIndicator(button, instant = false) {
  const nav = $(".bottom-nav");
  if (!nav || !button) return;
  const navRect = nav.getBoundingClientRect();
  const rect = button.getBoundingClientRect();
  nav.style.setProperty("--nav-indicator-x", `${rect.left - navRect.left}px`);
  nav.style.setProperty("--nav-indicator-width", `${rect.width}px`);
  nav.classList.toggle("is-indicator-ready", true);
  nav.classList.toggle("is-indicator-instant", instant);
  if (instant) {
    window.requestAnimationFrame(() => nav.classList.remove("is-indicator-instant"));
  }
}

function closeCustomSelects(except = null) {
  $$(".custom-select.is-open").forEach((wrapper) => {
    if (wrapper !== except) {
      wrapper.classList.remove("is-open");
      wrapper.querySelector(".custom-select-button")?.setAttribute("aria-expanded", "false");
    }
  });
}

function renderCustomSelects(ids = customSelectIds) {
  ids.forEach(renderCustomSelect);
}

function renderCustomSelect(id) {
  const select = $(`#${id}`);
  if (!select) return;

  let wrapper = select.closest(".custom-select");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    const button = document.createElement("button");
    button.className = "custom-select-button";
    button.type = "button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");

    const panel = document.createElement("div");
    panel.className = "custom-select-panel";
    panel.setAttribute("role", "listbox");

    wrapper.append(button, panel);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = !wrapper.classList.contains("is-open");
      closeCustomSelects(wrapper);
      wrapper.classList.toggle("is-open", willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
    });
  }
  wrapper.classList.toggle("custom-select-day", id === "fixedDayInput");

  const button = wrapper.querySelector(".custom-select-button");
  const panel = wrapper.querySelector(".custom-select-panel");
  const selected = select.options[select.selectedIndex] || select.options[0];
  button.innerHTML = `
    <span>${escapeHtml(selected?.textContent || "選択")}</span>
    <strong aria-hidden="true">⌄</strong>
  `;
  button.setAttribute("aria-label", selected?.textContent || "選択");
  panel.innerHTML = [...select.options].map((option) => `
    <button class="${option.selected ? "is-selected" : ""}" type="button" role="option" aria-selected="${option.selected}" data-custom-value="${escapeHtml(option.value)}">
      <span>${escapeHtml(option.textContent)}</span>
      ${option.selected ? "<strong>✓</strong>" : ""}
    </button>
  `).join("");

  panel.querySelectorAll("[data-custom-value]").forEach((optionButton) => {
    optionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      select.value = optionButton.dataset.customValue;
      wrapper.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      renderCustomSelect(id);
    });
  });
}

function changeMonth(delta) {
  state.selectedMonth = new Date(state.selectedMonth.getFullYear(), state.selectedMonth.getMonth() + delta, 1);
  state.selectedDay = toDateInput(state.selectedMonth);
  state.pickerYear = state.selectedMonth.getFullYear();
  state.homePickerYear = state.selectedMonth.getFullYear();
  renderAll();
}

function toggleHomeCalendar() {
  state.homeCalendarOpen = !state.homeCalendarOpen;
  state.homePickerYear = state.selectedMonth.getFullYear();
  renderHomeCalendar(currentMonthTransactions());
}

function closeHomeCalendar() {
  if (!state.homeCalendarOpen) return;
  state.homeCalendarOpen = false;
  renderHomeCalendar(currentMonthTransactions());
}

function goCurrentHomeMonth() {
  const today = new Date();
  state.selectedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  state.selectedDay = toDateInput(today);
  state.pickerYear = state.selectedMonth.getFullYear();
  state.homePickerYear = state.selectedMonth.getFullYear();
  renderAll();
}

function changeHomePickerYear(delta) {
  state.homePickerYear += delta;
  renderHomeCalendar(currentMonthTransactions());
}

function selectHomePickerMonth(monthIndex) {
  state.selectedMonth = new Date(state.homePickerYear, monthIndex, 1);
  state.selectedDay = toDateInput(state.selectedMonth);
  state.pickerYear = state.selectedMonth.getFullYear();
  state.homeCalendarOpen = false;
  renderAll();
}

function handleHomeCalendarClick(event) {
  event.stopPropagation();
  const yearButton = event.target.closest("[data-home-picker-year]");
  if (yearButton) {
    changeHomePickerYear(Number(yearButton.dataset.homePickerYear));
    return;
  }

  const monthButton = event.target.closest("[data-home-month]");
  if (monthButton) {
    selectHomePickerMonth(Number(monthButton.dataset.homeMonth));
  }
}

function changeChartPeriod(delta) {
  if (state.chartPeriod === "week") {
    state.chartMonth = new Date(state.chartMonth.getFullYear(), state.chartMonth.getMonth(), state.chartMonth.getDate() + delta * 7);
  } else {
    state.chartMonth = new Date(state.chartMonth.getFullYear(), state.chartMonth.getMonth() + delta, 1);
  }
  state.chartSelectedCategory = "";
  renderChart();
}

function goCurrentChartPeriod() {
  state.chartMonth = new Date();
  state.chartSelectedCategory = "";
  closeChartPicker();
  renderChart();
}

function toggleChartPicker() {
  const panel = $("#chartPickerPanel");
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  $("#chartPeriodButton").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    state.chartPickerYear = state.chartMonth.getFullYear();
    state.chartWeekPickerYear = state.chartMonth.getFullYear();
    state.chartWeekPickerMonth = null;
    renderChartPicker();
  }
}

function closeChartPicker() {
  $("#chartPickerPanel").hidden = true;
  $("#chartPeriodButton").setAttribute("aria-expanded", "false");
}

function selectChartMonth(year, monthIndex) {
  state.chartMonth = new Date(year, monthIndex, 1);
  state.chartSelectedCategory = "";
  closeChartPicker();
  renderChart();
}

function selectChartWeek(iso) {
  state.chartMonth = new Date(`${iso}T00:00:00`);
  state.chartSelectedCategory = "";
  closeChartPicker();
  renderChart();
}

function setEntryDate(iso) {
  state.entryDate = iso;
  $("#dateInput").value = iso;
  $("#datePickerLabel").textContent = formatDate(iso);
  const date = new Date(`${iso}T00:00:00`);
  state.entryPickerMonth = new Date(date.getFullYear(), date.getMonth(), 1);
}

function toggleEntryDatePicker() {
  const panel = $("#datePickerPanel");
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  $("#datePickerButton").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) renderEntryDatePicker();
}

function closeEntryDatePicker() {
  $("#datePickerPanel").hidden = true;
  $("#datePickerButton").setAttribute("aria-expanded", "false");
}

function changeEntryPickerMonth(delta) {
  state.entryPickerMonth = new Date(state.entryPickerMonth.getFullYear(), state.entryPickerMonth.getMonth() + delta, 1);
  renderEntryDatePicker();
}

function selectEntryDate(iso) {
  setEntryDate(iso);
  closeEntryDatePicker();
}

function setReceiptDate(iso) {
  $("#receiptDateInput").value = iso;
  $("#receiptDatePickerLabel").textContent = formatDate(iso);
  const date = new Date(`${iso}T00:00:00`);
  state.receiptPickerMonth = new Date(date.getFullYear(), date.getMonth(), 1);
}

function toggleReceiptDatePicker() {
  const panel = $("#receiptDatePickerPanel");
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  $("#receiptDatePickerButton").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) renderReceiptDatePicker();
}

function closeReceiptDatePicker() {
  $("#receiptDatePickerPanel").hidden = true;
  $("#receiptDatePickerButton").setAttribute("aria-expanded", "false");
}

function changeReceiptPickerMonth(delta) {
  state.receiptPickerMonth = new Date(state.receiptPickerMonth.getFullYear(), state.receiptPickerMonth.getMonth() + delta, 1);
  renderReceiptDatePicker();
}

function selectReceiptDate(iso) {
  setReceiptDate(iso);
  closeReceiptDatePicker();
}

function toggleMonthPicker() {
  const panel = $("#calendarMonthPanel");
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  $("#calendarMonthButton").setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    state.pickerYear = state.selectedMonth.getFullYear();
    renderMonthPicker();
  }
}

function closeMonthPicker() {
  $("#calendarMonthPanel").hidden = true;
  $("#calendarMonthButton").setAttribute("aria-expanded", "false");
}

function changePickerYear(delta) {
  state.pickerYear += delta;
  renderMonthPicker();
}

function selectPickerMonth(monthIndex) {
  state.selectedMonth = new Date(state.pickerYear, monthIndex, 1);
  state.selectedDay = toDateInput(state.selectedMonth);
  closeMonthPicker();
  renderAll();
}

function addTransactionFromForm(event) {
  event.preventDefault();
  const amount = parseAmount($("#amountInput").value);
  if (!amount || amount < 0) {
    showToast("金額を入力してください");
    return;
  }

  const item = {
    id: makeId(),
    type: state.selectedType,
    amount,
    category: $("#categoryInput").value,
    date: $("#dateInput").value,
    memo: $("#memoInput").value.trim()
  };

  state.data.transactions.unshift(item);
  state.selectedMonth = new Date(`${item.date}T00:00:00`);
  state.selectedMonth = new Date(state.selectedMonth.getFullYear(), state.selectedMonth.getMonth(), 1);
  state.selectedDay = item.date;
  saveData();
  $("#entryForm").reset();
  setEntryDate(toDateInput(new Date()));
  renderAll();
  showToast("保存しました");
  navigate("home");
}

function deleteTransaction(id) {
  const target = state.data.transactions.find((item) => item.id === id);
  if (target?.recurringId && target?.recurringMonth) {
    state.data.recurringSkips = [...new Set([...(state.data.recurringSkips || []), recurringKey(target.recurringId, target.recurringMonth)])];
  }
  state.data.transactions = state.data.transactions.filter((item) => item.id !== id);
  saveData();
  renderAll();
  showToast("削除しました");
}

function addCategoryFrom(inputSelector, colorSelector, type) {
  const input = $(inputSelector);
  const value = input.value.trim();
  if (!value) return;
  if (categoryList(type).some((item) => item.name === value)) {
    showToast("すでにあるカテゴリです");
    return;
  }

  state.data.categories[type].push(makeCategory(value, type, $(colorSelector).value));
  input.value = "";
  const otherInput = inputSelector === "#newCategoryInput" ? $("#settingsCategoryInput") : $("#newCategoryInput");
  if (otherInput.value.trim() === value) otherInput.value = "";
  saveData();
  renderCategories();
  showToast("カテゴリを追加しました");
}

function removeCategory(category, type) {
  const isUsed = state.data.transactions.some((item) => item.category === category && item.type === type)
    || (type === "expense" && state.data.recurring.some((item) => item.category === category));
  if (isUsed) {
    showToast("記録済みのカテゴリは削除できません");
    return;
  }

  state.data.categories[type] = state.data.categories[type].filter((item) => item.name !== category);
  saveData();
  renderCategories();
}

function addRecurringFromSettings() {
  const name = $("#fixedNameInput").value.trim();
  const amount = parseAmount($("#fixedAmountInput").value);
  const day = Number($("#fixedDayInput").value);
  const category = $("#fixedCategoryInput").value;
  if (!name || !amount || amount < 0) {
    showToast("固定費の名前と金額を入力してください");
    return;
  }

  const startMonth = nearestRecurringStartMonth(day);
  state.data.recurring.push({
    id: makeId(),
    name,
    amount,
    category,
    day,
    startMonth,
    active: true
  });
  $("#fixedNameInput").value = "";
  $("#fixedAmountInput").value = "";
  saveData();
  applyRecurringForMonth(new Date(`${startMonth}-01T00:00:00`));
  applyRecurringForMonth(state.selectedMonth);
  renderAll();
  showToast("固定費を追加しました");
}

function toggleRecurring(id) {
  const item = state.data.recurring.find((fixed) => fixed.id === id);
  if (!item) return;
  item.active = !item.active;
  saveData();
  applyRecurringForMonth(state.selectedMonth);
  renderAll();
}

function removeRecurring(id) {
  state.data.recurring = state.data.recurring.filter((item) => item.id !== id);
  state.data.recurringSkips = (state.data.recurringSkips || []).filter((key) => !key.startsWith(`${id}:`));
  saveData();
  renderAll();
  showToast("固定費を削除しました");
}

function renderAll() {
  applyRecurringForMonth(state.selectedMonth);
  renderCategories();
  renderHome();
  renderCalendar();
  renderEntryDatePicker();
  renderChart();
  renderSearch();
  renderRecurringSettings();
  renderCustomSelects();
}

function renderCategories() {
  const select = $("#categoryInput");
  select.innerHTML = categoryList(state.selectedType)
    .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
    .join("");

  $("#categoryChips").innerHTML = categoryList(state.settingsCategoryType).map((category) => `
    <div class="chip-row">
      <span class="swatch" style="background:${escapeHtml(category.color)}"></span>
      <strong>${escapeHtml(category.name)}</strong>
      <button type="button" aria-label="${escapeHtml(category.name)}を削除" title="削除" data-remove-category="${escapeHtml(category.name)}" data-category-type="${state.settingsCategoryType}">×</button>
    </div>
  `).join("");

  $$("[data-remove-category]").forEach((button) => {
    button.addEventListener("click", () => removeCategory(button.dataset.removeCategory, button.dataset.categoryType));
  });

  $("#fixedCategoryInput").innerHTML = categoryList("expense")
    .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
    .join("");
  $("#receiptCategoryInput").innerHTML = categoryList("expense")
    .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
    .join("");
  renderCustomSelects(["categoryInput", "fixedCategoryInput", "receiptCategoryInput"]);
}

function renderRecurringSettings() {
  $("#fixedDayInput").innerHTML = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return `<option value="${day}">${day}日</option>`;
  }).join("");

  const list = state.data.recurring || [];
  $("#fixedCostList").innerHTML = list.length ? list.map((item) => `
    <article class="fixed-cost-item ${item.active ? "" : "is-off"}">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.category)} / 毎月${item.day}日 / ${yen.format(item.amount)}${item.startMonth ? ` / ${escapeHtml(item.startMonth.replace("-", "年"))}月から` : ""}</span>
      </div>
      <div class="fixed-cost-actions">
        <button type="button" data-toggle-fixed="${escapeHtml(item.id)}">${item.active ? "停止" : "再開"}</button>
        <button type="button" data-remove-fixed="${escapeHtml(item.id)}">削除</button>
      </div>
    </article>
  `).join("") : `<p class="empty">固定費はまだありません。</p>`;

  $$("[data-toggle-fixed]").forEach((button) => {
    button.addEventListener("click", () => toggleRecurring(button.dataset.toggleFixed));
  });
  $$("[data-remove-fixed]").forEach((button) => {
    button.addEventListener("click", () => removeRecurring(button.dataset.removeFixed));
  });
  renderCustomSelects(["fixedDayInput"]);
}

function renderHome() {
  const items = currentMonthTransactions();
  const income = typeTotal(items, "income");
  const expense = typeTotal(items, "expense");
  const carriedBalance = carriedBalanceUntil(state.selectedMonth);
  $("#homeTitle").textContent = `${state.selectedMonth.getFullYear()}年 ${state.selectedMonth.getMonth() + 1}月`;
  $("#totalIncome").textContent = yen.format(income);
  $("#totalExpense").textContent = yen.format(expense);
  $("#totalBalance").textContent = yen.format(carriedBalance);
  $("#totalIncome").className = "summary-amount income";
  $("#totalExpense").className = "summary-amount expense";
  $("#totalBalance").className = `summary-amount ${carriedBalance < 0 ? "expense" : "income"}`;
  renderHomeCalendar(items);

  const recent = [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  $("#recentList").innerHTML = recent.length ? recent.map(renderTransaction).join("") : `<p class="empty">この月の記録はまだありません。</p>`;
  bindDeleteButtons($("#recentList"));
}

function renderHomeCalendar(items) {
  const calendar = $("#homeCalendar");
  const toggle = $("#homeMonthToggle");
  calendar.hidden = !state.homeCalendarOpen;
  toggle.setAttribute("aria-expanded", String(state.homeCalendarOpen));
  if (!state.homeCalendarOpen) {
    calendar.innerHTML = "";
    return;
  }

  const months = Array.from({ length: 12 }, (_, index) => {
    const isSelected = state.selectedMonth.getFullYear() === state.homePickerYear && state.selectedMonth.getMonth() === index;
    const monthItems = state.data.transactions.filter((item) => item.date.startsWith(`${state.homePickerYear}-${String(index + 1).padStart(2, "0")}`));
    const expense = typeTotal(monthItems, "expense");
    return `
      <button class="home-month-option ${isSelected ? "is-selected" : ""}" type="button" data-home-month="${index}">
        <span>${index + 1}月</span>
        ${expense ? `<small>${yen.format(expense)}</small>` : "<small>記録なし</small>"}
      </button>
    `;
  });

  calendar.innerHTML = `
    <div class="home-month-picker-head">
      <button class="icon-button" type="button" aria-label="前年" title="前年" data-home-picker-year="-1">‹</button>
      <strong>${state.homePickerYear}年</strong>
      <button class="icon-button" type="button" aria-label="翌年" title="翌年" data-home-picker-year="1">›</button>
    </div>
    <div class="home-month-grid">${months.join("")}</div>
  `;

}

function renderTransaction(item) {
  const sign = item.type === "income" ? "+" : "-";
  const color = categoryColor(item.category, item.type);
  return `
    <article class="transaction-item">
      <div class="category-dot" style="background:${color}; color:white">${escapeHtml(item.category.slice(0, 1))}</div>
      <div class="transaction-main">
        <span class="category-label">${escapeHtml(item.category)}</span>
        <span class="transaction-memo">${escapeHtml(item.memo || "メモなし")}</span>
        <span class="transaction-date">${formatDate(item.date)}</span>
      </div>
      <div class="transaction-side">
        <div class="transaction-amount ${item.type}">${sign}${yen.format(item.amount)}</div>
        <button class="delete-button" type="button" aria-label="削除" title="削除" data-delete="${escapeHtml(item.id)}">×</button>
      </div>
    </article>
  `;
}

function parseAmount(value) {
  const normalized = String(value)
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248))
    .replace(/[,，\s]/g, "");
  return Number(normalized);
}

function bindDeleteButtons(scope = document) {
  [...scope.querySelectorAll("[data-delete]")].forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.delete));
  });
}

function renderCalendar() {
  const calendar = $("#calendar");
  const year = state.selectedMonth.getFullYear();
  const month = state.selectedMonth.getMonth();
  $("#calendarMonthLabel").textContent = `${year}年 ${month + 1}月`;
  renderMonthPicker();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const visibleDayCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"].map((day) => `<div class="weekday">${day}</div>`);
  const days = [];

  for (let index = 0; index < visibleDayCount; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = toDateInput(date);
    const dayItems = state.data.transactions.filter((item) => item.date === iso);
    const incomeTotal = typeTotal(dayItems, "income");
    const expenseTotal = typeTotal(dayItems, "expense");
    const isOutsideMonth = date.getMonth() !== month;
    const isToday = iso === toDateInput(new Date());
    const hasEntry = incomeTotal || expenseTotal;
    days.push(`
      <button class="day-cell ${isOutsideMonth ? "is-muted" : ""} ${iso === state.selectedDay ? "is-selected" : ""} ${isToday ? "is-today" : ""} ${hasEntry ? "has-entry" : ""}" type="button" data-day="${iso}" ${isOutsideMonth ? "disabled" : ""}>
        <span class="day-num">${date.getDate()}</span>
        ${hasEntry ? `
          <span class="day-amounts">
            ${incomeTotal ? `<span class="day-total income ${calendarAmountClass(incomeTotal)}">${formatCalendarAmount(incomeTotal)}</span>` : ""}
            ${expenseTotal ? `<span class="day-total expense ${calendarAmountClass(expenseTotal)}">${formatCalendarAmount(expenseTotal)}</span>` : ""}
          </span>
        ` : ""}
      </button>
    `);
  }

  calendar.innerHTML = [...weekdays, ...days].join("");
  [...calendar.querySelectorAll("[data-day]")].forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDay = button.dataset.day;
      renderCalendar();
    });
  });

  renderDayDetail();
}

function renderEntryDatePicker() {
  const year = state.entryPickerMonth.getFullYear();
  const month = state.entryPickerMonth.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const visibleDayCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"].map((day) => `<div class="weekday">${day}</div>`);
  const days = [];

  $("#datePickerMonthLabel").textContent = `${year}年 ${month + 1}月`;
  $("#datePickerLabel").textContent = formatDate(state.entryDate);

  for (let index = 0; index < visibleDayCount; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = toDateInput(date);
    const isOutsideMonth = date.getMonth() !== month;
    days.push(`
      <button class="day-cell ${isOutsideMonth ? "is-muted" : ""} ${iso === state.entryDate ? "is-selected" : ""}" type="button" data-entry-date="${iso}" ${isOutsideMonth ? "disabled" : ""}>
        <span class="day-num">${date.getDate()}</span>
      </button>
    `);
  }

  $("#datePickerGrid").innerHTML = [...weekdays, ...days].join("");
  $$("[data-entry-date]").forEach((button) => {
    button.addEventListener("click", () => selectEntryDate(button.dataset.entryDate));
  });
}

function renderReceiptDatePicker() {
  const selectedDate = $("#receiptDateInput").value || toDateInput(new Date());
  const year = state.receiptPickerMonth.getFullYear();
  const month = state.receiptPickerMonth.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const visibleDayCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"].map((day) => `<div class="weekday">${day}</div>`);
  const days = [];

  $("#receiptDatePickerMonthLabel").textContent = `${year}年 ${month + 1}月`;
  $("#receiptDatePickerLabel").textContent = formatDate(selectedDate);

  for (let index = 0; index < visibleDayCount; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = toDateInput(date);
    const isOutsideMonth = date.getMonth() !== month;
    const isToday = iso === toDateInput(new Date());
    days.push(`
      <button class="day-cell ${isOutsideMonth ? "is-muted" : ""} ${iso === selectedDate ? "is-selected" : ""} ${isToday ? "is-today" : ""}" type="button" data-receipt-date="${iso}" ${isOutsideMonth ? "disabled" : ""}>
        <span class="day-num">${date.getDate()}</span>
      </button>
    `);
  }

  $("#receiptDatePickerGrid").innerHTML = [...weekdays, ...days].join("");
  $$("[data-receipt-date]").forEach((button) => {
    button.addEventListener("click", () => selectReceiptDate(button.dataset.receiptDate));
  });
}

function renderMonthPicker() {
  $("#pickerYearButton").textContent = `${state.pickerYear}年`;
  $("#pickerMonths").innerHTML = Array.from({ length: 12 }, (_, index) => {
    const isSelected = state.pickerYear === state.selectedMonth.getFullYear() && index === state.selectedMonth.getMonth();
    return `<button class="${isSelected ? "is-selected" : ""}" type="button" data-picker-month="${index}">${index + 1}月</button>`;
  }).join("");

  $$("[data-picker-month]").forEach((button) => {
    button.addEventListener("click", () => selectPickerMonth(Number(button.dataset.pickerMonth)));
  });
}

function renderDayDetail() {
  const items = state.data.transactions.filter((item) => item.date === state.selectedDay);
  $("#dayDetail").innerHTML = `
    <h3>${formatDate(state.selectedDay)}</h3>
    <div class="transaction-list">
      ${items.length ? items.map(renderTransaction).join("") : `<p class="empty">この日の記録はありません。</p>`}
    </div>
  `;
  bindDeleteButtons($("#dayDetail"));
}

function renderChart() {
  applyRecurringForMonth(state.chartMonth);
  const canvas = $("#categoryChart");
  const ctx = canvas.getContext("2d");
  const type = $("#chartType").value;
  const items = chartMonthTransactions().filter((item) => item.type === type);
  const groups = groupByCategory(items);
  const total = groups.reduce((sum, item) => sum + item.amount, 0);
  $("#chartMonthLabel").textContent = chartRange().label;
  $("#chartTodayPeriod").textContent = state.chartPeriod === "week" ? "今週へ移動" : "今月へ移動";
  renderChartPicker();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 54;
  ctx.lineCap = "butt";

  if (!total) {
    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--line");
    ctx.arc(160, 160, 98, 0, Math.PI * 2);
    ctx.stroke();
    $("#chartCenter").innerHTML = `<span class="chart-center-empty">記録なし</span>`;
    $("#chartLegend").innerHTML = `<p class="empty">この期間の${type === "expense" ? "支出" : "収入"}はまだありません。</p>`;
    $("#chartDetail").innerHTML = "";
    renderMonthComparison();
    return;
  }

  let start = -Math.PI / 2;
  const gap = groups.length > 1 ? 0.018 : 0;
  groups.forEach((group) => {
    const slice = (group.amount / total) * Math.PI * 2;
    const end = start + slice;
    const segmentGap = Math.min(gap, slice / 3);
    ctx.beginPath();
    ctx.strokeStyle = categoryColor(group.category, type);
    ctx.arc(160, 160, 98, start + segmentGap, end - segmentGap);
    ctx.stroke();
    start = end;
  });

  $("#chartCenter").innerHTML = `
    <span class="chart-center-label">${type === "expense" ? "支出" : "収入"}</span>
    <strong class="chart-center-amount">${yen.format(total)}</strong>
  `;
  if (!groups.some((group) => group.category === state.chartSelectedCategory)) state.chartSelectedCategory = "";

  $("#chartLegend").innerHTML = groups.map((group) => {
    const rate = Math.round((group.amount / total) * 100);
    return `
      <button class="legend-row ${group.category === state.chartSelectedCategory ? "is-selected" : ""}" type="button" data-chart-category="${escapeHtml(group.category)}">
        <span class="swatch" style="background:${categoryColor(group.category, type)}"></span>
        <strong>${escapeHtml(group.category)}</strong>
        <span>${yen.format(group.amount)} / ${rate}%</span>
      </button>
    `;
  }).join("");

  $$("[data-chart-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.chartSelectedCategory = state.chartSelectedCategory === button.dataset.chartCategory ? "" : button.dataset.chartCategory;
      renderChart();
    });
  });
  renderChartDetail(items, type);
  renderMonthComparison();
}

function renderMonthComparison() {
  const container = $("#monthCompare");
  if (state.chartPeriod !== "month") {
    container.innerHTML = "";
    return;
  }

  const currentMonth = new Date(state.chartMonth.getFullYear(), state.chartMonth.getMonth(), 1);
  const previousMonth = new Date(state.chartMonth.getFullYear(), state.chartMonth.getMonth() - 1, 1);
  applyRecurringForMonth(previousMonth);
  const currentItems = monthTransactions(currentMonth).filter((item) => item.type === "expense");
  const previousItems = monthTransactions(previousMonth).filter((item) => item.type === "expense");
  const currentGroups = new Map(groupByCategory(currentItems).map((item) => [item.category, item.amount]));
  const previousGroups = new Map(groupByCategory(previousItems).map((item) => [item.category, item.amount]));
  const categories = [...new Set([...currentGroups.keys(), ...previousGroups.keys()])];

  if (!categories.length) {
    container.innerHTML = "";
    return;
  }

  const rows = categories
    .map((category) => {
      const current = currentGroups.get(category) || 0;
      const previous = previousGroups.get(category) || 0;
      return { category, current, previous, diff: current - previous };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  const totalCurrent = typeTotal(currentItems, "expense");
  const totalPrevious = typeTotal(previousItems, "expense");
  const totalDiff = totalCurrent - totalPrevious;
  container.innerHTML = `
    <div class="section-title compare-title">
      <h3>前月との差</h3>
      <strong class="${totalDiff > 0 ? "expense" : "income"}">${totalDiff >= 0 ? "+" : ""}${yen.format(totalDiff)}</strong>
    </div>
    <div class="compare-list">
      ${rows.map((row) => `
        <div class="compare-row">
          <span class="swatch" style="background:${categoryColor(row.category, "expense")}"></span>
          <strong>${escapeHtml(row.category)}</strong>
          <span>${yen.format(row.previous)} → ${yen.format(row.current)}</span>
          <em class="${row.diff > 0 ? "expense" : row.diff < 0 ? "income" : ""}">${row.diff >= 0 ? "+" : ""}${yen.format(row.diff)}</em>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSearch() {
  const query = state.searchQuery.trim().toLowerCase();
  const type = state.searchType;
  const categoryNames = [...new Set((type === "all"
    ? [...categoryList("expense"), ...categoryList("income")]
    : categoryList(type)).map((category) => category.name))];
  $("#searchInput").value = state.searchQuery;
  $("#searchType").value = state.searchType;
  $("#searchCategory").innerHTML = `<option value="all">すべて</option>${categoryNames.map((category) => `
    <option value="${escapeHtml(category)}">${escapeHtml(category)}</option>
  `).join("")}`;
  $("#searchCategory").value = categoryNames.includes(state.searchCategory) ? state.searchCategory : "all";
  state.searchCategory = $("#searchCategory").value;

  const results = state.data.transactions
    .filter((item) => type === "all" || item.type === type)
    .filter((item) => state.searchCategory === "all" || item.category === state.searchCategory)
    .filter((item) => {
      if (!query) return true;
      return [item.memo, item.category, item.date, item.amount].some((value) => String(value || "").toLowerCase().includes(query));
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const income = typeTotal(results, "income");
  const expense = typeTotal(results, "expense");
  $("#searchSummary").innerHTML = `
    <span>${results.length}件</span>
    <strong class="income">収入 ${yen.format(income)}</strong>
    <strong class="expense">支出 ${yen.format(expense)}</strong>
  `;
  $("#searchResults").innerHTML = results.length ? results.map(renderTransaction).join("") : `<p class="empty">一致する記録はありません。</p>`;
  bindDeleteButtons($("#searchResults"));
  renderCustomSelects(["searchType", "searchCategory"]);
}

function chartRange() {
  if (state.chartPeriod === "week") {
    const base = new Date(state.chartMonth.getFullYear(), state.chartMonth.getMonth(), state.chartMonth.getDate());
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return {
      start: toDateInput(start),
      end: toDateInput(end),
      label: `${formatDate(toDateInput(start))} - ${formatDate(toDateInput(end))}`
    };
  }

  const start = new Date(state.chartMonth.getFullYear(), state.chartMonth.getMonth(), 1);
  const end = new Date(state.chartMonth.getFullYear(), state.chartMonth.getMonth() + 1, 0);
  return {
    start: toDateInput(start),
    end: toDateInput(end),
    label: `${state.chartMonth.getFullYear()}年 ${state.chartMonth.getMonth() + 1}月`
  };
}

function renderChartPicker() {
  const panel = $("#chartPickerPanel");
  if (panel.hidden) return;

  if (state.chartPeriod === "month") {
    const year = state.chartPickerYear;
    panel.innerHTML = `
      <div class="chart-picker-head">
        <button class="icon-button" type="button" data-chart-picker-year="${year - 1}" aria-label="前年" title="前年">‹</button>
        <strong>${year}年</strong>
        <button class="icon-button" type="button" data-chart-picker-year="${year + 1}" aria-label="翌年" title="翌年">›</button>
      </div>
      <div class="month-grid">
        ${Array.from({ length: 12 }, (_, index) => `
          <button class="${year === state.chartMonth.getFullYear() && index === state.chartMonth.getMonth() ? "is-selected" : ""}" type="button" data-chart-month="${index}">${index + 1}月</button>
        `).join("")}
      </div>
    `;
    $$("[data-chart-picker-year]").forEach((button) => {
      button.addEventListener("click", () => {
        state.chartPickerYear = Number(button.dataset.chartPickerYear);
        renderChartPicker();
      });
    });
    $$("[data-chart-month]").forEach((button) => {
      button.addEventListener("click", () => selectChartMonth(year, Number(button.dataset.chartMonth)));
    });
    return;
  }

  const pickerYear = state.chartWeekPickerYear;
  if (state.chartWeekPickerMonth === null) {
    panel.innerHTML = `
      <div class="chart-picker-head">
        <button class="icon-button" type="button" data-chart-week-year="${pickerYear - 1}" aria-label="前年" title="前年">‹</button>
        <strong>${pickerYear}年</strong>
        <button class="icon-button" type="button" data-chart-week-year="${pickerYear + 1}" aria-label="翌年" title="翌年">›</button>
      </div>
      <div class="month-grid">
        ${Array.from({ length: 12 }, (_, index) => `
          <button class="${pickerYear === state.chartMonth.getFullYear() && index === state.chartMonth.getMonth() ? "is-selected" : ""}" type="button" data-chart-week-month="${index}">${index + 1}月</button>
        `).join("")}
      </div>
    `;
    $$("[data-chart-week-year]").forEach((button) => {
      button.addEventListener("click", () => {
        state.chartWeekPickerYear = Number(button.dataset.chartWeekYear);
        renderChartPicker();
      });
    });
    $$("[data-chart-week-month]").forEach((button) => {
      button.addEventListener("click", () => {
        state.chartWeekPickerMonth = Number(button.dataset.chartWeekMonth);
        renderChartPicker();
      });
    });
    return;
  }

  const currentRange = chartRange();
  const monthStart = new Date(pickerYear, state.chartWeekPickerMonth, 1);
  const monthEnd = new Date(pickerYear, state.chartWeekPickerMonth + 1, 0);
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), monthStart.getDate() - monthStart.getDay());
  const weeks = [];
  for (let date = new Date(start); date <= monthEnd || date.getDay() !== 0; date.setDate(date.getDate() + 7)) {
    const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    if (weekEnd < monthStart) continue;
    weeks.push({ weekStart, weekEnd });
    if (weekStart > monthEnd) break;
  }
  panel.innerHTML = `
    <div class="chart-picker-head week-picker-head">
      <button class="text-button" type="button" data-chart-week-back>月を選ぶ</button>
      <strong>${pickerYear}年 ${state.chartWeekPickerMonth + 1}月</strong>
      <span></span>
    </div>
    <div class="week-list">
      ${weeks.map(({ weekStart, weekEnd }) => {
        const iso = toDateInput(weekStart);
        const label = `${formatDate(iso)} - ${formatDate(toDateInput(weekEnd))}`;
        return `<button class="${currentRange.start === iso ? "is-selected" : ""}" type="button" data-chart-week="${iso}">${label}</button>`;
      }).join("")}
    </div>
  `;
  $("[data-chart-week-back]").addEventListener("click", () => {
    state.chartWeekPickerMonth = null;
    renderChartPicker();
  });
  $$("[data-chart-week]").forEach((button) => {
    button.addEventListener("click", () => selectChartWeek(button.dataset.chartWeek));
  });
}

function renderChartDetail(items, type) {
  const selected = state.chartSelectedCategory;
  const detailItems = items
    .filter((item) => item.category === selected)
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = detailItems.reduce((sum, item) => sum + Number(item.amount), 0);

  $("#chartDetail").innerHTML = selected ? `
    <div class="section-title chart-detail-title">
      <h3>${escapeHtml(selected)}の内訳</h3>
      <strong>${yen.format(total)}</strong>
    </div>
    <div class="transaction-list">
      ${detailItems.length ? detailItems.map(renderTransaction).join("") : `<p class="empty">内訳はありません。</p>`}
    </div>
  ` : `<p class="chart-detail-empty">カテゴリをタップすると内訳を表示します。</p>`;
  bindDeleteButtons($("#chartDetail"));
}

function groupByCategory(items) {
  const map = new Map();
  items.forEach((item) => map.set(item.category, (map.get(item.category) || 0) + Number(item.amount)));
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function categoryList(type) {
  return state.data.categories[type] || [];
}

function categoryColor(category, type) {
  const found = type ? categoryList(type).find((item) => item.name === category) : null;
  if (found?.color) return found.color;
  return fallbackCategoryColor(category, type);
}

function fallbackCategoryColor(category, type = "expense") {
  let hash = 0;
  for (const char of `${type}-${category}`) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function openReceiptDialog() {
  state.receiptCandidate = null;
  state.receiptFile = null;
  state.receiptOcrLoading = false;
  $("#receiptCameraInput").value = "";
  $("#receiptImage").value = "";
  $("#receiptText").value = "";
  $("#receiptOcrStatus").textContent = "";
  $("#receiptAmountCandidates").hidden = true;
  $("#receiptAmountCandidates").innerHTML = "";
  $("#receiptCandidate").style.display = "none";
  $("#receiptPreview").style.display = "none";
  $("#receiptReview").hidden = true;
  $("#receiptFields").hidden = true;
  $("#receiptEdit").hidden = true;
  setReceiptDate(toDateInput(new Date()));
  closeReceiptDatePicker();
  $("#receiptDialog").showModal();
}

function openFileInput(selector) {
  const input = $(selector);
  input.value = "";
  input.click();
}

function previewReceipt(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const preview = $("#receiptPreview");
  state.receiptFile = file;
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
  $("#receiptReview").hidden = false;
  $("#receiptFields").hidden = true;
  $("#receiptCandidate").style.display = "none";
  $("#receiptEdit").hidden = true;
  $("#receiptText").value = "";
  $("#receiptOcrStatus").textContent = "";
  state.receiptCandidate = null;
}

async function showReceiptFields() {
  $("#receiptFields").hidden = false;
  if (!state.receiptFile || $("#receiptText").value.trim()) return;
  await readReceiptImage();
}

function parseReceipt() {
  const text = $("#receiptText").value;
  const amountInfo = extractReceiptAmount(text);
  const amount = amountInfo.amount;
  const date = extractReceiptDate(text) || toDateInput(new Date());

  if (!amount) {
    showToast("合計金額を読み取れませんでした。テキストに金額を入れてください");
    return;
  }

  state.receiptCandidate = {
    type: "expense",
    amount,
    amountCandidates: amountInfo.candidates,
    date,
    category: "食費",
    memo: "レシートから追加"
  };

  renderReceiptCandidateForm();
}

async function readReceiptImage() {
  if (state.receiptOcrLoading) return;
  state.receiptOcrLoading = true;
  setReceiptOcrStatus("画像から文字を読み取っています...");
  try {
    const Tesseract = await loadTesseract();
    const result = await Tesseract.recognize(state.receiptFile, "jpn+eng", {
      logger: ({ status, progress }) => {
        if (status === "recognizing text") {
          setReceiptOcrStatus(`画像から文字を読み取っています... ${Math.round(progress * 100)}%`);
        }
      }
    });
    const text = result?.data?.text?.trim() || "";
    if (!text) {
      setReceiptOcrStatus("文字を読み取れませんでした。写真を見ながら入力してください。");
      return;
    }
    $("#receiptText").value = text;
    setReceiptOcrStatus("読み取りました。内容を確認して候補を作ってください。");
    parseReceipt();
  } catch (error) {
    console.error(error);
    setReceiptOcrStatus("OCRを読み込めませんでした。ネット接続を確認するか、手入力してください。");
  } finally {
    state.receiptOcrLoading = false;
  }
}

function loadTesseract() {
  if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-tesseract]");
    if (existing) {
      existing.addEventListener("load", () => resolve(globalThis.Tesseract), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.dataset.tesseract = "true";
    script.addEventListener("load", () => {
      if (globalThis.Tesseract) resolve(globalThis.Tesseract);
      else reject(new Error("Tesseract failed to load"));
    }, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

function setReceiptOcrStatus(message) {
  $("#receiptOcrStatus").textContent = message;
}

function extractReceiptAmount(text) {
  const candidates = extractReceiptAmountCandidates(text);
  return {
    amount: candidates[0]?.amount || 0,
    candidates
  };
}

function extractReceiptAmountCandidates(text) {
  const lines = text.split(/\r?\n/).map((line) => normalizeReceiptText(line)).filter(Boolean);
  const candidateMap = new Map();

  lines.forEach((line) => {
    const values = [...line.matchAll(/[¥￥]?\s*([0-9][0-9,]{0,8})\s*円?/g)]
      .map((match) => Number(match[1].replace(/,/g, "")))
      .filter((value) => Number.isFinite(value) && value >= 10);
    if (!values.length) return;

    const totalMatch = line.match(/(合計|総計|税込|お買上|請求|支払|小計)/);
    const hasTotalLabel = Boolean(totalMatch);
    const ignoreLine = /(釣銭|お釣|つり銭|預り|預かり|現金|合算|対象|税率|点数|No\.?|TEL|電話)/i.test(line);
    const dateLine = /\d{2,4}[\/.\-年]\s*\d{1,2}[\/.\-月]\s*\d{1,2}/.test(line);
    values.forEach((value) => {
      if (dateLine) return;
      const current = candidateMap.get(value) || { amount: value, label: "", score: 0 };
      let score = 1;
      let label = "数字候補";
      if (hasTotalLabel && !ignoreLine) {
        score = 100;
        label = `${totalMatch[1]}の候補`;
      } else if (!ignoreLine) {
        score = value >= 100 ? 8 : 3;
        label = "金額候補";
      } else {
        score = 0;
      }
      if (score > current.score) candidateMap.set(value, { amount: value, label, score });
    });
  });

  return [...candidateMap.values()]
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.amount - a.amount)
    .slice(0, 6);
}

function extractReceiptDate(text) {
  const normalized = normalizeReceiptText(text);
  const match = normalized.match(/(?:^|\D)(20\d{2}|\d{2})[\/.\-年]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})/);
  if (!match) return "";

  const currentYear = new Date().getFullYear();
  let year = Number(match[1]);
  if (year < 100) year += year > currentYear % 100 + 1 ? 1900 : 2000;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeReceiptText(value) {
  return String(value || "")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248))
    .replace(/[，、]/g, ",")
    .replace(/[／]/g, "/")
    .replace(/[．]/g, ".")
    .replace(/[ー－]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function renderReceiptCandidateForm() {
  const candidate = state.receiptCandidate;
  if (!candidate) return;
  $("#receiptCandidate").style.display = "block";
  $("#receiptCandidate").innerHTML = `
    <strong>候補</strong><br>
    内容を確認し、必要なら下で修正して追加します。
  `;
  $("#receiptAmountInput").value = candidate.amount;
  renderReceiptAmountCandidates(candidate.amountCandidates || []);
  setReceiptDate(candidate.date);
  renderReceiptDatePicker();
  $("#receiptCategoryInput").value = candidate.category;
  $("#receiptMemoInput").value = candidate.memo;
  $("#receiptEdit").hidden = false;
  renderCustomSelect("receiptCategoryInput");
}

function renderReceiptAmountCandidates(candidates) {
  const wrap = $("#receiptAmountCandidates");
  if (!candidates.length) {
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  wrap.hidden = false;
  wrap.innerHTML = candidates.map((item, index) => `
    <button class="${index === 0 ? "is-primary" : ""}" type="button" data-receipt-amount="${item.amount}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${formatCalendarAmount(item.amount)}円</strong>
    </button>
  `).join("");

  wrap.querySelectorAll("[data-receipt-amount]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#receiptAmountInput").value = button.dataset.receiptAmount;
      wrap.querySelectorAll("button").forEach((target) => target.classList.toggle("is-primary", target === button));
    });
  });
}

function applyReceipt() {
  if (!state.receiptCandidate) {
    parseReceipt();
    if (!state.receiptCandidate) return;
  }

  const amount = parseAmount($("#receiptAmountInput").value);
  const date = $("#receiptDateInput").value;
  const category = $("#receiptCategoryInput").value;
  if (!amount || !date || !category) {
    showToast("候補の金額・日付・カテゴリを確認してください");
    return;
  }

  const item = {
    id: makeId(),
    type: "expense",
    amount,
    date,
    category,
    memo: $("#receiptMemoInput").value.trim() || "レシートから追加"
  };
  state.data.transactions.unshift(item);
  saveData();
  state.selectedMonth = new Date(`${item.date}T00:00:00`);
  state.selectedMonth = new Date(state.selectedMonth.getFullYear(), state.selectedMonth.getMonth(), 1);
  state.selectedDay = item.date;
  $("#receiptDialog").close();
  renderAll();
  showToast("レシート候補を追加しました");
  navigate("home");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "budget-data.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed.categories || !Array.isArray(parsed.transactions)) throw new Error("invalid");
      state.data = normalizeData(parsed);
      saveData();
      renderAll();
      showToast("読み込みました");
    } catch {
      showToast("読み込みに失敗しました");
    } finally {
      event.target.value = "";
    }
  });
  reader.readAsText(file);
}

function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
