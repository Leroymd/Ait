/**
 * Клиентский JavaScript для страницы позиций
 * Отвечает за управление позициями и ордерами
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация
  initUI();
  await loadData();
});

// Глобальные переменные
let activePositions = [];
let historyPositions = [];
let openOrders = [];
let availablePairs = [];
let historyPage = 1;
let historyTotalPages = 1;
let historyItemsPerPage = 20;
let selectedHistoryPair = 'all';
let selectedHistoryPeriod = 'month';
let balances = {};

/**
 * Инициализация пользовательского интерфейса
 */
function initUI() {
  // Обработчики для вкладок
  const tabs = document.querySelectorAll('.positions-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetSection = tab.getAttribute('data-section');
      
      // Скрываем все секции и показываем выбранную
      document.querySelectorAll('.positions-section').forEach(section => {
        section.classList.add('hidden');
      });
      document.getElementById(targetSection).classList.remove('hidden');
    });
  });
  
  // Обработчик для кнопки обновления
  document.getElementById('refreshPositions').addEventListener('click', async () => {
    await loadData();
  });
  
  // Обработчики для секции активных позиций
  document.getElementById('closeAllPositions')?.addEventListener('click', async () => {
    if (confirm('Вы действительно хотите закрыть все активные позиции?')) {
      await closeAllPositions();
    }
  });
  
  document.getElementById('addPosition')?.addEventListener('click', () => {
    showNewPositionModal();
  });
  
  // Обработчики для секции истории позиций
  document.getElementById('historyPair')?.addEventListener('change', (e) => {
    selectedHistoryPair = e.target.value;
    historyPage = 1;
    renderHistoryPositions();
  });
  
  document.getElementById('historyPeriod')?.addEventListener('change', (e) => {
    selectedHistoryPeriod = e.target.value;
    historyPage = 1;
    loadHistoryPositions();
  });
  
  document.getElementById('exportHistory')?.addEventListener('click', () => {
    exportHistoryData();
  });
  
  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (historyPage > 1) {
      historyPage--;
      renderHistoryPositions();
    }
  });
  
  document.getElementById('nextPage')?.addEventListener('click', () => {
    if (historyPage < historyTotalPages) {
      historyPage++;
      renderHistoryPositions();
    }
  });
  
  // Обработчики для секции ордеров
  document.getElementById('cancelAllOrders')?.addEventListener('click', async () => {
    if (confirm('Вы действительно хотите отменить все открытые ордера?')) {
      await cancelAllOrders();
    }
  });
  
  document.getElementById('addOrder')?.addEventListener('click', () => {
    showNewPositionModal(true);
  });
  
  // Обработчики для модального окна новой позиции
  document.querySelector('.close-modal')?.addEventListener('click', () => {
    hideNewPositionModal();
  });
  
  document.getElementById('cancelPosition')?.addEventListener('click', () => {
    hideNewPositionModal();
  });
  
  document.getElementById('createPosition')?.addEventListener('click', async () => {
    await createNewPosition();
  });
  
  // Обработчик для кнопок размера позиции
  const sizeButtons = document.querySelectorAll('.size-buttons button');
  sizeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const sizePercent = parseInt(button.getAttribute('data-size'), 10);
      const pair = document.getElementById('positionPair').value;
      const baseAsset = pair.replace(/USDT$/, '');
      
      if (balances[baseAsset]) {
        const size = (balances[baseAsset] * sizePercent / 100).toFixed(6);
        document.getElementById('positionSize').value = size;
      }
    });
  });
  
  // Обработчик для трейлинг-стопа
  document.getElementById('positionUseTrailingStop')?.addEventListener('change', (e) => {
    const trailingStopBlock = document.getElementById('trailingStopBlock');
    if (e.target.checked) {
      trailingStopBlock.style.display = 'flex';
    } else {
      trailingStopBlock.style.display = 'none';
    }
  });
  
  // Обработчики для вычисления стоп-лосса и тейк-профита по процентам
  document.getElementById('positionStopLossPercent')?.addEventListener('input', (e) => {
    const percent = parseFloat(e.target.value);
    const entryPrice = parseFloat(document.getElementById('positionPrice').value);
    const direction = document.querySelector('input[name="positionDirection"]:checked').value;
    
    if (!isNaN(percent) && !isNaN(entryPrice) && entryPrice > 0) {
      const stopLossPrice = direction === 'LONG' 
        ? entryPrice * (1 - percent / 100) 
        : entryPrice * (1 + percent / 100);
      
      document.getElementById('positionStopLoss').value = stopLossPrice.toFixed(8);
    }
  });
  
  document.getElementById('positionTakeProfitPercent')?.addEventListener('input', (e) => {
    const percent = parseFloat(e.target.value);
    const entryPrice = parseFloat(document.getElementById('positionPrice').value);
    const direction = document.querySelector('input[name="positionDirection"]:checked').value;
    
    if (!isNaN(percent) && !isNaN(entryPrice) && entryPrice > 0) {
      const takeProfitPrice = direction === 'LONG' 
        ? entryPrice * (1 + percent / 100) 
        : entryPrice * (1 - percent / 100);
      
      document.getElementById('positionTakeProfit').value = takeProfitPrice.toFixed(8);
    }
  });
  
  // Обратные обработчики для вычисления процентов по ценам
  document.getElementById('positionStopLoss')?.addEventListener('input', (e) => {
    const stopLossPrice = parseFloat(e.target.value);
    const entryPrice = parseFloat(document.getElementById('positionPrice').value);
    const direction = document.querySelector('input[name="positionDirection"]:checked').value;
    
    if (!isNaN(stopLossPrice) && !isNaN(entryPrice) && entryPrice > 0 && stopLossPrice > 0) {
      let percent;
      if (direction === 'LONG') {
        percent = (1 - stopLossPrice / entryPrice) * 100;
      } else {
        percent = (stopLossPrice / entryPrice - 1) * 100;
      }
      
      document.getElementById('positionStopLossPercent').value = Math.abs(percent).toFixed(2);
    }
  });
  
  document.getElementById('positionTakeProfit')?.addEventListener('input', (e) => {
    const takeProfitPrice = parseFloat(e.target.value);
    const entryPrice = parseFloat(document.getElementById('positionPrice').value);
    const direction = document.querySelector('input[name="positionDirection"]:checked').value;
    
    if (!isNaN(takeProfitPrice) && !isNaN(entryPrice) && entryPrice > 0 && takeProfitPrice > 0) {
      let percent;
      if (direction === 'LONG') {
        percent = (takeProfitPrice / entryPrice - 1) * 100;
      } else {
        percent = (1 - takeProfitPrice / entryPrice) * 100;
      }
      
      document.getElementById('positionTakeProfitPercent').value = Math.abs(percent).toFixed(2);
    }
  });
  
  // Обработчик изменения направления позиции - пересчитываем SL/TP
  document.querySelectorAll('input[name="positionDirection"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const stopLossPercentInput = document.getElementById('positionStopLossPercent');
      const takeProfitPercentInput = document.getElementById('positionTakeProfitPercent');
      
      if (stopLossPercentInput.value) {
        const event = new Event('input');
        stopLossPercentInput.dispatchEvent(event);
      }
      
      if (takeProfitPercentInput.value) {
        const event = new Event('input');
        takeProfitPercentInput.dispatchEvent(event);
      }
    });
  });
}

