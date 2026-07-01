/**
 * budget.js
 * Alocação de limites mensais por categoria e metas - Versão 4.0.
 */
(function () {
  "use strict";

  const Data = window.FinanceData;
  const elements = {};

  function cacheElements() {
    elements.modal = document.getElementById("budget-modal");
    elements.form = document.getElementById("budget-form");
    elements.id = document.getElementById("budget-id");
    elements.category = document.getElementById("budget-category");
    elements.value = document.getElementById("budget-value");
    elements.month = document.getElementById("budget-month");
    elements.viewMonth = document.getElementById("budget-view-month");
    elements.list = document.getElementById("budget-categories");
    elements.total = document.getElementById("budget-total");
    elements.spent = document.getElementById("budget-spent");
    elements.available = document.getElementById("budget-available");
  }

  function populateCategories(selected = "") {
    const cats = Data.categories.expense;
    elements.category.innerHTML = cats.map(c => `<option value="${Data.escapeHTML(c)}">${Data.escapeHTML(c)}</option>`).join("");
    if (selected && !cats.includes(selected)) {
      const opt = document.createElement("option");
      opt.value = selected; opt.textContent = selected;
      elements.category.appendChild(opt);
    }
    elements.category.value = selected || cats[0];
  }

  function openModal(budget = null) {
    elements.form.reset();
    elements.id.value = "";
    elements.month.value = elements.viewMonth.value || Data.getCurrentMonth();
    populateCategories();

    if (budget) {
      elements.id.value = budget.id;
      elements.value.value = budget.value;
      elements.month.value = budget.month;
      populateCategories(budget.category);
    }

    elements.modal.classList.add("open");
    elements.modal.setAttribute("aria-hidden", "false");
    setTimeout(() => elements.value.focus(), 60);
  }

  function closeModal() {
    elements.modal.classList.remove("open");
    elements.modal.setAttribute("aria-hidden", "true");
  }

  function saveBudget(event) {
    event.preventDefault();

    const id = Data.toNumber(elements.id.value);
    const budget = {
      id: id || Data.generateId(),
      category: elements.category.value,
      value: Math.abs(Data.toNumber(elements.value.value)),
      month: elements.month.value
    };

    if (budget.value <= 0 || !budget.month) {
      alert("Defina parâmetros de valores reais plausíveis.");
      return;
    }

    Data.updateState(state => {
      const dup = state.budgets.findIndex(item => item.month === budget.month && item.category === budget.category && item.id !== id);
      const edit = state.budgets.findIndex(item => item.id === id);

      if (edit >= 0) state.budgets[edit] = budget;
      else if (dup >= 0) state.budgets[dup].value = budget.value;
      else state.budgets.push(budget);
    });

    elements.viewMonth.value = budget.month;
    closeModal();
    window.FinanceApp.showToast("Orçamento estabilizado.");
  }

  function renderBudget() {
    const month = elements.viewMonth.value || Data.getCurrentMonth();
    const budgets = Data.getBudgets().filter(b => b.month === month).sort((a, b) => a.category.localeCompare(b.category, "pt-BR"));
    const spentByCategory = Data.getExpensesByCategory(month);
    
    const totalBudget = budgets.reduce((sum, b) => sum + b.value, 0);
    const totalSpent = Object.values(spentByCategory).reduce((sum, v) => sum + v, 0);
    const available = totalBudget - totalSpent;

    elements.total.textContent = Data.formatCurrency(totalBudget);
    elements.spent.textContent = Data.formatCurrency(totalSpent);
    elements.available.textContent = Data.formatCurrency(available);
    elements.available.classList.toggle("negative", available < 0);

    if (!budgets.length) {
      elements.list.innerHTML = `<div class="empty-state">Nenhum limite fixado para o mês de ${Data.escapeHTML(Data.formatMonth(month))}.</div>`;
      return;
    }

    elements.list.innerHTML = budgets.map(b => {
      const spent = spentByCategory[b.category] || 0;
      const pct = b.value > 0 ? (spent / b.value) * 100 : 0;
      const cls = pct > 90 ? "danger" : pct >= 70 ? "warning" : "safe";

      return `
        <div class="budget-item" data-budget-id="${b.id}">
          <div class="budget-row-top">
            <strong>${Data.escapeHTML(b.category)} ${pct > 100 ? "⚠️" : ""}</strong>
            <span>${Math.round(pct)}%</span>
          </div>
          <div class="budget-details">${Data.formatCurrency(spent)} consumidos de ${Data.formatCurrency(b.value)}</div>
          <div class="progress-track" style="margin-top:9px">
            <div class="progress-bar ${cls}" style="width:${Math.min(100, pct)}%"></div>
          </div>
          <div class="item-actions">
            <button class="action-button" data-budget-action="edit" type="button">✏️ Editar</button>
            <button class="action-button" data-budget-action="delete" type="button">🗑️ Excluir</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function handleListClick(event) {
    const btn = event.target.closest("[data-budget-action]");
    const item = event.target.closest("[data-budget-id]");
    if (!btn || !item) return;

    const id = Data.toNumber(item.dataset.budgetId);
    if (btn.dataset.budgetAction === "edit") {
      const b = Data.getBudgets().find(i => i.id === id);
      if (b) openModal(b);
    }
    if (btn.dataset.budgetAction === "delete" && confirm("Remover este planejamento de categoria?")) {
      Data.updateState(state => { state.budgets = state.budgets.filter(i => i.id !== id); });
      window.FinanceApp.showToast("Orçamento removido.");
    }
  }

  function init() {
    cacheElements();
    elements.viewMonth.value = Data.getCurrentMonth();
    populateCategories();

    document.getElementById("open-budget-modal").addEventListener("click", () => openModal());
    elements.form.addEventListener("submit", saveBudget);
    elements.viewMonth.addEventListener("change", renderBudget);
    elements.list.addEventListener("click", handleListClick);

    renderBudget();
  }

  window.FinanceBudget = { init, renderBudget, openModal, closeModal };
})();
