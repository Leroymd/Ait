/**
 * Клиентский JavaScript для страницы аналитики
 * Отвечает за визуализацию аналитических данных
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация
  initUI();
  await loadAnalyticsData();
});

// Глобальные переменные для данных аналитики
let analyticsData = null;
let dailyStats = null;
let selectedPair = 'all';

/**
 * Инициализация пользовательского интерфейса
 */
function initUI() {
  // Обработчики событий для фильтров и кнопок
  document.getElementById('pairSelector').addEventListener('change', (e) => {
    selectedPair = e.target.value;
    renderAnalytics();
  });

  // Обработчики для вкладок
  const tabs = document.querySelectorAll('.analytics-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetSection = tab.getAttribute('data-section');
      
      // Скрываем все секции и показываем выбранную
      document.querySelectorAll('.analytics-section').forEach(section => {
        section.classList.add('hidden');
      });
      document.getElementById(targetSection).classList.remove('hidden');
      
      // Перерисовываем графики при переключении вкладок
      if (targetSection === 'capitalCurve') {
        renderCapitalCurve();
      } else if (targetSection === 'pairPerformance') {
        renderPairPerformance();
      } else if (targetSection === 'timeDistribution') {
        renderTimeDistribution();
      }
    });
  });
  
  // Кнопка обновления данных
  document.getElementById('refreshData').addEventListener('click', async () => {
    await loadAnalyticsData();
  });
  
  // Кнопка экспорта данных
  document.getElementById('exportData').addEventListener('click', () => {
    exportAnalyticsData();
  });
}

/**
 * Загрузка аналитических данных с сервера
 */
async function loadAnalyticsData() {
  try {
    // Показываем индикатор загрузки
    document.getElementById('loadingIndicator').classList.remove('hidden');
    
    // Запрашиваем данные аналитики
    const analyticsResponse = await fetch('/api/analytics/data');
    analyticsData = await analyticsResponse.json();
    
    // Запрашиваем ежедневную статистику
    const dailyStatsResponse = await fetch('/api/analytics/daily-stats');
    dailyStats = await dailyStatsResponse.json();
    
    // Обновляем селектор пар
    updatePairSelector();
    
    // Рендерим аналитику
    renderAnalytics();
    
    // Скрываем индикатор загрузки
    document.getElementById('loadingIndicator').classList.add('hidden');
  } catch (error) {
    console.error('Ошибка при загрузке данных аналитики:', error);
    document.getElementById('errorMessage').textContent = 'Ошибка загрузки данных';
    document.getElementById('errorMessage').classList.remove('hidden');
    document.getElementById('loadingIndicator').classList.add('hidden');
  }
}

/**
 * Обновление селектора торговых пар
 */
function updatePairSelector() {
  if (!analyticsData || !analyticsData.pairPerformance) return;
  
  const pairSelector = document.getElementById('pairSelector');
  
  // Очищаем текущий список
  while (pairSelector.options.length > 1) {
    pairSelector.remove(1);
  }
  
  // Добавляем опции для всех пар
  Object.keys(analyticsData.pairPerformance).forEach(pair => {
    const option = document.createElement('option');
    option.value = pair;
    option.textContent = pair;
    pairSelector.appendChild(option);
  });
}

/**
 * Рендеринг всех компонентов аналитики
 */
