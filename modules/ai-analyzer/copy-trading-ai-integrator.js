// modules/ai-analyzer/copy-trading-ai-integrator.js

/**
 * Класс для интеграции копитрейдинга с AI-анализом
 * Позволяет улучшать сигналы копитрейдинга с помощью AI-анализа
 */
class CopyTradingAIIntegrator {
  /**
   * Создает экземпляр интегратора
   * @param {Object} config - Конфигурация
   */
  constructor(config = {}) {
    this.config = {
      // Минимальная уверенность для подтверждения сигнала
      minConfidence: 0.7,
      // Таймфреймы для мультитаймфрейм-анализа
      timeframes: ['15m', '1h', '4h'],
      // Максимальная разница между текущей ценой и ценой входа для актуальности сигнала (%)
      maxEntryPriceDiff: 1.5,
      // Интервал обновления мониторинга (в мс)
      monitorInterval: 300000, // 5 минут
      // Требовать подтверждение сигнала AI-анализом
      requireConfirmation: true,
      // Включить автоматическое распознавание уровней TP/SL
      enableAutoLevels: true,
      // Включить автоматическую торговлю по подтвержденным сигналам
      enableAutoTrading: false,
      ...config
    };
    
    this.core = null;
    this.aiAnalyzer = null;
    this.copyTradingManager = null;
    this.autoTrader = null;
    this.initialized = false;
    
    // Активные задачи интеграции
    this.activeIntegrations = new Map();
    
    // Обработчики событий
    this.eventHandlers = {};
  }

  /**
   * Инициализация интегратора
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize(core) {
    this.log('Инициализация интегратора копитрейдинга с AI...');
    this.core = core;
    
    // Получаем необходимые модули
    this.aiAnalyzer = core.getModule('ai-analyzer');
    this.copyTradingManager = core.getModule('copy-trading-manager');
    this.autoTrader = core.getModule('auto-trader');
    
    // Проверяем наличие необходимых модулей
    if (!this.aiAnalyzer) {
      throw new Error('Модуль ai-analyzer не найден');
    }
    
    if (!this.copyTradingManager) {
      throw new Error('Модуль copy-trading-manager не найден');
    }
    
    // Регистрируем обработчики событий
    this._registerEventHandlers();
    
    this.initialized = true;
    this.log('Интегратор копитрейдинга с AI успешно инициализирован');
    
    return true;
  }

  /**
   * Регистрирует обработчики событий
   * @private
   */
  _registerEventHandlers() {
    // Слушаем события новых сигналов копитрейдинга
    this._addEventHandler('copy-trading.new-signal', this._handleNewCopyTradingSignal.bind(this));
    
    // Слушаем события подтверждения сигналов AI-анализом
    this._addEventHandler('ai-analysis.signal-confirmed', this._handleAIConfirmation.bind(this));
  }

  /**
   * Добавляет обработчик события
   * @param {string} eventType - Тип события 
   * @param {Function} handler - Обработчик
   * @private
   */
  _addEventHandler(eventType, handler) {
    if (!this.core) return;
    
    // Сохраняем обработчик для возможности отписки
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    
    this.eventHandlers[eventType].push(handler);
    
    // Подписываемся на событие
    this.core.on(eventType, handler);
  }

  /**
   * Обработчик новых сигналов копитрейдинга
   * @param {Object} data - Данные события
   * @private
   */
  async _handleNewCopyTradingSignal(data) {
    const { signal, exchange, monitorId } = data;
    
    this.log(`Получен новый сигнал копитрейдинга: ${signal.pair} ${signal.direction} от ${signal.traderName || signal.traderId}`);
    
    // Проверяем, нужно ли дополнить сигнал уровнями TP/SL
    if (this.config.enableAutoLevels && (!signal.stopLoss || !signal.takeProfit)) {
      try {
        await this.enhanceSignalWithLevels(signal);
      } catch (error) {
        this.logError(`Ошибка при дополнении сигнала уровнями: ${error.message}`, error);
      }
    }
    
    // Если требуется подтверждение AI, запускаем анализ
    if (this.config.requireConfirmation) {
      try {
        const confirmationResult = await this.confirmSignalWithAI(signal);
        
        // Если сигнал подтвержден и включена автоторговля, выполняем сигнал
        if (confirmationResult.confirmed && this.config.enableAutoTrading && this.autoTrader) {
          this.executeSignal(confirmationResult.enhancedSignal);
        }
      } catch (error) {
        this.logError(`Ошибка при подтверждении сигнала AI: ${error.message}`, error);
      }
    } else if (this.config.enableAutoTrading && this.autoTrader) {
      // Если подтверждение не требуется, но автоторговля включена
      this.executeSignal(signal);
    }
  }

