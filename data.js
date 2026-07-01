/**
 * data.js
 * Camada central de dados otimizada - Versão 4.0.
 * Mantém total compatibilidade com os registros salvos localmente.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "meu_financeiro_saude_v2";
  const APP_VERSION = 4;

  const categories = {
    income: ["Salário", "Freelance", "Investimentos", "Renda extra", "Outros"],
    expense: [
      "Alimentação", "Transporte", "Combustível", "Moradia", "Saúde", 
      "Farmácia", "Educação", "Lazer", "Compras", "Contas", 
      "Internet", "Cartões", "Serviços", "Outros"
    ],
    investment: ["XP", "Bipa", "CDB", "Tesouro Direto", "Fundos", "Ações", "Criptomoedas", "Outros"]
  };

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function getCurrentMonth() {
    return getToday().slice(0, 7);
  }

  function toNumber(value) {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function generateId(offset = 0) {
    return Date.now() + offset;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultState() {
    return {
      version: APP_VERSION,
      settings: {
        appName: "Meu Financeiro",
        initialBalance: 0,
        monthlyLimit: 2500,
        theme: "light"
      },
      transactions: [],
      budgets: [],
      goals: [],
      health: {},
      weeklyChecks: []
    };
  }

  function normalizeType(type) {
    const map = {
      receita: "income", income: "income", entrada: "income",
      despesa: "expense", expense: "expense", gasto: "expense",
      investimento: "investment", investment: "investment"
    };
    return map[String(type || "").toLowerCase()] || "expense";
  }

  function normalizeStatus(status) {
    return String(status || "").toLowerCase() === "planned" ? "planned" : "paid";
  }

  function normalizeTransaction(transaction, index) {
    const value = toNumber(transaction.amount ?? transaction.value);
    return {
      id: toNumber(transaction.id) || generateId(index),
      type: normalizeType(transaction.type),
      category: String(transaction.category || "Outros"),
      amount: Math.abs(value),
      date: String(transaction.date || getToday()).slice(0, 10),
      description: String(transaction.description || transaction.note || "Movimentação"),
      account: String(transaction.account || ""),
      status: normalizeStatus(transaction.status),
      note: String(transaction.note || "")
    };
  }

  function normalizeBudget(budget, index) {
    return {
      id: toNumber(budget.id) || generateId(index),
      category: String(budget.category || "Outros"),
      value: Math.abs(toNumber(budget.value ?? budget.amount)),
      month: String(budget.month || getCurrentMonth()).slice(0, 7)
    };
  }

  function normalizeGoal(goal, index) {
    return {
      id: toNumber(goal.id) || generateId(index),
      name: String(goal.name || "Meta"),
      target: Math.abs(toNumber(goal.target)),
      current: Math.abs(toNumber(goal.current)),
      monthly: Math.abs(toNumber(goal.monthly)),
      deadline: goal.deadline ? String(goal.deadline).slice(0, 10) : ""
    };
  }

  function migrateState(rawState) {
    const base = defaultState();
    const raw = rawState && typeof rawState === "object" ? rawState : {};

    const state = {
      version: APP_VERSION,
      settings: { ...base.settings, ...(raw.settings || {}) },
      transactions: Array.isArray(raw.transactions) ? raw.transactions.map(normalizeTransaction).filter(item => item.amount > 0) : [],
      budgets: Array.isArray(raw.budgets) ? raw.budgets.map(normalizeBudget).filter(item => item.value > 0) : [],
      goals: Array.isArray(raw.goals) ? raw.goals.map(normalizeGoal).filter(item => item.target > 0) : [],
      health: raw.health && typeof raw.health === "object" ? raw.health : {},
      weeklyChecks: Array.isArray(raw.weeklyChecks) ? raw.weeklyChecks : []
    };

    if (!state.budgets.length && raw.categoryBudgets && typeof raw.categoryBudgets === "object") {
      let offset = 0;
      Object.entries(raw.categoryBudgets).forEach(([category, value]) => {
        const numericValue = Math.abs(toNumber(value));
        if (numericValue > 0) {
          state.budgets.push({ id: generateId(offset++), category, value: numericValue, month: getCurrentMonth() });
        }
      });
    }

    state.settings.initialBalance = toNumber(state.settings.initialBalance);
    state.settings.monthlyLimit = Math.abs(toNumber(state.settings.monthlyLimit)) || 2500;
    state.settings.appName = String(state.settings.appName || "Meu Financeiro");
    state.settings.theme = state.settings.theme === "dark" ? "dark" : "light";

    return state;
  }

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return defaultState();
      return migrateState(JSON.parse(stored));
    } catch (error) {
      console.error("Erro ao carregar dados localmente:", error);
      return defaultState();
    }
  }

  function saveState(state, notify = true) {
    const normalized = migrateState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    if (notify) {
      window.dispatchEvent(new CustomEvent("finance:data-changed", { detail: deepClone(normalized) }));
    }
    return normalized;
  }

  function getState() { return deepClone(loadState()); }
  function updateState(mutator) { const state = loadState(); mutator(state); return saveState(state); }
  function replaceState(newState) { return saveState(migrateState(newState)); }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
    const state = defaultState();
    window.dispatchEvent(new CustomEvent("finance:data-changed", { detail: deepClone(state) }));
    return state;
  }

  function getTransactions() { return getState().transactions; }
  function getBudgets() { return getState().budgets; }
  function getMonthFromDate(date) { return String(date || "").slice(0, 7); }

  function getTransactionsByMonth(month, includePlanned = false) {
    return getTransactions().filter(transaction => {
      const sameMonth = getMonthFromDate(transaction.date) === month;
      const allowedStatus = includePlanned || transaction.status !== "planned";
      return sameMonth && allowedStatus;
    });
  }

  function getExpensesByCategory(month) {
    return getTransactionsByMonth(month)
      .filter(transaction => transaction.type === "expense")
      .reduce((totals, transaction) => {
        totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount;
        return totals;
      }, {});
  }

  function calculateCashBalance() {
    const state = getState();
    return state.transactions
      .filter(transaction => transaction.status !== "planned")
      .reduce((balance, transaction) => {
        if (transaction.type === "income") return balance + transaction.amount;
        return balance - transaction.amount;
      }, toNumber(state.settings.initialBalance));
  }

  function formatCurrency(value) {
    return toNumber(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    const [year, month, day] = String(dateString).slice(0, 10).split("-");
    if (!year || !month || !day) return "—";
    return `${day}/${month}/${year}`;
  }

  function formatMonth(monthString) {
    if (!monthString) return "—";
    const [year, month] = monthString.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => {
      const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
      return entities[char];
    });
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON() {
    downloadFile(`backup-meu-financeiro-${getToday()}.json`, JSON.stringify(getState(), null, 2), "application/json;charset=utf-8");
  }

  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(replaceState(JSON.parse(reader.result)));
        } catch (e) {
          reject(new Error("O arquivo selecionado não é um backup JSON válido."));
        }
      };
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsText(file);
    });
  }

  function exportTransactionsCSV() {
    const rows = [["Data", "Tipo", "Situação", "Categoria", "Descrição", "Conta", "Valor"]];
    getTransactions().sort((a, b) => b.date.localeCompare(a.date)).forEach(t => {
      const typeLabel = { income: "Receita", expense: "Despesa", investment: "Investimento" }[t.type];
      rows.push([t.date, typeLabel, t.status === "planned" ? "Planejada" : "Realizada", t.category, t.description, t.account, t.amount.toFixed(2).replace(".", ",")]);
    });
    const csv = "\ufeff" + rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    downloadFile(`transacoes-meu-financeiro-${getToday()}.csv`, csv, "text/csv;charset=utf-8");
  }

  window.FinanceData = {
    STORAGE_KEY, APP_VERSION, categories, getToday, getCurrentMonth, getMonthFromDate,
    toNumber, generateId, getState, saveState, updateState, replaceState, clearState,
    getTransactions, getBudgets, getTransactionsByMonth, getExpensesByCategory,
    calculateCashBalance, formatCurrency, formatDate, formatMonth, escapeHTML,
    exportJSON, importJSON, exportTransactionsCSV
  };
})();