function renderAnalytics() {
  if (!analyticsData) return;
  
  // Рендерим общие метрики
  renderOverallMetrics();
  
  // Рендерим графики
  renderCapitalCurve();
  renderPairPerformance();
  renderTimeDistribution();
  
  // Рендерим рекомендации
  renderRecommendations();
  
  // Рендерим ежедневную статистику
  renderDailyStats();
  /**
 * Добавьте эту функцию в analytics.js после renderDailyStats()
 */

/**
 * Рендеринг анализа риск/доходность
 */
function renderRiskReward() {
  if (!analyticsData || !analyticsData.riskRewardStats) {
    document.getElementById('riskReward').innerHTML = '<div class="no-data">Нет данных для анализа риск/доходность</div>';
    return;
  }
  
  const stats = analyticsData.riskRewardStats;
  
  // Обновляем основные метрики
  document.getElementById('avgRiskRewardRatio').textContent = stats.avgRiskRewardRatio;
  document.getElementById('avgRiskPerTrade').textContent = `${stats.avgRiskPerTrade}%`;
  document.getElementById('avgRewardPerTrade').textContent = `${stats.avgRewardPerTrade}%`;
  document.getElementById('recommendedMaxLeverage').textContent = `${stats.recommendedMaxLeverage}x`;
  
  // Устанавливаем классы для метрик в зависимости от значений
  if (stats.avgRiskRewardRatio >= 2) {
    document.getElementById('avgRiskRewardRatio').classList.add('positive');
    document.getElementById('avgRiskRewardRatio').classList.remove('negative');
  } else if (stats.avgRiskRewardRatio < 1) {
    document.getElementById('avgRiskRewardRatio').classList.add('negative');
    document.getElementById('avgRiskRewardRatio').classList.remove('positive');
  }
  
  // Рендерим график влияния плеча на риск
  renderLeverageImpactChart(stats.leverageImpact);
  
  // Рендерим график вероятности потери депозита
  renderRiskOfRuinChart(stats.leverageImpact);
  
  // Рендерим таблицу с данными по плечу
  renderLeverageTable(stats.leverageImpact);
}

/**
 * Рендеринг графика влияния плеча на риск
 */
function renderLeverageImpactChart(leverageData) {
  if (!leverageData || leverageData.length === 0) return;
  
  const ctx = document.getElementById('leverageImpactChart').getContext('2d');
  
  // Уничтожаем предыдущий график, если он существует
  if (window.leverageImpactChart) {
    window.leverageImpactChart.destroy();
  }
  
  // Подготавливаем данные для графика
  const labels = leverageData.map(data => `${data.leverage}x`);
  const riskData = leverageData.map(data => data.risk);
  const rewardData = leverageData.map(data => data.potentialReward);
  
  window.leverageImpactChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Риск (%)',
          data: riskData,
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: 'Потенц. доходность (%)',
          data: rewardData,
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Процент (%)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Плечо (x)'
          }
        }
      }
    }
  });
}

/**
 * Рендеринг графика вероятности потери депозита
 */
function renderRiskOfRuinChart(leverageData) {
  if (!leverageData || leverageData.length === 0) return;
  
  const ctx = document.getElementById('riskOfRuinChart').getContext('2d');
  
  // Уничтожаем предыдущий график, если он существует
  if (window.riskOfRuinChart) {
    window.riskOfRuinChart.destroy();
  }
  
  // Подготавливаем данные для графика
  const labels = leverageData.map(data => `${data.leverage}x`);
  const ruinData = leverageData.map(data => data.riskOfRuin * 100); // Преобразуем в проценты
  
  // Определяем цвета в зависимости от уровня риска
  const backgroundColors = ruinData.map(value => {
    if (value < 10) return 'rgba(75, 192, 192, 0.7)'; // Зеленый для низкого риска
    if (value < 30) return 'rgba(255, 205, 86, 0.7)'; // Желтый для среднего риска
    if (value < 60) return 'rgba(255, 159, 64, 0.7)'; // Оранжевый для высокого риска
    return 'rgba(255, 99, 132, 0.7)'; // Красный для очень высокого риска
  });
  
  window.riskOfRuinChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Вероятность потери депозита (%)',
          data: ruinData,
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 2,
          tension: 0.1,
          fill: true,
          pointBackgroundColor: backgroundColors
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Вероятность (%)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Плечо (x)'
          }
        }
      }
    }
  });
}

/**
 * Рендеринг таблицы с данными по плечу
 */
