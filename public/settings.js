/**
 * Клиентский JavaScript для страницы настроек
 * Отвечает за управление, загрузку и сохранение настроек платформы
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация
  initUI();
  await loadSettings();
});

// Глобальная переменная для хранения настроек
let settings = {};

/**
 * Инициализация пользовательского интерфейса
 */
function initUI() {
  // Обработчики для вкладок
  const tabs = document.querySelectorAll('.settings-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const targetSection = tab.getAttribute('data-section');
      
      // Скрываем все секции и показываем выбранную
      document.querySelectorAll('.settings-section').forEach(section => {
        section.classList.add('hidden');
      });
      document.getElementById(targetSection).classList.remove('hidden');
    });
  });
  
  // Обработчик для кнопки сохранения
  document.getElementById('saveSettings').addEventListener('click', async () => {
    await saveSettings();
  });
  
  // Обработчики для проверки соединений
  document.getElementById('testBinanceConnection')?.addEventListener('click', async () => {
    await testConnection('binance');
  });
  
  document.getElementById('testBybitConnection')?.addEventListener('click', async () => {
    await testConnection('bybit');
  });
  
  document.getElementById('testAiConnection')?.addEventListener('click', async () => {
    await testConnection('ai');
  });
  
  document.getElementById('testTelegramNotification')?.addEventListener('click', async () => {
    await testConnection('telegram');
  });
  
  // Обработчики зависимых полей
  document.getElementById('aiProvider')?.addEventListener('change', (e) => {
    const isCustom = e.target.value === 'custom';
    const endpointField = document.getElementById('aiEndpoint');
    if (endpointField) {
      endpointField.disabled = !isCustom;
    }
  });
  
  // Обработчик для включения/отключения трейлинг стопа
  document.getElementById('enableTrailingStop')?.addEventListener('change', (e) => {
    const trailingStopPercentField = document.getElementById('trailingStopPercent');
    if (trailingStopPercentField) {
      trailingStopPercentField.disabled = !e.target.checked;
    }
  });
  
  // Обработчик для включения/отключения разгона депозита
  document.getElementById('enableCapitalBooster')?.addEventListener('change', (e) => {
    const boosterThresholdField = document.getElementById('boosterThreshold');
    const boosterMultiplierField = document.getElementById('boosterMultiplier');
    
    if (boosterThresholdField && boosterMultiplierField) {
      boosterThresholdField.disabled = !e.target.checked;
      boosterMultiplierField.disabled = !e.target.checked;
    }
  });
  
  // Обработчик для включения/отключения защиты от просадки
  document.getElementById('enableDrawdownProtection')?.addEventListener('change', (e) => {
    const maxDrawdownField = document.getElementById('maxDrawdown');
    const drawdownActionField = document.getElementById('drawdownAction');
    
    if (maxDrawdownField && drawdownActionField) {
      maxDrawdownField.disabled = !e.target.checked;
      drawdownActionField.disabled = !e.target.checked;
    }
  });
  
  // Обработчик для включения/отключения AI анализа
  document.getElementById('enableAiAnalysis')?.addEventListener('change', (e) => {
    const aiAnalysisIntervalField = document.getElementById('aiAnalysisInterval');
    const includeVolumeField = document.getElementById('includeVolumeInAnalysis');
    const includeIndicatorsField = document.getElementById('includeIndicatorsInAnalysis');
    const priorityIndicatorsField = document.getElementById('priorityIndicators');
    
    if (aiAnalysisIntervalField && includeVolumeField && includeIndicatorsField && priorityIndicatorsField) {
      aiAnalysisIntervalField.disabled = !e.target.checked;
      includeVolumeField.disabled = !e.target.checked;
      includeIndicatorsField.disabled = !e.target.checked;
      priorityIndicatorsField.disabled = !e.target.checked;
    }
  });
  
  // Обработчик для включения/отключения авто-экспорта
  document.getElementById('enableAutoExport')?.addEventListener('change', (e) => {
    const exportIntervalField = document.getElementById('exportInterval');
    const exportFormatField = document.getElementById('exportFormat');
    
    if (exportIntervalField && exportFormatField) {
      exportIntervalField.disabled = !e.target.checked;
      exportFormatField.disabled = !e.target.checked;
    }
  });
  
  // Обработчик для включения/отключения уведомлений Telegram
  document.getElementById('enableTelegramNotifications')?.addEventListener('change', (e) => {
    const telegramBotTokenField = document.getElementById('telegramBotToken');
    const telegramChatIdField = document.getElementById('telegramChatId');
    const testTelegramButton = document.getElementById('testTelegramNotification');
    
    if (telegramBotTokenField && telegramChatIdField && testTelegramButton) {
      telegramBotTokenField.disabled = !e.target.checked;
      telegramChatIdField.disabled = !e.target.checked;
      testTelegramButton.disabled = !e.target.checked;
    }
  });
  
  // Обработчик для включения/отключения уведомлений
  document.getElementById('enableNotifications')?.addEventListener('change', (e) => {
    const browserNotificationsField = document.getElementById('enableBrowserNotifications');
    const soundNotificationsField = document.getElementById('enableSoundNotifications');
    const notifyFields = [
      document.getElementById('notifyOnSignal'),
      document.getElementById('notifyOnOrderExecution'),
      document.getElementById('notifyOnPositionClose'),
      document.getElementById('notifyOnDrawdown')
    ];
    
    if (browserNotificationsField && soundNotificationsField) {
      browserNotificationsField.disabled = !e.target.checked;
      soundNotificationsField.disabled = !e.target.checked;
      
      notifyFields.forEach(field => {
        if (field) field.disabled = !e.target.checked;
      });
    }
  });
}