  /**
   * Обработчик подтверждения сигнала AI-анализом
   * @param {Object} data - Данные события
   * @private
   */
  async _handleAIConfirmation(data) {
    const { signal, confirmationResult } = data;
    
    this.log(`Получено подтверждение AI для сигнала: ${signal.pair} ${signal.direction}`);
    
    // Если включена автоторговля, выполняем сигнал
    if (this.config.enableAutoTrading && this.autoTrader) {
      this.executeSignal(signal);
    }
  }

  /**
   * Дополняет сигнал уровнями TP/SL
   * @param {Object} signal - Сигнал копитрейдинга
   * @returns {Promise<Object>} - Дополненный сигнал
   */
  async enhanceSignalWithLevels(signal) {
    if (!this.initialized || !this.aiAnalyzer) {
      throw new Error('Интегратор не инициализирован');
    }
    
    this.log(`Дополнение сигнала ${signal.pair} ${signal.direction} уровнями TP/SL`);
    
    // Создаем копию сигнала, чтобы не изменять оригинал
    const enhancedSignal = { ...signal };
    
    try {
      // Проверяем наличие метода getSignalLevels в AI-анализаторе
      if (typeof this.aiAnalyzer.getSignalLevels === 'function') {
        // Используем специализированный метод AI-анализатора для определения уровней
        const levels = await this.aiAnalyzer.getSignalLevels(
          signal.pair, 
          signal.direction,
          signal.entryPoint
        );
        
        if (levels && levels.stopLoss && levels.takeProfit) {
          enhancedSignal.stopLoss = levels.stopLoss;
          enhancedSignal.takeProfit = levels.takeProfit;
          enhancedSignal.levelsSource = 'ai-analyzer';
          this.log(`AI определил уровни для ${signal.pair}: SL=${levels.stopLoss}, TP=${levels.takeProfit}`);
        } else {
          // Если AI не смог определить уровни, используем технический анализ
          const levels = this._calculateLevelsByTA(signal);
          enhancedSignal.stopLoss = levels.stopLoss;
          enhancedSignal.takeProfit = levels.takeProfit;
          enhancedSignal.levelsSource = 'technical-analysis';
          this.log(`Рассчитаны технические уровни для ${signal.pair}: SL=${levels.stopLoss}, TP=${levels.takeProfit}`);
        }
      } else {
        // Если метод отсутствует, используем общий метод анализа с промптом для определения уровней
        const additionalText = `Analyze this ${signal.pair} chart and recommend optimal Stop Loss and Take Profit levels for a ${signal.direction} position with entry at ${signal.entryPoint}.`;
        
        // Создаем скриншот графика
        const chartUrl = `http://localhost:${this.core.config.port || 3000}/chart?pair=${signal.pair}`;
        const screenshotInfo = await this.aiAnalyzer.createChartScreenshot(chartUrl);
        
        // Анализируем график с помощью AI
        const analysisResult = await this.aiAnalyzer.analyzeChart(screenshotInfo.path, additionalText);
        
        // Извлекаем значения TP и SL из результата анализа
        const levels = this._extractLevelsFromAnalysis(analysisResult, signal);
        
        if (levels.stopLoss && levels.takeProfit) {
          enhancedSignal.stopLoss = levels.stopLoss;
          enhancedSignal.takeProfit = levels.takeProfit;
          enhancedSignal.levelsSource = 'ai-analysis';
          this.log(`AI определил уровни из анализа для ${signal.pair}: SL=${levels.stopLoss}, TP=${levels.takeProfit}`);
        } else {
          // Если не удалось извлечь уровни из анализа, используем технический анализ
          const taLevels = this._calculateLevelsByTA(signal);
          enhancedSignal.stopLoss = taLevels.stopLoss;
          enhancedSignal.takeProfit = taLevels.takeProfit;
          enhancedSignal.levelsSource = 'technical-analysis';
          this.log(`Рассчитаны технические уровни для ${signal.pair}: SL=${taLevels.stopLoss}, TP=${taLevels.takeProfit}`);
        }
      }
      
      return enhancedSignal;
    } catch (error) {
      this.logError(`Ошибка при дополнении сигнала уровнями: ${error.message}`, error);
      
      // В случае ошибки, используем технический анализ
      const levels = this._calculateLevelsByTA(signal);
      enhancedSignal.stopLoss = levels.stopLoss;
      enhancedSignal.takeProfit = levels.takeProfit;
      enhancedSignal.levelsSource = 'technical-analysis-fallback';
      
      return enhancedSignal;
    }
  }