/**
 * Загрузка всех данных
 */
async function loadData() {
  try {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
    
    // Загружаем список доступных пар
    await loadAvailablePairs();
    
    // Загружаем активные позиции
    await loadActivePositions();
    
    // Загружаем историю позиций
    await loadHistoryPositions();
    
    // Загружаем открытые ордера
    await loadOpenOrders();
    
    // Загружаем балансы
    await loadBalances();
    
    document.getElementById('loadingIndicator').classList.add('hidden');
  } catch (error) {
    console.error('Ошибка при загрузке данных:', error);
    document.getElementById('errorMessage').textContent = 'Ошибка загрузки данных: ' + error.message;
    document.getElementById('errorMessage').classList.remove('hidden');
    document.getElementById('loadingIndicator').classList.add('hidden');
  }
}

/**
 * Загрузка списка доступных торговых пар
 */
async function loadAvailablePairs() {
  try {
    const response = await fetch('/api/pairs');
    const data = await response.json();
    
    if (data.pairs && Array.isArray(data.pairs)) {
      availablePairs = data.pairs;
      
      // Обновляем выпадающие списки с парами
      updatePairSelectors();
    }
  } catch (error) {
    console.error('Ошибка при загрузке списка пар:', error);
    throw error;
  }
}

/**
 * Обновление селекторов пар
 */
function updatePairSelectors() {
  // Обновляем селектор для истории позиций
  const historyPairSelector = document.getElementById('historyPair');
  if (historyPairSelector) {
    // Сохраняем текущее значение
    const currentValue = historyPairSelector.value;
    
    // Очищаем текущие опции (кроме 'Все пары')
    while (historyPairSelector.options.length > 1) {
      historyPairSelector.remove(1);
    }
    
    // Добавляем опции из загруженного списка
    availablePairs.forEach(pair => {
      const option = document.createElement('option');
      option.value = pair;
      option.textContent = pair;
      historyPairSelector.appendChild(option);
    });
    
    // Восстанавливаем выбранное значение, если оно все еще существует
    if (currentValue !== 'all' && availablePairs.includes(currentValue)) {
      historyPairSelector.value = currentValue;
    }
  }
  
  // Обновляем селектор для модального окна новой позиции
  const positionPairSelector = document.getElementById('positionPair');
  if (positionPairSelector) {
    // Очищаем текущие опции
    positionPairSelector.innerHTML = '';
    
    // Добавляем опции из загруженного списка
    availablePairs.forEach(pair => {
      const option = document.createElement('option');
      option.value = pair;
      option.textContent = pair;
      positionPairSelector.appendChild(option);
    });
    
    // Выбираем первую пару по умолчанию
    if (positionPairSelector.options.length > 0) {
      positionPairSelector.selectedIndex = 0;
    }
  }
}