function renderLeverageTable(leverageData) {
  if (!leverageData || leverageData.length === 0) return;
  
  const tableBody = document.getElementById('leverageTableBody');
  tableBody.innerHTML = '';
  
  leverageData.forEach(data => {
    const row = document.createElement('tr');
    
    // Определяем класс для рекомендации
    let recommendationClass = '';
    if (data.recommendation.includes('Безопасный')) {
      recommendationClass = 'positive';
    } else if (data.recommendation.includes('Опасный')) {
      recommendationClass = 'negative';
    } else if (data.recommendation.includes('Повышенный')) {
      recommendationClass = 'warning';
    }
    
    row.innerHTML = `
      <td>${data.leverage}x</td>
      <td>${data.risk}%</td>
      <td>${data.potentialReward}%</td>
      <td>${(data.riskOfRuin * 100).toFixed(2)}%</td>
      <td class="${recommendationClass}">${data.recommendation}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

/**
 * Добавьте в function renderAnalytics() вызов renderRiskReward() после других рендеров:
 * 
 * function renderAnalytics() {
 *   if (!analyticsData) return;
 *   
 *   // Рендерим общие метрики
 *   renderOverallMetrics();
 *   
 *   // Рендерим графики
 *   renderCapitalCurve();
 *   renderPairPerformance();
 *   renderTimeDistribution();
 *   
 *   // Рендерим рекомендации
 *   renderRecommendations();
 *   
 *   // Рендерим ежедневную статистику
 *   renderDailyStats();
 *   
 *   // Рендерим анализ риск/доходность
 *   renderRiskReward();
 * }
 */

/**
 * Также добавьте следующий CSS класс в styles.css:
 * .warning {
 *   color: var(--warning-color);
 * }
 */
}

/**
 * Рендеринг общих метрик
 */
function renderOverallMetrics() {
  if (!analyticsData || !analyticsData.overallMetrics) return;
  
  const metrics = analyticsData.overallMetrics;
  
  // Обновляем данные в UI
  document.getElementById('totalTrades').textContent = metrics.totalTrades;
  document.getElementById('winRate').textContent = `${metrics.winRate}%`;
  document.getElementById('totalProfit').textContent = `${metrics.totalProfit}%`;
  document.getElementById('profitFactor').textContent = metrics.profitFactor;
  document.getElementById('maxDrawdown').textContent = `${metrics.maxDrawdown}%`;
  document.getElementById('sharpeRatio').textContent = metrics.sharpeRatio;
  
  // Устанавливаем классы для цветов (зеленый/красный) в зависимости от значений
  const totalProfitElement = document.getElementById('totalProfit');
  if (metrics.totalProfit >= 0) {
    totalProfitElement.classList.add('positive');
    totalProfitElement.classList.remove('negative');
  } else {
    totalProfitElement.classList.add('negative');
    totalProfitElement.classList.remove('positive');
  }
}

/**
 * Рендеринг кривой капитала
 */
function renderCapitalCurve() {
  if (!analyticsData || !analyticsData.capitalCurve || analyticsData.capitalCurve.length <= 1) {
    document.getElementById('capitalCurveChart').innerHTML = '<div class="no-data">Недостаточно данных для построения графика</div>';
    return;
  }
  
  const capitalCurveData = analyticsData.capitalCurve;
  
  // Подготавливаем данные для графика
  const labels = capitalCurveData.map(point => {
    const date = new Date(point.timestamp);
    return date.toLocaleDateString();
  });
  
  const capitalData = capitalCurveData.map(point => point.capital);
  const drawdownData = capitalCurveData.map(point => point.drawdown);
  
  // Создаем график с помощью Chart.js
  const ctx = document.getElementById('capitalCurveChart').getContext('2d');
  
  // Уничтожаем предыдущий график, если он существует
  if (window.capitalChart) {
    window.capitalChart.destroy();
  }
  
  window.capitalChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Капитал',
          data: capitalData,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          yAxisID: 'y'
        },
        {
          label: 'Просадка (%)',
          data: drawdownData,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Капитал'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Просадка (%)'
          },
          // Инвертируем ось для просадки
          reverse: true,
          min: 0,
          max: 100,
          grid: {
            drawOnChartArea: false
          }
        },
        x: {
          title: {
            display: true,
            text: 'Дата'
          }
        }
      }
    }
  });
}

/**
 * Рендеринг производительности по торговым парам
 */
function renderPairPerformance() {
  if (!analyticsData || !analyticsData.pairPerformance) {
    document.getElementById('pairPerformanceChart').innerHTML = '<div class="no-data">Нет данных о производительности пар</div>';
    return;
  }
  
  // Фильтруем данные в зависимости от выбранной пары
  let pairData;
  if (selectedPair === 'all') {
    pairData = analyticsData.pairPerformance;
  } else {
    pairData = {
      [selectedPair]: analyticsData.pairPerformance[selectedPair]
    };
  }
  
  // Подготавливаем данные для графика
  const pairs = Object.keys(pairData);
  const winRates = pairs.map(pair => pairData[pair].winRate);
  const profitFactors = pairs.map(pair => pairData[pair].profitFactor);
  const totalProfits = pairs.map(pair => pairData[pair].totalProfit);
  
  // Создаем график с помощью Chart.js
  const ctx = document.getElementById('pairPerformanceChart').getContext('2d');
  
  // Уничтожаем предыдущий график, если он существует
  if (window.pairChart) {
    window.pairChart.destroy();
  }
  
  window.pairChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: pairs,
      datasets: [
        {
          label: 'Винрейт (%)',
          data: winRates,
          backgroundColor: 'rgba(75, 192, 192, 0.7)',
          yAxisID: 'y'
        },
        {
          label: 'Профит-фактор',
          data: profitFactors,
          backgroundColor: 'rgba(153, 102, 255, 0.7)',
          yAxisID: 'y1'
        },
        {
          label: 'Общий профит (%)',
          data: totalProfits,
          type: 'line',
          borderColor: 'rgba(255, 159, 64, 1)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Винрейт (%)'
          },
          min: 0,
          max: 100
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Профит-фактор'
          },
          min: 0,
          grid: {
            drawOnChartArea: false
          }
        },
        y2: {
          type: 'linear',
          display: false,
          min: Math.min(...totalProfits) < 0 ? Math.min(...totalProfits) * 1.2 : 0,
          max: Math.max(...totalProfits) * 1.2
        }
      }
    }
  });
  
  // Рендерим таблицу с подробной информацией о парах
  renderPairTable(pairData);
}

/**
 * Рендеринг таблицы с подробной информацией о торговых парах
 */
function renderPairTable(pairData) {
  const tableBody = document.getElementById('pairTableBody');
  tableBody.innerHTML = '';
  
  Object.entries(pairData).forEach(([pair, data]) => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${pair}</td>
      <td>${data.totalTrades}</td>
      <td>${data.winRate}%</td>
      <td class="${data.avgProfit >= 0 ? 'positive' : 'negative'}">${data.avgProfit}%</td>
      <td class="${data.totalProfit >= 0 ? 'positive' : 'negative'}">${data.totalProfit}%</td>
      <td class="positive">${data.maxProfit}%</td>
      <td class="negative">${data.maxLoss}%</td>
      <td>${data.profitFactor}</td>
      <td>${data.avgDuration}ч</td>
    `;
    
    tableBody.appendChild(row);
  });
}

