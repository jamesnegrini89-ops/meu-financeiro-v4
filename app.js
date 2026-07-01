/**
 * app.js
 * Controlador Central, Fluxo do Ciclo de Vida do PWA e Saúde Diária - Versão 4.0.
 */
(function () {
  "use strict";

  const Data = window.FinanceData;
  let toastTimer = null;
  let deferredInstallPrompt = null;
  let serviceWorkerRegistration = null;

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function showView(viewName) {
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `${viewName}-view`));
    document.querySelectorAll("[data-view-target]").forEach(b => b.classList.toggle("active", b.dataset.viewTarget === viewName));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.add("open"); m.setAttribute("aria-hidden", "false"); }
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) { m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); }
  }

  function applyTheme() {
    const state = Data.getState();
    document.documentElement.dataset.theme = state.settings.theme;
    document.getElementById("app-name-title").textContent = state.settings.appName;
    document.title = state.settings.appName;
  }

  function toggleTheme() {
    Data.updateState(state => { state.settings.theme = state.settings.theme === "dark" ? "light" : "dark"; });
  }

  function refreshAll() {
    applyTheme();
    window.FinanceDashboard.updateDashboard();
    window.FinanceTransactions.renderTransactions();
    window.FinanceBudget.renderBudget();
    renderHealth();
    renderGoals();
    loadSettings();
  }

  function calculateHealthScore(log) {
    if (!log) return 0;
    const scores = [];
    if (log.waterMl !== "" && log.waterMl != null) scores.push(Math.min(100, (Data.toNumber(log.waterMl) / 2000) * 100));
    if (log.sleepHours !== "" && log.sleepHours != null) {
      const h = Data.toNumber(log.sleepHours);
      scores.push(h >= 7 && h <= 9 ? 100 : h >= 6 && h <= 10 ? 70 : 35);
    }
    if (log.exerciseMin !== "" && log.exerciseMin != null) scores.push(Math.min(100, (Data.toNumber(log.exerciseMin) / 30) * 100));
    if (log.mood) scores.push((Data.toNumber(log.mood) / 5) * 100);
    if (log.stress) scores.push(((6 - Data.toNumber(log.stress)) / 5) * 100);
    
    return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  }

  function calculateNoImpulseStreak() {
    const health = Data.getState().health;
    let streak = 0;
    const date = new Date(`${Data.getToday()}T12:00:00`);

    for (let index = 0; index < 366; index++) {
      const key = date.toISOString().slice(0, 10);
      if (health[key]?.noImpulse) {
        streak++;
        date.setDate(date.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function loadHealthForm(date) {
    const log = Data.getState().health[date] || {};
    document.getElementById("health-water").value = log.waterMl ?? "";
    document.getElementById("health-sleep").value = log.sleepHours ?? "";
    document.getElementById("health-exercise").value = log.exerciseMin ?? "";
    document.getElementById("health-mood").value = log.mood ?? "";
    document.getElementById("health-stress").value = log.stress ?? "";
    document.getElementById("health-note").value = log.note ?? "";
    document.getElementById("health-no-impulse").checked = Boolean(log.noImpulse);
  }

  function saveHealth(e) {
    e.preventDefault();
    const date = document.getElementById("health-date").value;
    if (!date) return alert("Indique o dia de referência fiscal.");

    const log = {
      waterMl: document.getElementById("health-water").value === "" ? "" : Data.toNumber(document.getElementById("health-water").value),
      sleepHours: document.getElementById("health-sleep").value === "" ? "" : Data.toNumber(document.getElementById("health-sleep").value),
      exerciseMin: document.getElementById("health-exercise").value === "" ? "" : Data.toNumber(document.getElementById("health-exercise").value),
      mood: document.getElementById("health-mood").value,
      stress: document.getElementById("health-stress").value,
      note: document.getElementById("health-note").value.trim(),
      noImpulse: document.getElementById("health-no-impulse").checked
    };

    Data.updateState(state => { state.health[date] = log; });
    window.FinanceDashboard.updateDashboard(); // Força recálculo de insights cruzados
    showToast("Dados diários indexados.");
  }

  function renderHealth() {
    const state = Data.getState();
    const todayLog = state.health[Data.getToday()] || {};

    document.getElementById("health-score").textContent = calculateHealthScore(todayLog);
    document.getElementById("health-today-water").textContent = `${Data.toNumber(todayLog.waterMl)} ml`;
    document.getElementById("health-today-sleep").textContent = `${Data.toNumber(todayLog.sleepHours)} h`;
    document.getElementById("health-today-exercise").textContent = `${Data.toNumber(todayLog.exerciseMin)} min`;
    document.getElementById("health-streak").textContent = `${calculateNoImpulseStreak()} dias`;

    const entries = Object.entries(state.health).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
    const history = document.getElementById("health-history");

    if (!entries.length) {
      history.innerHTML = '<div class="empty-state">Sem registros históricos de saúde.</div>';
      return;
    }

    history.innerHTML = entries.map(([date, log]) => `
      <div class="list-item" data-health-date="${date}">
        <div class="item-icon">♥</div>
        <div>
          <div class="item-title">${Data.formatDate(date)}</div>
          <div class="item-meta">${Data.toNumber(log.waterMl)} ml · ${Data.toNumber(log.sleepHours)} h · ${Data.toNumber(log.exerciseMin)} min ${log.noImpulse ? "· [Sem Impulso]" : ""}</div>
        </div>
        <div class="item-right">
          <div class="item-value">${calculateHealthScore(log)} pts</div>
          <div class="item-actions">
            <button class="action-button" data-health-action="delete" type="button">🗑️</button>
          </div>
        </div>
      </div>
    `).join("");
  }

  function resetGoalForm() {
    document.getElementById("goal-form").reset();
    document.getElementById("goal-id").value = "";
  }

  function openGoalModal(goal = null) {
    resetGoalForm();
    if (goal) {
      document.getElementById("goal-id").value = goal.id;
      document.getElementById("goal-name").value = goal.name;
      document.getElementById("goal-target").value = goal.target;
      document.getElementById("goal-current").value = goal.current;
      document.getElementById("goal-monthly").value = goal.monthly;
      document.getElementById("goal-deadline").value = goal.deadline || "";
    }
    openModal("goal-modal");
  }

  function saveGoal(e) {
    e.preventDefault();
    const id = Data.toNumber(document.getElementById("goal-id").value);
    const goal = {
      id: id || Data.generateId(),
      name: document.getElementById("goal-name").value.trim(),
      target: Math.abs(Data.toNumber(document.getElementById("goal-target").value)),
      current: Math.abs(Data.toNumber(document.getElementById("goal-current").value)),
      monthly: Math.abs(Data.toNumber(document.getElementById("goal-monthly").value)),
      deadline: document.getElementById("goal-deadline").value
    };

    if (!goal.name || goal.target <= 0) return alert("Defina o nome de forma clara.");

    Data.updateState(state => {
      const idx = state.goals.findIndex(item => item.id === id);
      if (idx >= 0) state.goals[idx] = goal;
      else state.goals.push(goal);
    });
    closeModal("goal-modal");
    showToast("Meta atualizada.");
  }

  function renderGoals() {
    const container = document.getElementById("goals-list");
    const goals = Data.getState().goals;

    if (!goals.length) {
      container.innerHTML = '<div class="empty-state">Nenhum planejamento de meta ativo.</div>';
      return;
    }

    container.innerHTML = goals.map(g => {
      const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
      return `
        <div class="goal-item" data-goal-id="${g.id}">
          <div class="goal-row-top"><strong>${Data.escapeHTML(g.name)}</strong><span>${Math.round(pct)}%</span></div>
          <div class="goal-details">${Data.formatCurrency(g.current)} de ${Data.formatCurrency(g.target)} ${g.deadline ? `· Limite ${Data.formatDate(g.deadline)}` : ""}</div>
          <div class="progress-track" style="margin-top:9px"><div class="progress-bar safe" style="width:${pct}%"></div></div>
          <div class="item-actions">
            <button class="action-button" data-goal-action="edit" type="button">✏️ Editar</button>
            <button class="action-button" data-goal-action="delete" type="button">🗑️ Excluir</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function loadSettings() {
    const settings = Data.getState().settings;
    document.getElementById("setting-app-name").value = settings.appName;
    document.getElementById("setting-initial-balance").value = settings.initialBalance;
    document.getElementById("setting-monthly-limit").value = settings.monthlyLimit;
  }

  function saveSettings() {
    Data.updateState(state => {
      state.settings.appName = document.getElementById("setting-app-name").value.trim() || "Meu Financeiro";
      state.settings.initialBalance = Data.toNumber(document.getElementById("setting-initial-balance").value);
      state.settings.monthlyLimit = Math.abs(Data.toNumber(document.getElementById("setting-monthly-limit").value)) || 2500;
    });
    showToast("Configurações aplicadas.");
  }

  function setupInstallPrompt() {
    const btn = document.getElementById("install-app-btn");
    window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstallPrompt = e; btn.hidden = false; });
    btn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null; btn.hidden = true;
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./service-worker.js").then(reg => {
      serviceWorkerRegistration = reg; reg.update();
      if (reg.waiting) document.getElementById("update-banner").hidden = false;
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) document.getElementById("update-banner").hidden = false; });
      });
    });

    document.getElementById("update-app-btn").addEventListener("click", () => {
      const waiting = serviceWorkerRegistration?.waiting;
      if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
      else window.location.reload();
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
  }

  function bindEvents() {
    document.querySelectorAll("[data-view-target]").forEach(b => b.addEventListener("click", () => showView(b.dataset.viewTarget)));
    document.querySelectorAll("[data-close-modal]").forEach(b => b.addEventListener("click", () => closeModal(b.dataset.closeModal)));
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
    document.getElementById("health-date").addEventListener("change", e => loadHealthForm(e.target.value));
    document.getElementById("health-form").addEventListener("submit", saveHealth);
    
    document.getElementById("health-history").addEventListener("click", e => {
      const btn = e.target.closest("[data-health-action]");
      const item = e.target.closest("[data-health-date]");
      if (btn && item && confirm("Remover histórico deste dia?")) {
        Data.updateState(state => { delete state.health[item.dataset.healthDate]; });
        window.FinanceDashboard.updateDashboard();
        showToast("Registro expurgado.");
      }
    });

    document.getElementById("open-goal-modal").addEventListener("click", () => openGoalModal());
    document.getElementById("goal-form").addEventListener("submit", saveGoal);
    document.getElementById("goals-list").addEventListener("click", e => {
      const btn = e.target.closest("[data-goal-action]");
      const item = e.target.closest("[data-goal-id]");
      if (!btn || !item) return;
      const id = Data.toNumber(item.dataset.goalId);
      if (btn.dataset.goalAction === "edit") openGoalModal(Data.getState().goals.find(i => i.id === id));
      if (btn.dataset.goalAction === "delete" && confirm("Excluir meta?")) {
        Data.updateState(state => { state.goals = state.goals.filter(i => i.id !== id); });
        showToast("Meta removida.");
      }
    });

    document.getElementById("save-settings").addEventListener("click", saveSettings);
    document.getElementById("export-json").addEventListener("click", () => { Data.exportJSON(); showToast("Backup pronto."); });
    document.getElementById("import-json").addEventListener("click", () => document.getElementById("import-json-file").click());
    document.getElementById("import-json-file").addEventListener("change", async e => {
      try { if (e.target.files?.[0]) { await Data.importJSON(e.target.files[0]); showToast("Backup integrado."); } } catch (err) { alert(err.message); }
    });
    document.getElementById("export-csv").addEventListener("click", () => { Data.exportTransactionsCSV(); showToast("CSV exportado."); });
    document.getElementById("reset-app-data").addEventListener("click", () => {
      if (confirm("Apagar TUDO?") && confirm("Certeza absoluta?")) { Data.clearState(); showToast("Limpeza concluída."); }
    });

    window.addEventListener("finance:data-changed", refreshAll);
  }

  function init() {
    applyTheme();
    document.getElementById("health-date").value = Data.getToday();
    loadHealthForm(Data.getToday());
    window.FinanceDashboard.init();
    window.FinanceTransactions.init();
    window.FinanceBudget.init();
    bindEvents();
    renderHealth();
    renderGoals();
    loadSettings();
    setupInstallPrompt();
    registerServiceWorker();
  }

  window.FinanceApp = { init, showView, showToast, openModal, closeModal, refreshAll, calculateNoImpulseStreak };
  document.addEventListener("DOMContentLoaded", init);
})();
