/**
 * dashboard.js
 * Painel principal otimizado com cruzamento de dados analíticos - Versão 4.0.
 */
(function () {
  "use strict";

  const Data = window.FinanceData;

  function getSelectedMonth() {
    return document.getElementById("dashboard-month")?.value || Data.getCurrentMonth();
  }

  function calculateMonthTotals(month) {
    return Data.getTransactionsByMonth(month, true).reduce(
      (totals, transaction) => {
        if (transaction.status !== "planned") {
          totals[transaction.type] += transaction.amount;
        }
        return totals;
      },
      { income: 0, expense: 0, investment: 0 }
    );
  }

  function renderTotals(month) {
    const totals = calculateMonthTotals(month);
    const balance = totals.income - totals.expense - totals.investment;

    document.getElementById("total-income").textContent = Data.formatCurrency(totals.income);
    document.getElementById("total-expense").textContent = Data.formatCurrency(totals.expense);
    document.getElementById("total-investment").textContent = Data.formatCurrency(totals.investment);

    const balanceElement = document.getElementById("balance");
    balanceElement.textContent = Data.formatCurrency(balance);
    balanceElement.classList.toggle("negative", balance < 0);

    return { ...totals, balance };
  }

  function renderRecentTransactions() {
    const container = document.getElementById("recent-transactions");
    const transactions = Data.getTransactions()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .slice(0, 5);

    if (!transactions.length) {
      container.innerHTML = '<div class="empty-state">Nenhuma transação registrada.</div>';
      return;
    }

    container.innerHTML = transactions.map(t => {
      const icon = t.type === "income" ? "💰" : t.type === "investment" ? "📈" : "💸";
      const sign = t.type === "income" ? "+" : "−";
      const plannedBadge = t.status === "planned" ? '<span class="status-badge">Planejada</span>' : "";

      return `
        <div class="list-item">
          <div class="item-icon">${icon}</div>
          <div>
            <div class="item-title">${Data.escapeHTML(t.description)}</div>
            <div class="item-meta">${Data.formatDate(t.date)} · ${Data.escapeHTML(t.category)} ${plannedBadge}</div>
          </div>
          <div class="item-right">
            <div class="item-value value-${t.type}">${sign} ${Data.formatCurrency(t.amount)}</div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderCategoryChart(month) {
    const container = document.getElementById("category-chart");
    const categories = Object.entries(Data.getExpensesByCategory(month)).sort((a, b) => b[1] - a[1]);
    const total = categories.reduce((sum, [, value]) => sum + value, 0);

    if (!categories.length || total <= 0) {
      container.innerHTML = '<div class="empty-state">Não há despesas neste mês.</div>';
      return;
    }

    container.innerHTML = categories.map(([category, value]) => {
      const percentage = (value / total) * 100;
      return `
        <div class="chart-row">
          <div class="chart-row-top">
            <span>${Data.escapeHTML(category)}</span>
            <strong>${Data.formatCurrency(value)} · ${Math.round(percentage)}%</strong>
          </div>
          <div class="chart-track">
            <div class="chart-bar" style="width:${Math.max(3, percentage)}%"></div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderInsights(month, totals) {
    const container = document.getElementById("dashboard-insights");
    const state = Data.getState();
    const limit = Data.toNumber(state.settings.monthlyLimit);
    const insights = [];
    
    const savingRate = totals.income > 0 ? ((totals.income - totals.expense) / totals.income) * 100 : 0;

    // Diagnóstico de limite de gastos geral
    if (limit > 0) {
      const use = (totals.expense / limit) * 100;
      if (use > 100) {
        insights.push({ title: "🚨 Limite excedido", text: `Suas despesas superaram o teto estipulado em ${Data.formatCurrency(totals.expense - limit)}.` });
      } else if (use >= 80) {
        insights.push({ title: "⚠️ Atenção operacional", text: `Você consumiu ${Math.round(use)}% do seu orçamento mensal máximo.` });
      } else {
        insights.push({ title: "✅ Orçamento sob controle", text: `Margem segura. Você ainda tem ${Data.formatCurrency(limit - totals.expense)} disponíveis.` });
      }
    }

    // Taxa de Poupança e Alocação
    if (totals.income > 0) {
      if (savingRate >= 20) {
        insights.push({ title: "💎 Excelente nível de retenção", text: `Você conseguiu poupar ${Math.round(savingRate)}% de todas as suas receitas acumuladas.` });
      } else {
        insights.push({ title: "📉 Margem de compressão baixa", text: `Apenas ${Math.round(Math.max(0, savingRate))}% das entradas restaram. Tente reavaliar despesas supérfluas.` });
      }
    }

    // Cruzamento Inteligente: Finanças + Saúde Diária (Impulso)
    if (typeof window.FinanceApp?.calculateNoImpulseStreak === "function") {
      const streak = window.FinanceApp.calculateNoImpulseStreak();
      if (streak >= 3) {
        insights.push({ title: "🛡️ Disciplina blindada", text: `Seu streak de ${streak} dias sem compras por impulso está protegendo ativamente seu caixa.` });
      }
    }

    if (!insights.length) {
      insights.push({ title: "Aguardando registros", text: `Insira novas movimentações para gerar relatórios automatizados de inteligência.` });
    }

    container.innerHTML = insights.slice(0, 3).map(i => `
      <div class="insight">
        <strong>${Data.escapeHTML(i.title)}</strong>
        <p>${Data.escapeHTML(i.text)}</p>
      </div>
    `).join("");
  }

  function updateDashboard() {
    const monthField = document.getElementById("dashboard-month");
    if (monthField && !monthField.value) monthField.value = Data.getCurrentMonth();

    const month = getSelectedMonth();
    const totals = renderTotals(month);
    renderRecentTransactions();
    renderCategoryChart(month);
    renderInsights(month, totals);
  }

  function init() {
    document.getElementById("dashboard-month").addEventListener("change", updateDashboard);
    updateDashboard();
  }

  window.FinanceDashboard = { init, updateDashboard, calculateMonthTotals };
})();