/**
 * Рендеринг распределения результатов по времени
 */
function renderTimeDistribution() {
  if (!analyticsData || !analyticsData.timeDistribution || !analyticsData.timeDistribution.hourly) {
    document.getElementById('timeDistributionChart').innerHTML = '<div class="no-data">Нет данных о распределении по времени</div>';
    return;
  }
  
  const hourlyData = analyticsData.timeDistribution.hourly;
  
  // Подготавливаем данные для графика
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const tradeCounts = hourlyData.map(data => data.count);
  const avgProfits = hourlyData.map(data => data.avgProfit);
  
  // Создаем график с помощью Chart.js
  const ctx = document.getElementById('timeDistributionChart').getContext('2d');
  
  // Уничтожаем предыдущий график, если он существует
  if (window.timeChart) {
    window.timeChart.destroy();
  }
  
  window.timeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [
        {
          label: 'Количество сделок',
          data: tradeCounts,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          yAxisID: 'y'
        },
        {
          label: 'Средний профит (%)',
          data: avgProfits,
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Количество сделок'
          },
          min: 0
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Средний профит (%)'
          },
          grid: {
            drawOnChartArea: false
          }
        },
        x: {
          title: {
            display: true,
            text: 'Час (UTC)'
          }
        }
      }
    }
  });
  
  // Рендерим тепловую карту для часов
  renderTimeHeatmap();
}

/**
 * Рендеринг тепловой карты для часов торговли
 */
function renderTimeHeatmap() {
  if (!analyticsData || !analyticsData.timeDistribution || !analyticsData.timeDistribution.hourly) return;
  
  const hourlyData = analyticsData.timeDistribution.hourly;
  const heatmapContainer = document.getElementById('timeHeatmap');
  heatmapContainer.innerHTML = '';
  
  // Создаем тепловую карту
  const heatmapTable = document.createElement('table');
  heatmapTable.className = 'heatmap-table';
  
  // Находим максимальный и минимальный профит для нормализации цветов
  const profits = hourlyData.map(data => data.avgProfit);
  const maxProfit = Math.max(...profits);
  const minProfit = Math.min(...profits);
  
  // Добавляем заголовок
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = '<th>Час</th><th>Сделки</th><th>Профит</th>';
  heatmapTable.appendChild(headerRow);
  
  // Добавляем данные для каждого часа
  hourlyData.forEach((data, hour) => {
    const row = document.createElement('tr');
    
    // Вычисляем цвет ячейки на основе профита
    let color = 'rgba(200, 200, 200, 0.3)'; // Нейтральный цвет для нулевого профита
    
    if (data.count > 0) {
      if (data.avgProfit > 0) {
        // От белого до зеленого для положительного профита
        const intensity = data.avgProfit / maxProfit;
        color = `rgba(0, 128, 0, ${Math.min(0.2 + intensity * 0.8, 1)})`;
      } else if (data.avgProfit < 0) {
        // От белого до красного для отрицательного профита
        const intensity = data.avgProfit / minProfit;
        color = `rgba(255, 0, 0, ${Math.min(0.2 + intensity * 0.8, 1)})`;
      }
    }
    
    row.innerHTML = `
      <td>${hour}:00</td>
      <td>${data.count}</td>
      <td class="${data.avgProfit >= 0 ? 'positive' : 'negative'}" style="background-color: ${color}">
        ${data.avgProfit.toFixed(2)}%
      </td>
    `;
    
    heatmapTable.appendChild(row);
  });
  
  heatmapContainer.appendChild(heatmapTable);
}