  /**
   * Извлекает уровни TP/SL из результата анализа AI
   * @param {Object} analysisResult - Результат анализа AI
   * @param {Object} signal - Исходный сигнал
   * @returns {Object} - Извлеченные уровни
   * @private
   */
  _extractLevelsFromAnalysis(analysisResult, signal) {
    // Попробуем найти JSON с уровнями
    let stopLoss = null;
    let takeProfit = null;
    
    try {
      const jsonMatch = analysisResult.match(/```json\s*([\s\S]*?)\s*```/) || 
                      analysisResult.match(/\{[\s\S]*"stopLoss"[\s\S]*"takeProfit"[\s\S]*\}/);
      
      if (jsonMatch) {
        const levelsJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        stopLoss = parseFloat(levelsJson.stopLoss);
        takeProfit = parseFloat(levelsJson.takeProfit);
      } else {
        // Если не удалось извлечь JSON, ищем числовые значения
        const stopLossMatch = analysisResult.match(/stop\s*loss[^\d]+([\d.]+)/i);
        const takeProfitMatch = analysisResult.match(/take\s*profit[^\d]+([\d.]+)/i);
        
        if (stopLossMatch) stopLoss = parseFloat(stopLossMatch[1]);
        if (takeProfitMatch) takeProfit = parseFloat(takeProfitMatch[1]);
      }
      
      // Проверяем, что значения имеют смысл
      if (stopLoss && takeProfit) {
        // Проверка для позиции BUY
        if (signal.direction === 'BUY' && (stopLoss >= signal.entryPoint || takeProfit <= signal.entryPoint)) {
          // SL должен быть ниже входа, TP - выше входа
          return this._calculateLevelsByTA(signal);
        }
        // Проверка для позиции SELL
        if (signal.direction === 'SELL' && (stopLoss <= signal.entryPoint || takeProfit >= signal.entryPoint)) {
          // SL должен быть выше входа, TP - ниже входа
          return this._calculateLevelsByTA(signal);
        }
      } else {
        return this._calculateLevelsByTA(signal);
      }
      
      return { stopLoss, takeProfit };
    } catch (error) {
      this.logError(`Ошибка при извлечении уровней из анализа: ${error.message}`, error);
      return this._calculateLevelsByTA(signal);
    }
  }

  /**
   * Рассчитывает уровни TP/SL на основе технического анализа
   * @param {Object} signal - Сигнал копитрейдинга
   * @returns {Object} - Рассчитанные уровни
   * @private
   */
  _calculateLevelsByTA(signal) {
    const entryPrice = parseFloat(signal.entryPoint);
    const leverage = parseInt(signal.leverage || 1, 10);
    
    // Базовый расчет с учетом риск-менеджмента
    // Стандартное соотношение риск/прибыль 1:2
    // При высоком леверидже - меньшие отступы
    const riskPercent = 1.0 / leverage; 
    const rewardPercent = riskPercent * 2;
    
    let stopLoss, takeProfit;
    
    if (signal.direction === 'BUY') {
      // Для позиций LONG
      stopLoss = entryPrice * (1 - riskPercent / 100);
      takeProfit = entryPrice * (1 + rewardPercent / 100);
    } else {
      // Для позиций SHORT
      stopLoss = entryPrice * (1 + riskPercent / 100);
      takeProfit = entryPrice * (1 - rewardPercent / 100);
    }
    
    // Округляем до 6 знаков после запятой
    return {
      stopLoss: parseFloat(stopLoss.toFixed(6)),
      takeProfit: parseFloat(takeProfit.toFixed(6))
    };
  }