/**
 * Загрузка активных позиций
 */
async function loadActivePositions() {
  try {
    const response = await fetch('/api/positions/active');
    const data = await response.json();
    
    if (data.positions && Array.isArray(data.positions)) {
      activePositions = data.positions;
      renderActivePositions();
    }
  } catch (error) {
    console.error('Ошибка при загрузке активных позиций:', error);
    throw error;
  }
}

/**
 * Рендеринг активных позиций
 */
function renderActivePositions() {
  const tableBody = document.getElementById('activePositionsBody');
  if (!tableBody) return;
  
  // Очищаем таблицу
  tableBody.innerHTML = '';
  
  // Если нет позиций, показываем сообщение
  if (activePositions.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="10" class="empty-data">Нет открытых позиций</td>';
    tableBody.appendChild(emptyRow);
    
    // Обновляем сводную информацию
    document.getElementById('totalActivePositions').textContent = '0';
    document.getElementById('totalPositionsValue').textContent = '0 USDT';
    document.getElementById('totalPnL').textContent = '0 USDT';
    
    return;
  }
  
  // Добавляем строки для каждой позиции
  let totalValue = 0;
  let totalPnL = 0;
  
  activePositions.forEach(position => {
    const row = document.createElement('tr');
    
    // Вычисляем PnL
    const direction = position.direction;
    const entryPrice = parseFloat(position.openPrice);
    const currentPrice = parseFloat(position.currentPrice);
    const amount = parseFloat(position.amount);
    
    let pnl;
    if (direction === 'LONG') {
      pnl = (currentPrice - entryPrice) * amount;
    } else {
      pnl = (entryPrice - currentPrice) * amount;
    }
    
    const pnlPercent = entryPrice > 0 ? (pnl / (entryPrice * amount)) * 100 : 0;
    
    // Вычисляем значение позиции
    const positionValue = entryPrice * amount;
    totalValue += positionValue;
    totalPnL += pnl;
    
    // Форматируем дату
    const openTime = new Date(position.openTime).toLocaleString();
    
    row.innerHTML = `
      <td>${position.symbol}</td>
      <td class="${direction === 'LONG' ? 'positive' : 'negative'}">${direction}</td>
      <td>${amount}</td>
      <td>${entryPrice.toFixed(8)}</td>
      <td>${currentPrice.toFixed(8)}</td>
      <td class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl.toFixed(2)} USDT</td>
      <td class="${pnl >= 0 ? 'positive' : 'negative'}">${pnlPercent.toFixed(2)}%</td>
      <td>${openTime}</td>
      <td>
        ${position.stopLoss ? 'SL: ' + position.stopLoss : ''}
        ${position.stopLoss && position.takeProfit ? '<br>' : ''}
        ${position.takeProfit ? 'TP: ' + position.takeProfit : ''}
      </td>
      <td>
        <button class="btn btn-sm btn-danger close-position" data-id="${position.id}">Закрыть</button>
        <button class="btn btn-sm btn-secondary edit-position" data-id="${position.id}">Изменить</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Обновляем сводную информацию
  document.getElementById('totalActivePositions').textContent = activePositions.length;
  document.getElementById('totalPositionsValue').textContent = `${totalValue.toFixed(2)} USDT`;
  
  const totalPnLElement = document.getElementById('totalPnL');
  totalPnLElement.textContent = `${totalPnL.toFixed(2)} USDT`;
  totalPnLElement.className = totalPnL >= 0 ? 'summary-value positive' : 'summary-value negative';
  
  // Добавляем обработчики для кнопок
  document.querySelectorAll('.close-position').forEach(button => {
    button.addEventListener('click', async (e) => {
      const positionId = e.target.getAttribute('data-id');
      await closePosition(positionId);
    });
  });
  
  document.querySelectorAll('.edit-position').forEach(button => {
    button.addEventListener('click', (e) => {
      const positionId = e.target.getAttribute('data-id');
      editPosition(positionId);
    });
  });
}

/**
 * Загрузка истории позиций
 */
async function loadHistoryPositions() {
  try {
    // Определяем период для фильтрации
    let startDate;
    const endDate = new Date();
    
    switch (selectedHistoryPeriod) {
      case 'day':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3months':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'all':
      default:
        startDate = new Date(0); // Начало времен
        break;
    }
    
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    
    const response = await fetch(`/api/positions/history?start=${startTimestamp}&end=${endTimestamp}`);
    const data = await response.json();
    
    if (data.positions && Array.isArray(data.positions)) {
      historyPositions = data.positions;
      renderHistoryPositions();
    }
  } catch (error) {
    console.error('Ошибка при загрузке истории позиций:', error);
    throw error;
  }
}

/**
 * Рендеринг истории позиций
 */
function renderHistoryPositions() {
  const tableBody = document.getElementById('historyPositionsBody');
  if (!tableBody) return;
  
  // Очищаем таблицу
  tableBody.innerHTML = '';
  
  // Фильтруем позиции по выбранной паре
  let filteredPositions = historyPositions;
  if (selectedHistoryPair !== 'all') {
    filteredPositions = historyPositions.filter(position => position.symbol === selectedHistoryPair);
  }
  
  // Если нет позиций, показываем сообщение
  if (filteredPositions.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="11" class="empty-data">Нет истории позиций</td>';
    tableBody.appendChild(emptyRow);
    
    // Обновляем сводную информацию
    document.getElementById('totalHistoryPositions').textContent = '0';
    document.getElementById('profitablePositions').textContent = '0 (0%)';
    document.getElementById('unprofitablePositions').textContent = '0 (0%)';
    document.getElementById('totalHistoryPnL').textContent = '0 USDT';
    
    // Обновляем пагинацию
    updatePagination(filteredPositions);
    
    return;
  }
  
  // Вычисляем общую статистику
  const totalPositions = filteredPositions.length;
  let profitableCount = 0;
  let totalPnL = 0;
  
  filteredPositions.forEach(position => {
    const pnl = parseFloat(position.profit);
    if (pnl >= 0) {
      profitableCount++;
    }
    totalPnL += pnl;
  });
  
  const unprofitableCount = totalPositions - profitableCount;
  const profitablePercent = totalPositions > 0 ? (profitableCount / totalPositions * 100).toFixed(2) : 0;
  const unprofitablePercent = totalPositions > 0 ? (unprofitableCount / totalPositions * 100).toFixed(2) : 0;
  
  // Обновляем сводную информацию
  document.getElementById('totalHistoryPositions').textContent = totalPositions;
  document.getElementById('profitablePositions').textContent = `${profitableCount} (${profitablePercent}%)`;
  document.getElementById('unprofitablePositions').textContent = `${unprofitableCount} (${unprofitablePercent}%)`;
  
  const totalHistoryPnLElement = document.getElementById('totalHistoryPnL');
  totalHistoryPnLElement.textContent = `${totalPnL.toFixed(2)} USDT`;
  totalHistoryPnLElement.className = totalPnL >= 0 ? 'summary-value positive' : 'summary-value negative';
  
  // Обновляем пагинацию
  updatePagination(filteredPositions);
  
  // Отображаем только текущую страницу
  const startIndex = (historyPage - 1) * historyItemsPerPage;
  const endIndex = Math.min(startIndex + historyItemsPerPage, filteredPositions.length);
  const pagePositions = filteredPositions.slice(startIndex, endIndex);
  
  // Добавляем строки для каждой позиции на текущей странице
  pagePositions.forEach(position => {
    const row = document.createElement('tr');
    
    // Вычисляем PnL и процент
    const pnl = parseFloat(position.profit);
    const entryPrice = parseFloat(position.openPrice);
    const exitPrice = parseFloat(position.closePrice);
    const amount = parseFloat(position.amount);
    const pnlPercent = entryPrice > 0 ? (pnl / (entryPrice * amount)) * 100 : 0;
    
    // Форматируем даты
    const openTime = new Date(position.openTime).toLocaleString();
    const closeTime = new Date(position.closeTime).toLocaleString();
    
    // Вычисляем длительность позиции
    const openTimeMs = new Date(position.openTime).getTime();
    const closeTimeMs = new Date(position.closeTime).getTime();
    const durationMs = closeTimeMs - openTimeMs;
    
    // Форматируем длительность
    let duration;
    if (durationMs < 60000) { // Меньше минуты
      duration = `${Math.floor(durationMs / 1000)} сек`;
    } else if (durationMs < 3600000) { // Меньше часа
      duration = `${Math.floor(durationMs / 60000)} мин`;
    } else if (durationMs < 86400000) { // Меньше дня
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.floor((durationMs % 3600000) / 60000);
      duration = `${hours} ч ${minutes} мин`;
    } else { // Дни и более
      const days = Math.floor(durationMs / 86400000);
      const hours = Math.floor((durationMs % 86400000) / 3600000);
      duration = `${days} д ${hours} ч`;
    }
    
    row.innerHTML = `
      <td>${position.symbol}</td>
      <td class="${position.direction === 'LONG' ? 'positive' : 'negative'}">${position.direction}</td>
      <td>${amount}</td>
      <td>${entryPrice.toFixed(8)}</td>
      <td>${exitPrice.toFixed(8)}</td>
      <td class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl.toFixed(2)} USDT</td>
      <td class="${pnl >= 0 ? 'positive' : 'negative'}">${pnlPercent.toFixed(2)}%</td>
      <td>${openTime}</td>
      <td>${closeTime}</td>
      <td>${duration}</td>
      <td>${position.source || 'MANUAL'}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

/**
 * Обновление пагинации для истории позиций
 */
function updatePagination(positions) {
  const totalPositions = positions.length;
  historyTotalPages = Math.max(1, Math.ceil(totalPositions / historyItemsPerPage));
  historyPage = Math.min(historyPage, historyTotalPages);
  
  document.getElementById('pageInfo').textContent = `Страница ${historyPage} из ${historyTotalPages}`;
  document.getElementById('prevPage').disabled = historyPage <= 1;
  document.getElementById('nextPage').disabled = historyPage >= historyTotalPages;
}

/**
 * Загрузка открытых ордеров
 */
async function loadOpenOrders() {
  try {
    const response = await fetch('/api/orders');
    const data = await response.json();
    
    if (data.orders && Array.isArray(data.orders)) {
      openOrders = data.orders;
      renderOpenOrders();
    }
  } catch (error) {
    console.error('Ошибка при загрузке открытых ордеров:', error);
    throw error;
  }
}

/**
 * Рендеринг открытых ордеров
 */
function renderOpenOrders() {
  const tableBody = document.getElementById('ordersBody');
  if (!tableBody) return;
  
  // Очищаем таблицу
  tableBody.innerHTML = '';
  
  // Если нет ордеров, показываем сообщение
  if (openOrders.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="9" class="empty-data">Нет открытых ордеров</td>';
    tableBody.appendChild(emptyRow);
    
    // Обновляем сводную информацию
    document.getElementById('totalOrders').textContent = '0';
    document.getElementById('limitOrders').textContent = '0';
    document.getElementById('stopOrders').textContent = '0';
    
    return;
  }
  
  // Вычисляем статистику ордеров
  let limitCount = 0;
  let stopCount = 0;
  
  openOrders.forEach(order => {
    if (order.type === 'LIMIT') {
      limitCount++;
    } else if (order.type.includes('STOP')) {
      stopCount++;
    }
  });
  
  // Обновляем сводную информацию
  document.getElementById('totalOrders').textContent = openOrders.length;
  document.getElementById('limitOrders').textContent = limitCount;
  document.getElementById('stopOrders').textContent = stopCount;
  
  // Добавляем строки для каждого ордера
  openOrders.forEach(order => {
    const row = document.createElement('tr');
    
    // Форматируем дату
    const createTime = new Date(order.createTime).toLocaleString();
    
    // Вычисляем общую сумму ордера
    const price = parseFloat(order.price);
    const quantity = parseFloat(order.quantity);
    const total = price * quantity;
    
    row.innerHTML = `
      <td>${order.symbol}</td>
      <td>${order.type}</td>
      <td class="${order.side === 'BUY' ? 'positive' : 'negative'}">${order.side}</td>
      <td>${price.toFixed(8)}</td>
      <td>${quantity}</td>
      <td>${total.toFixed(8)} USDT</td>
      <td>${createTime}</td>
      <td>${order.status}</td>
      <td>
        <button class="btn btn-sm btn-danger cancel-order" data-id="${order.id}">Отменить</button>
        <button class="btn btn-sm btn-secondary edit-order" data-id="${order.id}">Изменить</button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Добавляем обработчики для кнопок
  document.querySelectorAll('.cancel-order').forEach(button => {
    button.addEventListener('click', async (e) => {
      const orderId = e.target.getAttribute('data-id');
      await cancelOrder(orderId);
    });
  });
  
  document.querySelectorAll('.edit-order').forEach(button => {
    button.addEventListener('click', (e) => {
      const orderId = e.target.getAttribute('data-id');
      editOrder(orderId);
    });
  });
}

/**
 * Загрузка балансов аккаунта
 */
async function loadBalances() {
  try {
    const response = await fetch('/api/balances');
    const data = await response.json();
    
    if (data.balances) {
      balances = data.balances;
    }
  } catch (error) {
    console.error('Ошибка при загрузке балансов:', error);
    throw error;
  }
}

/**
 * Закрытие всех активных позиций
 */
async function closeAllPositions() {
  try {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('successMessage').classList.add('hidden');
    
    const response = await fetch('/api/positions/close-all', {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('successMessage').textContent = 'Все позиции успешно закрыты';
      document.getElementById('successMessage').classList.remove('hidden');
      
      // Обновляем данные
      await loadActivePositions();
    } else {
      throw new Error(data.message || 'Ошибка при закрытии позиций');
    }
  } catch (error) {
    console.error('Ошибка при закрытии всех позиций:', error);
    document.getElementById('errorMessage').textContent = 'Ошибка при закрытии позиций: ' + error.message;
    document.getElementById('errorMessage').classList.remove('hidden');
  } finally {
    document.getElementById('loadingIndicator').classList.add('hidden');
    
    // Скрываем сообщение об успехе через 3 секунды
    setTimeout(() => {
      document.getElementById('successMessage').classList.add('hidden');
    }, 3000);
  }
}

/**
 * Закрытие конкретной позиции
 */
async function closePosition(positionId) {
  try {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('successMessage').classList.add('hidden');
    
    const response = await fetch(`/api/positions/${positionId}/close`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('successMessage').textContent = 'Позиция успешно закрыта';
      document.getElementById('successMessage').classList.remove('hidden');
      
      // Обновляем данные
      await loadActivePositions();
      await loadHistoryPositions();
    } else {
      throw new Error(data.message || 'Ошибка при закрытии позиции');
    }
  } catch (error) {
    console.error('Ошибка при закрытии позиции:', error);
    document.getElementById('errorMessage').textContent = 'Ошибка при закрытии позиции: ' + error.message;
    document.getElementById('errorMessage').classList.remove('hidden');
  } finally {
    document.getElementById('loadingIndicator').classList.add('hidden');
    
    // Скрываем сообщение об успехе через 3 секунды
    setTimeout(() => {
      document.getElementById('successMessage').classList.add('hidden');
    }, 3000);
  }
}

/**
 * Редактирование позиции
 */
function editPosition(positionId) {
  // Находим позицию по ID
  const position = activePositions.find(p => p.id === positionId);
  if (!position) {
    console.error('Позиция не найдена:', positionId);
    return;
  }
  
  // Заполняем модальное окно данными позиции
  document.getElementById('positionPair').value = position.symbol;
  
  const directionInputs = document.querySelectorAll('input[name="positionDirection"]');
  directionInputs.forEach(input => {
    input.checked = input.value === position.direction;
  });
  
  document.getElementById('positionSize').value = position.amount;
  document.getElementById('positionPrice').value = position.openPrice;
  document.getElementById('positionStopLoss').value = position.stopLoss || '';
  document.getElementById('positionTakeProfit').value = position.takeProfit || '';
  
  // Вычисляем проценты для стопа и тейка
  if (position.stopLoss) {
    const stopLossPrice = parseFloat(position.stopLoss);
    const entryPrice = parseFloat(position.openPrice);
    let stopLossPercent;
    
    if (position.direction === 'LONG') {
      stopLossPercent = (1 - stopLossPrice / entryPrice) * 100;
    } else {
      stopLossPercent = (stopLossPrice / entryPrice - 1) * 100;
    }
    
    document.getElementById('positionStopLossPercent').value = Math.abs(stopLossPercent).toFixed(2);
  } else {
    document.getElementById('positionStopLossPercent').value = '';
  }
  
  if (position.takeProfit) {
    const takeProfitPrice = parseFloat(position.takeProfit);
    const entryPrice = parseFloat(position.openPrice);
    let takeProfitPercent;
    
    if (position.direction === 'LONG') {
      takeProfitPercent = (takeProfitPrice / entryPrice - 1) * 100;
    } else {
      takeProfitPercent = (1 - takeProfitPrice / entryPrice) * 100;
    }
    
    document.getElementById('positionTakeProfitPercent').value = Math.abs(takeProfitPercent).toFixed(2);
  } else {
    document.getElementById('positionTakeProfitPercent').value = '';
  }
  
  // Настраиваем трейлинг-стоп
  document.getElementById('positionUseTrailingStop').checked = position.useTrailingStop || false;
  document.getElementById('positionTrailingStopPercent').value = position.trailingStopPercent || 1.0;
  
  // Показываем/скрываем блок трейлинг-стопа
  const trailingStopBlock = document.getElementById('trailingStopBlock');
  trailingStopBlock.style.display = position.useTrailingStop ? 'flex' : 'none';
  
  // Устанавливаем тип исполнения
  const typeInputs = document.querySelectorAll('input[name="positionType"]');
  typeInputs.forEach(input => {
    input.checked = input.value === 'MARKET'; // Для изменения всегда используем рыночный ордер
    input.disabled = true; // Блокируем изменение типа
  });
  
  // Блокируем изменение пары и размера
  document.getElementById('positionPair').disabled = true;
  document.getElementById('positionSize').disabled = true;
  document.getElementById('positionPrice').disabled = true;
  
  // Меняем текст кнопки
  document.getElementById('createPosition').textContent = 'Обновить';
  document.getElementById('createPosition').setAttribute('data-id', positionId);
  document.getElementById('createPosition').setAttribute('data-action', 'update');
  
  // Меняем заголовок модального окна
  document.querySelector('.modal-header h3').textContent = 'Редактирование позиции';
  
  // Показываем модальное окно
  document.getElementById('newPositionModal').classList.remove('hidden');
}

/**
 * Отмена всех открытых ордеров
 */
async function cancelAllOrders() {
  try {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('successMessage').classList.add('hidden');
    
    const response = await fetch('/api/orders/cancel-all', {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('successMessage').textContent = 'Все ордера успешно отменены';
      document.getElementById('successMessage').classList.remove('hidden');
      
      // Обновляем данные
      await loadOpenOrders();
    } else {
      throw new Error(data.message || 'Ошибка при отмене ордеров');
    }
  } catch (error) {
    console.error('Ошибка при отмене всех ордеров:', error);
    document.getElementById('errorMessage').textContent = 'Ошибка при отмене ордеров: ' + error.message;
    document.getElementById('errorMessage').classList.remove('hidden');
  } finally {
    document.getElementById('loadingIndicator').classList.add('hidden');
    
    // Скрываем сообщение об успехе через 3 секунды
    setTimeout(() => {
      document.getElementById('successMessage').classList.add('hidden');
    }, 3000);
  }
}

/**
 * Отмена конкретного ордера
 */
async function cancelOrder(orderId) {
  try {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('successMessage').classList.add('hidden');
    
    const response = await fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('successMessage').textContent = 'Ордер успешно отменен';
      document.getElementById('successMessage').classList.remove('hidden');
      
      // Обновляем данные
      await loadOpenOrders();
    } else {
      throw new Error(data.message || 'Ошибка при отмене ордера');
    }
  } catch (error) {
    console.error('Ошибка при отмене ордера:', error);
    document.getElementById('errorMessage').textContent = 'Ошибка при отмене ордера: ' + error.message;
    document.getElementById('errorMessage').classList.remove('hidden');
  } finally {
    document.getElementById('loadingIndicator').classList.add('hidden');
    
    // Скрываем сообщение об успехе через 3 секунды
    setTimeout(() => {
      document.getElementById('successMessage').classList.add('hidden');
    }, 3000);
  }
}

/**
 * Редактирование ордера
 */
function editOrder(orderId) {
  // Находим ордер по ID
  const order = openOrders.find(o => o.id === orderId);
  if (!order) {
    console.error('Ордер не найден:', orderId);
    return;
  }
  
  // Заполняем модальное окно данными ордера
  document.getElementById('positionPair').value = order.symbol;
  
  const directionInputs = document.querySelectorAll('input[name="positionDirection"]');
  directionInputs.forEach(input => {
    input.checked = input.value === (order.side === 'BUY' ? 'LONG' : 'SHORT');
  });
  
  document.getElementById('positionSize').value = order.quantity;
  document.getElementById('positionPrice').value = order.price;
  
  // Устанавливаем тип ордера
  const typeInputs = document.querySelectorAll('input[name="positionType"]');
  typeInputs.forEach(input => {
    input.checked = input.value === order.type;
  });
  
  // Меняем текст кнопки
  document.getElementById('createPosition').textContent = 'Обновить';
  document.getElementById('createPosition').setAttribute('data-id', orderId);
  document.getElementById('createPosition').setAttribute('data-action', 'update-order');
  
  // Меняем заголовок модального окна
  document.querySelector('.modal-header h3').textContent = 'Редактирование ордера';
  
  // Показываем модальное окно
  document.getElementById('newPositionModal').classList.remove('hidden');
}

/**
 * Показать модальное окно для создания новой позиции
 */
function showNewPositionModal(isOrder = false) {
  // Сбрасываем форму
  document.getElementById('newPositionForm').reset();
  
  // Включаем все поля
  document.getElementById('positionPair').disabled = false;
  document.getElementById('positionSize').disabled = false;
  document.getElementById('positionPrice').disabled = false;
  
  const typeInputs = document.querySelectorAll('input[name="positionType"]');
  typeInputs.forEach(input => {
    input.disabled = false;
  });
  
  // Меняем текст кнопки
  document.getElementById('createPosition').textContent = 'Создать';
  document.getElementById('createPosition').removeAttribute('data-id');
  document.getElementById('createPosition').removeAttribute('data-action');
  
  // Меняем заголовок модального окна
  document.querySelector('.modal-header h3').textContent = isOrder ? 'Новый ордер' : 'Новая позиция';
  
  // Показываем модальное окно
  document.getElementById('newPositionModal').classList.remove('hidden');
}

/**
 * Скрыть модальное окно
 */
function hideNewPositionModal() {
  document.getElementById('newPositionModal').classList.add('hidden');
}

/**
 * Создание новой позиции или обновление существующей
 */
async function createNewPosition() {
  try {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    document.getElementById('errorMessage').classList.add('hidden');
    document.getElementById('successMessage').classList.add('hidden');
    
    const createButton = document.getElementById('createPosition');
    const action = createButton.getAttribute('data-action') || 'create';
    const id = createButton.getAttribute('data-id');
    
    // Собираем данные из формы
    const formData = {
      symbol: document.getElementById('positionPair').value,
      direction: document.querySelector('input[name="positionDirection"]:checked').value,
      amount: parseFloat(document.getElementById('positionSize').value),
      price: document.getElementById('positionPrice').value ? parseFloat(document.getElementById('positionPrice').value) : null,
      stopLoss: document.getElementById('positionStopLoss').value ? parseFloat(document.getElementById('positionStopLoss').value) : null,
      takeProfit: document.getElementById('positionTakeProfit').value ? parseFloat(document.getElementById('positionTakeProfit').value) : null,
      type: document.querySelector('input[name="positionType"]:checked').value,
      useTrailingStop: document.getElementById('positionUseTrailingStop').checked,
      trailingStopPercent: document.getElementById('positionUseTrailingStop').checked 
        ? parseFloat(document.getElementById('positionTrailingStopPercent').value) 
        : null
    };
    
    let url, method;
    
    if (action === 'update') {
      // Обновление существующей позиции
      url = `/api/positions/${id}`;
      method = 'PUT';
    } else if (action === 'update-order') {
      // Обновление существующего ордера
      url = `/api/orders/${id}`;
      method = 'PUT';
    } else {
      // Создание новой позиции или ордера
      url = formData.type === 'MARKET' ? '/api/positions' : '/api/orders';
      method = 'POST';
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });
    
    const data = await response.json();
    
    if (data.success) {
      document.getElementById('successMessage').textContent = action.includes('update') 
        ? 'Успешно обновлено' 
        : (formData.type === 'MARKET' ? 'Позиция успешно создана' : 'Ордер успешно создан');
      document.getElementById('successMessage').classList.remove('hidden');
      
      // Скрываем модальное окно
      hideNewPositionModal();
      
      // Обновляем данные
      await loadActivePositions();
      await loadOpenOrders();
    } else {
      throw new Error(data.message || 'Ошибка при выполнении операции');
    }
  } catch (error) {
    console.error('Ошибка при создании/обновлении позиции:', error);
    document.getElementById('errorMessage').textContent = 'Ошибка: ' + error.message;
    document.getElementById('errorMessage').classList.remove('hidden');
  } finally {
    document.getElementById('loadingIndicator').classList.add('hidden');
    
    // Скрываем сообщение об успехе через 3 секунды
    setTimeout(() => {
      document.getElementById('successMessage').classList.add('hidden');
    }, 3000);
  }
}

/**
 * Экспорт данных истории позиций
 */
function exportHistoryData() {
  // Фильтруем позиции по выбранной паре
  let filteredPositions = historyPositions;
  if (selectedHistoryPair !== 'all') {
    filteredPositions = historyPositions.filter(position => position.symbol === selectedHistoryPair);
  }
  
  if (filteredPositions.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }
  
  // Преобразуем данные в CSV
  const headers = [
    'ID', 'Пара', 'Направление', 'Размер', 'Цена входа', 'Цена выхода', 
    'PnL', 'PnL %', 'Время открытия', 'Время закрытия', 'Источник'
  ];
  
  let csvContent = headers.join(',') + '\n';
  
  filteredPositions.forEach(position => {
    const entryPrice = parseFloat(position.openPrice);
    const exitPrice = parseFloat(position.closePrice);
    const amount = parseFloat(position.amount);
    const pnl = parseFloat(position.profit);
    const pnlPercent = entryPrice > 0 ? (pnl / (entryPrice * amount)) * 100 : 0;
    
    const row = [
      position.id,
      position.symbol,
      position.direction,
      amount,
      entryPrice.toFixed(8),
      exitPrice.toFixed(8),
      pnl.toFixed(2),
      pnlPercent.toFixed(2),
      new Date(position.openTime).toISOString(),
      new Date(position.closeTime).toISOString(),
      position.source || 'MANUAL'
    ];
    
    csvContent += row.join(',') + '\n';
  });
  
  // Создаем blob и ссылку для скачивания
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `trading-history-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}