/**
 * Рендеринг рекомендаций
 */
function renderRecommendations() {
  if (!analyticsData || !analyticsData.recommendedPairs || !analyticsData.recommendedTimeSlots) {
    document.getElementById('recommendations').innerHTML = '<div class="no-data">Нет данных для рекомендаций</div>';
    return;
  }
  
  // Рекомендации по парам
  const pairsContainer = document.getElementById('recommendedPairs');
  pairsContainer.innerHTML = '';
  
  if (analyticsData.recommendedPairs.length === 0) {
    pairsContainer.innerHTML = '<div class="no-data">Недостаточно данных для рекомендаций по парам</div>';
  } else {
    analyticsData.recommendedPairs.forEach(recommendation => {
      const card = document.createElement('div');
      card.className = 'recommendation-card';
      
      card.innerHTML = `
        <h4>${recommendation.symbol}</h4>
        <p>${recommendation.reason}</p>
        <div class="recommendation-metrics">
          <div class="metric">
            <span class="metric-label">Винрейт:</span>
            <span class="metric-value">${recommendation.performance.winRate}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Профит-фактор:</span>
            <span class="metric-value">${recommendation.performance.profitFactor}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Сделок:</span>
            <span class="metric-value">${recommendation.performance.totalTrades}</span>
          </div>
        </div>
      `;
      
      pairsContainer.appendChild(card);
    });
  }
  
  // Рекомендации по времени
  const timeContainer = document.getElementById('recommendedTimeSlots');
  timeContainer.innerHTML = '';
  
  if (analyticsData.recommendedTimeSlots.length === 0) {
    timeContainer.innerHTML = '<div class="no-data">Недостаточно данных для рекомендаций по времени</div>';
  } else {
    analyticsData.recommendedTimeSlots.forEach(slot => {
      const card = document.createElement('div');
      card.className = 'recommendation-card';
      
      card.innerHTML = `
        <h4>${slot.startHour}:00 - ${slot.endHour}:00 UTC</h4>
        <p>${slot.reason}</p>
        <div class="recommendation-metrics">
          <div class="metric">
            <span class="metric-label">Средний профит:</span>
            <span class="metric-value ${slot.avgProfit >= 0 ? 'positive' : 'negative'}">${slot.avgProfit}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Сделок:</span>
            <span class="metric-value">${slot.tradeCount}</span>
          </div>
        </div>
      `;
      
      timeContainer.appendChild(card);
    });
  }
}

/**
 * Рендеринг ежедневной статистики
 */
function renderDailyStats() {
  if (!dailyStats || dailyStats.length === 0) {
    document.getElementById('dailyStatsTable').innerHTML = '<div class="no-data">Нет данных о ежедневной статистике</div>';
    return;
  }
  
  const tableBody = document.getElementById('dailyStatsTableBody');
  tableBody.innerHTML = '';
  
  // Добавляем строки для каждого дня (ограничиваем до 30 дней)
  dailyStats.slice(0, 30).forEach(day => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${new Date(day.date).toLocaleDateString()}</td>
      <td>${day.totalTrades}</td>
      <td>${day.winCount}</td>
      <td>${day.lossCount}</td>
      <td>${day.winRate}%</td>
      <td class="${day.totalProfit >= 0 ? 'positive' : 'negative'}">${day.totalProfit}%</td>
      <td>${day.profitFactor}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

/**
 * Экспорт аналитических данных
 */
function exportAnalyticsData() {
  if (!analyticsData) return;
  
  const dataStr = JSON.stringify({
    exportDate: new Date().toISOString(),
    analyticsData,
    dailyStats
  }, null, 2);
  
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `trading-analytics-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}