  /**
   * Подтверждает сигнал с помощью AI-анализа
   * @param {Object} signal - Сигнал копитрейдинга
   * @returns {Promise<Object>} - Результат подтверждения
   */
  async confirmSignalWithAI(signal) {
    if (!this.initialized || !this.aiAnalyzer) {
      throw new Error('Интегратор не инициализирован');
    }
    
    this.log(`Подтверждение сигнала ${signal.pair} ${signal.direction} с помощью AI`);
    
    // Гарантируем, что у сигнала есть уровни TP/SL
    let enhancedSignal = signal;
    if (!signal.stopLoss || !signal.takeProfit) {
      enhancedSignal = await this.enhanceSignalWithLevels(signal);
    }
    
    try {
      // Проверяем наличие метода для мультитаймфрейм-анализа
      if (typeof this.aiAnalyzer.analyzeMultiTimeframe === 'function') {
        // Используем мультитаймфрейм-анализ для подтверждения сигнала
        const confirmation = await this.aiAnalyzer.analyzeMultiTimeframe(
          signal.pair,
          'follow_trend', // Стратегия для следования тренду
          this.config.timeframes
        );
        
        // Проверяем результат подтверждения
        const confirmed = confirmation.confirmed && 
                        confirmation.signal.direction === signal.direction &&
                        confirmation.signal.confidence >= this.config.minConfidence;
        
        // Если сигнал подтвержден, обогащаем его информацией из AI-анализа
        if (confirmed) {
          enhancedSignal.confidence = confirmation.signal.confidence;
          enhancedSignal.analysis = enhancedSignal.analysis || confirmation.signal.analysis;
          enhancedSignal.aiConfirmed = true;
          
          // Публикуем событие подтверждения сигнала
          this.core.emit('ai-analysis.signal-confirmed', {
            signal: enhancedSignal,
            confirmationResult: confirmation
          });
        }
        
        return {
          confirmed,
          enhancedSignal,
          confirmationDetails: confirmation
        };
      } else {
        // Используем стандартный анализ
        // Получаем сигнал с помощью AI-анализатора
        const result = await this.aiAnalyzer.getSignalForCurrentChart({
          pair: signal.pair,
          strategy: 'Smart Money Concepts'
        });
        
        // Проверяем, совпадает ли направление сигнала AI с сигналом копитрейдинга
        const confirmed = result.signal.direction === signal.direction &&
                        result.signal.confidence >= this.config.minConfidence;
        
        // Если сигнал подтвержден, обогащаем его информацией из AI-анализа
        if (confirmed) {
          enhancedSignal.confidence = result.signal.confidence;
          enhancedSignal.analysis = enhancedSignal.analysis || result.signal.analysis;
          enhancedSignal.aiConfirmed = true;
          
          // Публикуем событие подтверждения сигнала
          this.core.emit('ai-analysis.signal-confirmed', {
            signal: enhancedSignal,
            confirmationResult: result
          });
        }
        
        return {
          confirmed,
          enhancedSignal,
          confirmationDetails: result
        };
      }
    } catch (error) {
      this.logError(`Ошибка при подтверждении сигнала AI: ${error.message}`, error);
      
      return {
        confirmed: false,
        enhancedSignal,
        error: error.message
      };
    }
  }