/**
 * Загрузка настроек с сервера
 */
async function loadSettings() {
  try {
    // Показываем индикатор загрузки
    document.getElementById('loadingIndicator').classList.remove('hidden');
    
    // Запрашиваем настройки с сервера
    const response = await fetch('/api/settings');
    settings = await response.json();
    
    // Заполняем значения полей из полученных настроек
    populateFieldsFromSettings(settings);
    
    // Скрываем индикатор загрузки
    document.getElementById('loadingIndicator').classList.add('hidden');
  } catch (error) {
    console.error('Ошибка при загрузке настроек:', error);
    document.getElementById('errorMessage').textContent = 'Ошибка загрузки настроек';
    document.getElementById('errorMessage').classList.remove('hidden');
    document.getElementById('loadingIndicator').classList.add('hidden');
  }
}

/**
 * Заполнение полей формы значениями из настроек
 * @param {Object} settings - Объект с настройками
 */
function populateFieldsFromSettings(settings) {
  // Заполняем различные поля настроек
  
  // Общие настройки
  setFieldValue('theme', settings.general?.theme || 'light');
  setFieldValue('language', settings.general?.language || 'ru');
  setFieldValue('compactMode', settings.general?.compactMode || false);
  setFieldValue('timezone', settings.general?.timezone || 'UTC');
  setFieldValue('loggingLevel', settings.general?.loggingLevel || 'info');
  setFieldValue('enableAutoUpdates', settings.general?.enableAutoUpdates !== false);
  setFieldValue('updateInterval', settings.general?.updateInterval || 30);
  
  // Настройки подключений
  setFieldValue('binanceApiKey', settings.connections?.binance?.apiKey || '');
  setFieldValue('binanceSecretKey', settings.connections?.binance?.secretKey || '');
  setFieldValue('binanceTestnet', settings.connections?.binance?.testnet || false);
  
  setFieldValue('bybitApiKey', settings.connections?.bybit?.apiKey || '');
  setFieldValue('bybitSecretKey', settings.connections?.bybit?.secretKey || '');
  setFieldValue('bybitTestnet', settings.connections?.bybit?.testnet || false);
  
  setFieldValue('aiProvider', settings.connections?.ai?.provider || 'openai');
  setFieldValue('aiApiKey', settings.connections?.ai?.apiKey || '');
  setFieldValue('aiEndpoint', settings.connections?.ai?.endpoint || '');
  setFieldValue('aiModel', settings.connections?.ai?.model || 'gpt-4');
  
  // Настройки торговли
  setFieldValue('enableAutoTrading', settings.trading?.enableAutoTrading || false);
  setFieldValue('defaultExchange', settings.trading?.defaultExchange || 'binance');
  setFieldValue('requireConfirmation', settings.trading?.requireConfirmation !== false);
  setFieldValue('favoritePairs', settings.trading?.favoritePairs?.join(', ') || '');
  setFieldValue('onlyTradeFavorites', settings.trading?.onlyTradeFavorites || false);
  setFieldValue('defaultTimeframe', settings.trading?.defaultTimeframe || '1h');
  setFieldValue('orderType', settings.trading?.orderType || 'MARKET');
  setFieldValue('defaultLeverage', settings.trading?.defaultLeverage || 1);
  setFieldValue('enableTrailingStop', settings.trading?.enableTrailingStop || false);
  setFieldValue('trailingStopPercent', settings.trading?.trailingStopPercent || 1.0);
  
  // Настройки риск-менеджмента
  setFieldValue('riskPerTrade', settings.risk?.riskPerTrade || 1.0);
  setFieldValue('maxPositionSize', settings.risk?.maxPositionSize || 10);
  setFieldValue('maxSimultaneousTrades', settings.risk?.maxSimultaneousTrades || 3);
  setFieldValue('defaultStopLoss', settings.risk?.defaultStopLoss || 2.0);
  setFieldValue('defaultTakeProfit', settings.risk?.defaultTakeProfit || 4.0);
  setFieldValue('riskRewardRatio', settings.risk?.riskRewardRatio || 2.0);
  setFieldValue('enableCapitalBooster', settings.risk?.enableCapitalBooster || false);
  setFieldValue('boosterThreshold', settings.risk?.boosterThreshold || 20);
  setFieldValue('boosterMultiplier', settings.risk?.boosterMultiplier || 1.5);
  setFieldValue('enableDrawdownProtection', settings.risk?.enableDrawdownProtection !== false);
  setFieldValue('maxDrawdown', settings.risk?.maxDrawdown || 15);
  setFieldValue('drawdownAction', settings.risk?.drawdownAction || 'reduce');
  
  // Настройки аналитики
  setFieldValue('analyticsUpdateInterval', settings.analytics?.updateInterval || 60);
  setFieldValue('enableBackgroundAnalytics', settings.analytics?.enableBackgroundAnalytics !== false);
  setFieldValue('enableAiAnalysis', settings.analytics?.enableAiAnalysis !== false);
  setFieldValue('aiAnalysisInterval', settings.analytics?.aiAnalysisInterval || 5);
  setFieldValue('includeVolumeInAnalysis', settings.analytics?.includeVolumeInAnalysis !== false);
  setFieldValue('includeIndicatorsInAnalysis', settings.analytics?.includeIndicatorsInAnalysis !== false);
  
  // Приоритетные индикаторы
  const priorityIndicatorsField = document.getElementById('priorityIndicators');
  if (priorityIndicatorsField && settings.analytics?.priorityIndicators) {
    Array.from(priorityIndicatorsField.options).forEach(option => {
      option.selected = settings.analytics.priorityIndicators.includes(option.value);
    });
  }
  
  setFieldValue('enableAutoExport', settings.analytics?.enableAutoExport || false);
  setFieldValue('exportInterval', settings.analytics?.exportInterval || 24);
  setFieldValue('exportFormat', settings.analytics?.exportFormat || 'json');
  
  // Настройки уведомлений
  setFieldValue('enableNotifications', settings.notifications?.enableNotifications !== false);
  setFieldValue('enableBrowserNotifications', settings.notifications?.enableBrowserNotifications !== false);
  setFieldValue('enableSoundNotifications', settings.notifications?.enableSoundNotifications !== false);
  setFieldValue('notifyOnSignal', settings.notifications?.notifyOnSignal !== false);
  setFieldValue('notifyOnOrderExecution', settings.notifications?.notifyOnOrderExecution !== false);
  setFieldValue('notifyOnPositionClose', settings.notifications?.notifyOnPositionClose !== false);
  setFieldValue('notifyOnDrawdown', settings.notifications?.notifyOnDrawdown !== false);
  setFieldValue('enableTelegramNotifications', settings.notifications?.enableTelegramNotifications || false);
  setFieldValue('telegramBotToken', settings.notifications?.telegramBotToken || '');
  setFieldValue('telegramChatId', settings.notifications?.telegramChatId || '');
  
  // Вызываем обработчики изменений для зависимых полей
  triggerChangeHandlers();
}

/**
 * Устанавливает значение для поля формы
 * @param {string} fieldId - ID поля
 * @param {*} value - Значение для установки
 */
function setFieldValue(fieldId, value) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  
  if (field.type === 'checkbox') {
    field.checked = Boolean(value);
  } else if (field.type === 'select-multiple') {
    // Multiple select обрабатывается отдельно
  } else {
    field.value = value;
  }
}

/**
 * Вызывает обработчики изменений для полей с зависимостями
 */
function triggerChangeHandlers() {
  // Список полей, для которых нужно вызвать событие change
  const fieldsToTrigger = [
    'aiProvider',
    'enableTrailingStop',
    'enableCapitalBooster',
    'enableDrawdownProtection',
    'enableAiAnalysis',
    'enableAutoExport',
    'enableTelegramNotifications',
    'enableNotifications'
  ];
  
  fieldsToTrigger.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      const event = new Event('change');
      field.dispatchEvent(event);
    }
  });
}