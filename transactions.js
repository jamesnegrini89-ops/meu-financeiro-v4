/**
 * transactions.js
 * Gestão rigorosa do fluxo de transações, filtros dinâmicos e travas - Versão 4.0.
 */
(function () {
  "use strict";

  const Data = window.FinanceData;
  const elements = {};

  function cacheElements() {
    elements.modal = document.getElementById("transaction-modal");
    elements.form = document.getElementById("transaction-form");
    elements.modalTitle = document.getElementById("transaction-modal-title");
    elements.id = document.getElementById("trans-id");
    elements.type = document.getElementById("trans-type");
    elements.category = document.getElementById("trans-category");
    elements.value = document.getElementById("trans-value");
    elements.date = document.getElementById("trans-date");
    elements.account = document.getElementById("trans-account");
    elements.status = document.getElementById("trans-status");
    elements.description = document.getElementById("trans-description");
    elements.list = document.getElementById("transactions-list");
    elements.filterType = document.getElementById("filter-type");
    elements.filterCategory = document.getElementById("filter-category");
    elements.filterMonth = document.getElementById("filter-month");
    elements.filterSearch = document.getElementById("filter-search");
    elements.filteredTotal = document.getElementById("filtered-total");
  }

  function openModal(transaction = null) {
    elements.form.reset();
    elements.id.value = "";
    elements.date.value = Data.getToday();
    elements.type.value = "expense";
    elements.status.value = "paid";
    updateCategoryOptions("expense");

    if (transaction) {
      elements.modalTitle.textContent = "Editar movimentação";
      elements.id.value = transaction.id;
      elements.type.value = transaction.type;
      updateCategoryOptions(transaction.type, transaction.category);
      elements.value.value = transaction.amount;
      elements.date.value = transaction.date;
      elements.account.value = transaction.account || "";
      elements.status.value = transaction.status || "paid";
      elements.description.value = transaction.description || "";
    } else {
      elements.modalTitle.textContent = "Nova transação";
    }

    elements.modal.classList.add("open");
    elements.modal.setAttribute("aria-hidden", "false");
    setTimeout(() => elements.value.focus(), 60);
  }

  function closeModal() {
    elements.modal.classList.remove("open");
    elements.modal.setAttribute("aria-hidden", "true");
  }

  function updateCategoryOptions(type, selectedCategory = "") {
    const options = Data.categories[type] || Data.categories.expense;
    elements.category.innerHTML = options.map(c => `
      <option value="${Data.escapeHTML(c)}">${Data.escapeHTML(c)}</option>
    `).join("");
    elements.category.value = selectedCategory || options[0];
  }

  function populateFilterCategories() {
    const all = new Set([...Data.categories.income, ...Data.categories.expense, ...Data.categories.investment, ...Data.getTransactions().map(t => t.category)]);
    const current = elements.filterCategory.value || "all";
    
    elements.filterCategory.innerHTML = '<option value="all">Todas as Categorias</option>' + 
      [...all].sort((a, b) => a.localeCompare(b, "pt-BR")).map(c => `<option value="${Data.escapeHTML(c)}">${Data.escapeHTML(c)}</option>`).join("");
    
    elements.filterCategory.value = [...all].includes(current) ? current : "all";
  }

  function saveTransaction(event) {
    event.preventDefault();

    const id = Data.toNumber(elements.id.value);
    const transaction = {
      id: id || Data.generateId(),
      type: elements.type.value,
      category: elements.category.value,
      amount: Math.abs(Data.toNumber(elements.value.value)),
      date: elements.date.value,
      description: elements.description.value.trim(),
      account: elements.account.value.trim(),
      status: elements.status.value,
      note: ""
    };

    if (!transaction.description || transaction.amount <= 0 || !transaction.date) {
      alert("Preencha todos os campos regulamentares de forma válida.");
      return;
    }

    Data.updateState(state => {
      const idx = state.transactions.findIndex(item => item.id === id);
      if (idx >= 0) state.transactions[idx] = transaction;
      else state.transactions.push(transaction);
    });

    closeModal();
    window.FinanceApp.showToast(id ? "Registro atualizado." : "Transação homologada.");
  }

  function getFilteredTransactions() {
    const type = elements.filterType.value;
    const category = elements.filterCategory.value;
    const month = elements.filterMonth.value;
    const search = elements.filterSearch.value.trim().toLowerCase();

    return Data.getTransactions()
      .filter(t => {
        const typeMatches = type === "all" || (type === "planned" && t.status === "planned") || (type !== "planned" && t.type === type && t.status !== "planned");
        const categoryMatches = category === "all" || t.category === category;
        const monthMatches = !month || Data.getMonthFromDate(t.date) === month;
        const searchMatches = !search || [t.description, t.category, t.account].some(v => String(v || "").toLowerCase().includes(search));
        return typeMatches && categoryMatches && monthMatches && searchMatches;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }

  function renderTransactions() {
    populateFilterCategories();
    const transactions = getFilteredTransactions();

    const netTotal = transactions.reduce((sum, t) => t.type === "income" ? sum + t.amount : sum - t.amount, 0);
    elements.filteredTotal.textContent = Data.formatCurrency(netTotal);
    elements.filteredTotal.className = netTotal < 0 ? "value-expense" : "value-income";

    if (!transactions.length) {
      elements.list.innerHTML = '<div class="empty-state">Nenhum registro localizado sob os filtros correntes.</div>';
      return;
    }

    elements.list.innerHTML = transactions.map(t => {
      const icon = t.type === "income" ? "💰" : t.type === "investment" ? "📈" : "💸";
      const sign = t.type === "income" ? "+" : "−";
      const plannedBadge = t.status === "planned" ? '<span class="status-badge">Planejada</span>' : "";

      return `
        <div class="list-item" data-id="${t.id}">
          <div class="item-icon">${icon}</div>
          <div>
            <div class="item-title">${Data.escapeHTML(t.description)}</div>
            <div class="item-meta">${Data.formatDate(t.date)} · ${Data.escapeHTML(t.category)} ${t.account ? `· [${Data.escapeHTML(t.account)}]` : ""} ${plannedBadge}</div>
          </div>
          <div class="item-right">
            <div class="item-value value-${t.type}">${sign} ${Data.formatCurrency(t.amount)}</div>
            <div class="item-actions">
              <button class="action-button" data-action="edit" type="button" title="Editar">✏️</button>
              <button class="action-button" data-action="delete" type="button" title="Excluir">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function handleListClick(event) {
    const btn = event.target.closest("[data-action]");
    const item = event.target.closest("[data-id]");
    if (!btn || !item) return;

    const id = Data.toNumber(item.dataset.id);
    if (btn.dataset.action === "edit") {
      const target = Data.getTransactions().find(i => i.id === id);
      if (target) openModal(target);
    }
    if (btn.dataset.action === "delete") {
      const target = Data.getTransactions().find(i => i.id === id);
      if (target && confirm(`Deseja sumariamente excluir "${target.description}"?`)) {
        Data.updateState(state => { state.transactions = state.transactions.filter(i => i.id !== id); });
        window.FinanceApp.showToast("Transação eliminada.");
      }
    }
  }

  function clearFilters() {
    elements.filterType.value = "all";
    elements.filterCategory.value = "all";
    elements.filterMonth.value = Data.getCurrentMonth();
    elements.filterSearch.value = "";
    renderTransactions();
  }

  function init() {
    cacheElements();
    elements.filterMonth.value = Data.getCurrentMonth();

    document.getElementById("open-transaction-modal").addEventListener("click", () => openModal());
    elements.form.addEventListener("submit", saveTransaction);
    elements.type.addEventListener("change", () => updateCategoryOptions(elements.type.value));
    elements.list.addEventListener("click", handleListClick);

    [elements.filterType, elements.filterCategory, elements.filterMonth].forEach(el => el.addEventListener("change", renderTransactions));
    elements.filterSearch.addEventListener("input", renderTransactions);
    document.getElementById("clear-filters").addEventListener("click", clearFilters);

    renderTransactions();
  }

  window.FinanceTransactions = { init, renderTransactions, openModal, closeModal };
})();