  /**
   * Выполняет сигнал через модуль автоторговли
   * @param {Object} signal - Сигнал для выполнения
   * @returns {Promise<Object>} - Результат выполнения
   */
  async executeSignal(signal) {
    if (!this.autoTrader) {
      throw new Error('Модуль auto-trader не найден');
    }
    
    this.log(`Выполнение сигнала ${signal.pair} ${signal.direction}`);
    
    try {
      // Вызываем метод обработки сигнала у модуля автоторговли
      const result = await this.autoTrader.handleNewSignal(signal);
      
      if (!result.success) {
        throw new Error(result.error || 'Неизвестная ошибка при выполнении сигнала');
      }
      
      this.log(`Сигнал успешно выполнен: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logError(`Ошибка при выполнении сигнала: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Запускает интеграцию для конкретной биржи и трейдера (или всех топ-трейдеров)
   * @param {string} exchange - Имя биржи
   * @param {string|null} traderId - ID трейдера (если null, то все топ-трейдеры)
   * @param {Object} options - Дополнительные опции
   * @returns {Promise<string>} - ID интеграции
   */
  async startIntegration(exchange, traderId = null, options = {}) {
    if (!this.initialized) {
      throw new Error('Интегратор не инициализирован');
    }
    
    if (!this.copyTradingManager) {
      throw new Error('Менеджер копитрейдинга не найден');
    }
    
    this.log(`Запуск интеграции копитрейдинга для ${exchange}${traderId ? ' (трейдер: ' + traderId + ')' : ''}`);
    
    // Генерируем уникальный ID для интеграции
    const integrationId = `integration_${exchange}_${traderId || 'all'}_${Date.now()}`;
    
    // Функция обработки новых сигналов
    const onNewSignals = async (signals, signalExchange, monitorId) => {
      this.log(`Получено ${signals.length} новых сигналов от копитрейдинга на ${signalExchange}`);
      
      // Обрабатываем каждый сигнал
      for (const signal of signals) {
        try {
          // Дополняем сигнал уровнями TP/SL, если они отсутствуют
          let enhancedSignal = signal;
          if (this.config.enableAutoLevels && (!signal.stopLoss || !signal.takeProfit)) {
            enhancedSignal = await this.enhanceSignalWithLevels(signal);
          }
          
          // Если требуется подтверждение AI, запускаем анализ
          if (this.config.requireConfirmation) {
            const confirmationResult = await this.confirmSignalWithAI(enhancedSignal);
            
            // Если сигнал подтвержден и включена автоторговля, выполняем его
            if (confirmationResult.confirmed && options.autoTrade && this.autoTrader) {
              await this.executeSignal(confirmationResult.enhancedSignal);
            }
          } else if (options.autoTrade && this.autoTrader) {
            // Если подтверждение не требуется, но автоторговля включена
            await this.executeSignal(enhancedSignal);
          }
        } catch (error) {
          this.logError(`Ошибка при обработке сигнала ${signal.pair} ${signal.direction}: ${error.message}`, error);
        }
      }
    };
    
    // Запускаем мониторинг копитрейдинга с нашим обработчиком сигналов
    const monitorId = this.copyTradingManager.startMonitoring(exchange, traderId, {
      interval: options.interval || this.config.monitorInterval,
      onNewSignals,
      tradersLimit: options.tradersLimit || 10,
      minWinRate: options.minWinRate || 0.5,
      ...options
    });
    
    // Сохраняем информацию об интеграции
    this.activeIntegrations.set(integrationId, {
      id: integrationId,
      exchange,
      traderId,
      monitorId,
      options: {
        autoTrade: !!options.autoTrade,
        requireConfirmation: this.config.requireConfirmation,
        ...options
      },
      startTime: Date.now(),
      status: 'active'
    });
    
    this.log(`Интеграция копитрейдинга ${integrationId} успешно запущена`);
    
    // Публикуем событие запуска интеграции
    this.core.emit('copy-trading-ai.integration-started', {
      integrationId,
      exchange,
      traderId,
      monitorId
    });
    
    return integrationId;
  }

  /**
   * Останавливает интеграцию
   * @param {string} integrationId - ID интеграции
   * @returns {boolean} - Успешность операции
   */
  stopIntegration(integrationId) {
    if (!this.activeIntegrations.has(integrationId)) {
      return false;
    }
    
    const integration = this.activeIntegrations.get(integrationId);
    
    // Останавливаем мониторинг копитрейдинга
    if (this.copyTradingManager) {
      this.copyTradingManager.stopMonitoring(integration.monitorId);
    }
    
    // Обновляем статус интеграции
    integration.status = 'stopped';
    integration.stopTime = Date.now();
    
    this.log(`Интеграция копитрейдинга ${integrationId} остановлена`);
    
    // Публикуем событие остановки интеграции
    this.core.emit('copy-trading-ai.integration-stopped', {
      integrationId,
      exchange: integration.exchange,
      traderId: integration.traderId,
      runtime: integration.stopTime - integration.startTime
    });
    
    // Удаляем интеграцию из активных
    this.activeIntegrations.delete(integrationId);
    
    return true;
  }

  /**
   * Получение списка активных интеграций
   * @returns {Array} - Список активных интеграций
   */
  getActiveIntegrations() {
    return Array.from(this.activeIntegrations.entries()).map(([id, integration]) => ({
      id,
      exchange: integration.exchange,
      traderId: integration.traderId,
      monitorId: integration.monitorId,
      startTime: integration.startTime,
      runtime: Date.now() - integration.startTime,
      options: integration.options,
      status: integration.status
    }));
  }

  /**
   * Очистка ресурсов
   */
  async cleanup() {
    this.log('Очистка ресурсов интегратора копитрейдинга с AI...');
    
    // Отписываемся от всех событий
    this._cleanupEventHandlers();
    
    // Останавливаем все активные интеграции
    for (const [integrationId] of this.activeIntegrations) {
      this.stopIntegration(integrationId);
    }
    
    this.initialized = false;
    this.log('Интегратор копитрейдинга с AI успешно выгружен');
  }

  /**
   * Очищает обработчики событий
   * @private
   */
  _cleanupEventHandlers() {
    if (!this.core) return;
    
    // Отписываемся от всех событий
    Object.entries(this.eventHandlers).forEach(([eventType, handlers]) => {
      handlers.forEach(handler => {
        this.core.off(eventType, handler);
      });
    });
    
    // Очищаем список обработчиков
    this.eventHandlers = {};
  }

  /**
   * Регистрация API эндпоинтов
   * @param {Object} app - Экземпляр Express приложения
   */
  registerApiEndpoints(app) {
    if (!app) return;
    
    // Эндпоинт для дополнения сигнала уровнями TP/SL
    app.post('/api/copy-trading-ai/enhance-signal', async (req, res) => {
      try {
        const { signal } = req.body;
        
        if (!signal || !signal.pair || !signal.direction || !signal.entryPoint) {
          return res.status(400).json({
            success: false,
            error: 'Необходимо указать корректный сигнал с pair, direction и entryPoint'
          });
        }
        
        const enhancedSignal = await this.enhanceSignalWithLevels(signal);
        
        res.json({
          success: true,
          enhancedSignal
        });
      } catch (error) {
        this.logError(`Ошибка при дополнении сигнала: ${error.message}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для подтверждения сигнала с помощью AI
    app.post('/api/copy-trading-ai/confirm-signal', async (req, res) => {
      try {
        const { signal } = req.body;
        
        if (!signal || !signal.pair || !signal.direction || !signal.entryPoint) {
          return res.status(400).json({
            success: false,
            error: 'Необходимо указать корректный сигнал с pair, direction и entryPoint'
          });
        }
        
        const result = await this.confirmSignalWithAI(signal);
        
        res.json({
          success: true,
          ...result
        });
      } catch (error) {
        this.logError(`Ошибка при подтверждении сигнала: ${error.message}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для запуска интеграции
    app.post('/api/copy-trading-ai/start-integration', async (req, res) => {
      try {
        const { exchange, traderId, options } = req.body;
        
        if (!exchange) {
          return res.status(400).json({
            success: false,
            error: 'Необходимо указать биржу'
          });
        }
        
        const integrationId = await this.startIntegration(exchange, traderId, options || {});
        
        res.json({
          success: true,
          integrationId,
          exchange,
          traderId: traderId || 'all'
        });
      } catch (error) {
        this.logError(`Ошибка при запуске интеграции: ${error.message}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для остановки интеграции
    app.post('/api/copy-trading-ai/stop-integration/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        const result = this.stopIntegration(id);
        
        if (!result) {
          return res.status(404).json({
            success: false,
            error: 'Интеграция не найдена'
          });
        }
        
        res.json({
          success: true,
          integrationId: id
        });
      } catch (error) {
        this.logError(`Ошибка при остановке интеграции: ${error.message}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения списка активных интеграций
    app.get('/api/copy-trading-ai/integrations', (req, res) => {
      try {
        const integrations = this.getActiveIntegrations();
        
        res.json({
          success: true,
          integrations
        });
      } catch (error) {
        this.logError(`Ошибка при получении списка интеграций: ${error.message}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения конфигурации интегратора
    app.get('/api/copy-trading-ai/config', (req, res) => {
      try {
        res.json({
          success: true,
          config: this.config
        });
      } catch (error) {
        this.logError(`Ошибка при получении конфигурации: ${error.message}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для обновления конфигурации интегратора
    app.post('/api/copy-trading-ai/config', (req, res) => {
      try {
        const newConfig = req.body;
        
        if (!newConfig || typeof newConfig !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'Необходимо передать объект конфигурации'
          });
        }
        
        // Обновляем конфигурацию
        this.config = {
          ...this.config,
          ...newConfig
        };
        
        res.json({
          success: true,
          config: this.config
        });
      } catch (error) {
        this.logError(`Ошибка при обновлении конфигурации: ${error.message}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * Логирование
   * @param {string} message - Сообщение для логирования
   */
  log(message) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('info', `[CopyTradingAIIntegrator] ${message}`);
    } else {
      console.log(`[CopyTradingAIIntegrator] ${message}`);
    }
  }

  /**
   * Логирование ошибок
   * @param {string} message - Сообщение об ошибке
   * @param {Error} error - Объект ошибки
   */
  logError(message, error) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('error', `[CopyTradingAIIntegrator] ${message}`, error);
    } else {
      console.error(`[CopyTradingAIIntegrator] ${message}`, error);
    }
  }
}

module.exports = CopyTradingAIIntegrator;