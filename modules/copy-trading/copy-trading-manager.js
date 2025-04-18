// modules/copy-trading/copy-trading-manager.js

const BitgetCopyTradingConnector = require('./bitget-connector');
const BinanceCopyTradingConnector = require('./binance-connector');
const BybitCopyTradingConnector = require('./bybit-connector');

/**
 * Менеджер для управления копитрейдингом с разных бирж
 */
class CopyTradingManager {
  constructor(config = {}) {
    this.config = config;
    this.core = null;
    this.connectors = {};
    this.initialized = false;
    this.activeMonitors = new Map();
  }

  /**
   * Инициализация менеджера
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize(core) {
    this.core = core;
    this.log('Инициализация менеджера копитрейдинга...');
    
    // Создаем коннекторы для всех поддерживаемых бирж
    await this._initializeConnectors();
    
    this.initialized = true;
    this.log('Менеджер копитрейдинга успешно инициализирован');
    
    return true;
  }

  /**
   * Инициализация коннекторов для бирж
   * @returns {Promise<void>}
   * @private
   */
  async _initializeConnectors() {
    try {
      // Инициализация Bitget
      if (this.config.bitget && this.config.bitget.enabled !== false) {
        this.connectors.bitget = new BitgetCopyTradingConnector(this.config.bitget);
        await this.connectors.bitget.initialize(this.core);
        this.log('Коннектор Bitget инициализирован');
      }
      
      // Инициализация Binance
      if (this.config.binance && this.config.binance.enabled !== false) {
        this.connectors.binance = new BinanceCopyTradingConnector(this.config.binance);
        await this.connectors.binance.initialize(this.core);
        this.log('Коннектор Binance инициализирован');
      }
      
      // Инициализация Bybit
      if (this.config.bybit && this.config.bybit.enabled !== false) {
        this.connectors.bybit = new BybitCopyTradingConnector(this.config.bybit);
        await this.connectors.bybit.initialize(this.core);
        this.log('Коннектор Bybit инициализирован');
      }
    } catch (error) {
      this.logError('Ошибка при инициализации коннекторов', error);
      throw error;
    }
  }

  /**
   * Получение списка активных коннекторов
   * @returns {Array} - Список активных коннекторов
   */
  getActiveConnectors() {
    return Object.entries(this.connectors)
      .filter(([_, connector]) => connector.initialized)
      .map(([exchange, _]) => exchange);
  }

  /**
   * Получение коннектора по имени биржи
   * @param {string} exchange - Имя биржи
   * @returns {Object|null} - Коннектор или null, если не найден
   */
  getConnector(exchange) {
    const connector = this.connectors[exchange.toLowerCase()];
    
    if (!connector || !connector.initialized) {
      return null;
    }
    
    return connector;
  }

  /**
   * Получение трейдеров с конкретной биржи
   * @param {string} exchange - Имя биржи
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - Список трейдеров
   */
  async getTraders(exchange, options = {}) {
    const connector = this.getConnector(exchange);
    
    if (!connector) {
      throw new Error(`Коннектор для биржи ${exchange} не найден или не инициализирован`);
    }
    
    return await connector.getTraders(options);
  }

  /**
   * Получение трейдеров со всех активных бирж
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Object>} - Трейдеры сгруппированные по биржам
   */
  async getAllTraders(options = {}) {
    const result = {};
    const errors = {};
    
    // Получаем трейдеров с каждой активной биржи
    const exchanges = this.getActiveConnectors();
    
    for (const exchange of exchanges) {
      try {
        result[exchange] = await this.getTraders(exchange, options);
      } catch (error) {
        this.logError(`Ошибка получения трейдеров с биржи ${exchange}`, error);
        errors[exchange] = error.message;
      }
    }
    
    return { traders: result, errors };
  }

  /**
   * Получение позиций трейдера с конкретной биржи
   * @param {string} exchange - Имя биржи
   * @param {string} traderId - ID трейдера
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - Список позиций
   */
  async getTraderPositions(exchange, traderId, options = {}) {
    const connector = this.getConnector(exchange);
    
    if (!connector) {
      throw new Error(`Коннектор для биржи ${exchange} не найден или не инициализирован`);
    }
    
    // Получаем позиции трейдера
    const positions = await connector.getTraderPositions(traderId, options);
    
    // Получаем информацию о трейдере для добавления в сигналы
    let traderInfo = { traderId };
    
    try {
      traderInfo = await connector.getTraderStats(traderId);
    } catch (error) {
      this.logError(`Ошибка получения информации о трейдере ${traderId}`, error);
    }
    
    // Преобразуем в стандартные сигналы
    return connector.convertToStandardSignals(positions, traderInfo);
  }

  /**
   * Начало мониторинга сигналов копитрейдинга
   * @param {string} exchange - Имя биржи
   * @param {string} traderId - ID трейдера (если null, то мониторинг всех топ-трейдеров)
   * @param {Object} options - Опции мониторинга
   * @returns {string} - ID монитора
   */
  startMonitoring(exchange, traderId = null, options = {}) {
    const connector = this.getConnector(exchange);
    
    if (!connector) {
      throw new Error(`Коннектор для биржи ${exchange} не найден или не инициализирован`);
    }
    
    // Генерируем уникальный ID для монитора
    const monitorId = `${exchange}_${traderId || 'all'}_${Date.now()}`;
    
    // Интервал обновления
    const interval = options.interval || 300000; // 5 минут по умолчанию
    
    // Функция мониторинга
    const monitorFunction = async () => {
      try {
        let signals = [];
        
        if (traderId) {
          // Мониторинг конкретного трейдера
          signals = await this.getTraderPositions(exchange, traderId, options);
        } else {
          // Мониторинг топ-трейдеров
          const traders = await this.getTraders(exchange, {
            limit: options.tradersLimit || 10,
            ...options.tradersOptions
          });
          
          // Получаем позиции для каждого трейдера
          for (const trader of traders) {
            try {
              const traderSignals = await this.getTraderPositions(
                exchange, 
                trader.traderId, 
                options
              );
              
              signals.push(...traderSignals);
            } catch (error) {
              this.logError(`Ошибка получения позиций трейдера ${trader.traderId}`, error);
            }
          }
        }
        
        // Фильтруем сигналы по параметрам
        let filteredSignals = signals;
        
        // Фильтр по паре
        if (options.pair) {
          filteredSignals = filteredSignals.filter(
            signal => signal.pair === options.pair
          );
        }
        
        // Фильтр по направлению
        if (options.direction) {
          filteredSignals = filteredSignals.filter(
            signal => signal.direction === options.direction.toUpperCase()
          );
        }
        
        // Фильтр по минимальному рейтингу трейдера
        if (options.minWinRate) {
          filteredSignals = filteredSignals.filter(
            signal => (signal.traderStats?.winRate || 0) >= options.minWinRate
          );
        }
        
        // Проверяем, есть ли новые сигналы
        if (filteredSignals.length > 0) {
          // Получаем информацию о мониторе
          const monitor = this.activeMonitors.get(monitorId);
          
          // Сравниваем с предыдущими сигналами, чтобы найти новые
          const knownPositionIds = new Set(
            monitor.lastSignals.map(s => `${s.pair}_${s.direction}_${s.traderId}`)
          );
          
          const newSignals = filteredSignals.filter(
            signal => !knownPositionIds.has(`${signal.pair}_${signal.direction}_${signal.traderId}`)
          );
          
          // Обновляем последние известные сигналы
          monitor.lastSignals = filteredSignals;
          this.activeMonitors.set(monitorId, monitor);
          
          // Если есть новые сигналы, публикуем их
          if (newSignals.length > 0) {
            this.log(`Обнаружено ${newSignals.length} новых сигналов копитрейдинга на ${exchange}`);
            
            // Публикуем событие для каждого нового сигнала
            newSignals.forEach(signal => {
              if (this.core) {
                this.core.emit('copy-trading.new-signal', { 
                  signal,
                  exchange,
                  monitorId
                });
              }
            });
            
            // Если настроен колбэк для обработки сигналов, вызываем его
            if (typeof options.onNewSignals === 'function') {
              options.onNewSignals(newSignals, exchange, monitorId);
            }
          }
        }
      } catch (error) {
        this.logError(`Ошибка при мониторинге копитрейдинга на ${exchange}`, error);
      }
    };
    
    // Запускаем первый мониторинг
    monitorFunction();
    
    // Создаем интервал для регулярной проверки
    const intervalId = setInterval(monitorFunction, interval);
    
    // Сохраняем информацию о мониторе
    this.activeMonitors.set(monitorId, {
      id: monitorId,
      exchange,
      traderId,
      options,
      interval,
      intervalId,
      startTime: Date.now(),
      lastSignals: [],
      status: 'active'
    });
    
    this.log(`Запущен мониторинг копитрейдинга на ${exchange} с интервалом ${interval}ms`);
    
    return monitorId;
  }

  /**
   * Остановка мониторинга
   * @param {string} monitorId - ID монитора
   * @returns {boolean} - Успешность операции
   */
  stopMonitoring(monitorId) {
    if (!this.activeMonitors.has(monitorId)) {
      return false;
    }
    
    const monitor = this.activeMonitors.get(monitorId);
    
    // Останавливаем интервал
    clearInterval(monitor.intervalId);
    
    // Обновляем статус
    monitor.status = 'stopped';
    monitor.stopTime = Date.now();
    
    this.log(`Остановлен мониторинг копитрейдинга ${monitorId}`);
    
    // Публикуем событие остановки монитора
    if (this.core) {
      this.core.emit('copy-trading.monitor-stopped', { 
        monitorId,
        exchange: monitor.exchange,
        traderId: monitor.traderId,
        runtime: monitor.stopTime - monitor.startTime
      });
    }
    
    // Удаляем монитор из активных
    this.activeMonitors.delete(monitorId);
    
    return true;
  }

  /**
   * Получение списка активных мониторов
   * @returns {Array} - Список активных мониторов
   */
  getActiveMonitors() {
    return Array.from(this.activeMonitors.entries()).map(([id, monitor]) => ({
      id,
      exchange: monitor.exchange,
      traderId: monitor.traderId,
      interval: monitor.interval,
      startTime: monitor.startTime,
      runtime: Date.now() - monitor.startTime,
      signalsCount: monitor.lastSignals.length,
      status: monitor.status
    }));
  }

  /**
   * Очистка ресурсов
   */
  async cleanup() {
    this.log('Очистка ресурсов менеджера копитрейдинга...');
    
    // Останавливаем все активные мониторы
    for (const [monitorId] of this.activeMonitors) {
      this.stopMonitoring(monitorId);
    }
    
    // Очищаем коннекторы
    for (const connector of Object.values(this.connectors)) {
      if (connector.cleanup && typeof connector.cleanup === 'function') {
        await connector.cleanup();
      }
    }
    
    this.initialized = false;
    this.log('Менеджер копитрейдинга успешно выгружен');
  }

  /**
   * Регистрация API эндпоинтов
   * @param {Object} app - Экземпляр Express приложения
   */
  registerApiEndpoints(app) {
    if (!app) return;
    
    // Получение списка поддерживаемых бирж
    app.get('/api/copy-trading/exchanges', (req, res) => {
      try {
        const exchanges = this.getActiveConnectors();
        
        res.json({
          success: true,
          exchanges
        });
      } catch (error) {
        this.logError('Ошибка при получении списка бирж', error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Получение списка трейдеров с конкретной биржи
    app.get('/api/copy-trading/:exchange/traders', async (req, res) => {
      try {
        const { exchange } = req.params;
        
        const options = {
          limit: parseInt(req.query.limit || '20', 10),
          page: parseInt(req.query.page || '1', 10),
          ...req.query
        };
        
        const traders = await this.getTraders(exchange, options);
        
        res.json({
          success: true,
          exchange,
          traders
        });
      } catch (error) {
        this.logError(`Ошибка при получении трейдеров биржи ${req.params.exchange}`, error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Получение списка трейдеров со всех бирж
    app.get('/api/copy-trading/traders', async (req, res) => {
      try {
        const options = {
          limit: parseInt(req.query.limit || '20', 10),
          page: parseInt(req.query.page || '1', 10),
          ...req.query
        };
        
        const result = await this.getAllTraders(options);
        
        res.json({
          success: true,
          ...result
        });
      } catch (error) {
        this.logError('Ошибка при получении трейдеров со всех бирж', error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Получение позиций трейдера
    app.get('/api/copy-trading/:exchange/traders/:traderId/positions', async (req, res) => {
      try {
        const { exchange, traderId } = req.params;
        
        const options = {
          ...req.query
        };
        
        const signals = await this.getTraderPositions(exchange, traderId, options);
        
        res.json({
          success: true,
          exchange,
          traderId,
          signals
        });
      } catch (error) {
        this.logError(`Ошибка при получении позиций трейдера ${req.params.traderId}`, error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Получение статистики трейдера
    app.get('/api/copy-trading/:exchange/traders/:traderId/stats', async (req, res) => {
      try {
        const { exchange, traderId } = req.params;
        
        const connector = this.getConnector(exchange);
        
        if (!connector) {
          return res.status(404).json({
            success: false,
            error: `Коннектор для биржи ${exchange} не найден`
          });
        }
        
        const stats = await connector.getTraderStats(traderId);
        
        res.json({
          success: true,
          exchange,
          traderId,
          stats
        });
      } catch (error) {
        this.logError(`Ошибка при получении статистики трейдера ${req.params.traderId}`, error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Запуск мониторинга копитрейдинга
    app.post('/api/copy-trading/start-monitoring', async (req, res) => {
      try {
        const { exchange, traderId, options } = req.body;
        
        if (!exchange) {
          return res.status(400).json({
            success: false,
            error: 'Необходимо указать биржу'
          });
        }
        
        const monitorId = this.startMonitoring(exchange, traderId, options || {});
        
        res.json({
          success: true,
          monitorId,
          exchange,
          traderId: traderId || 'all'
        });
      } catch (error) {
        this.logError('Ошибка при запуске мониторинга', error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Остановка мониторинга
    app.post('/api/copy-trading/stop-monitoring/:monitorId', async (req, res) => {
      try {
        const { monitorId } = req.params;
        
        const result = this.stopMonitoring(monitorId);
        
        if (!result) {
          return res.status(404).json({
            success: false,
            error: 'Монитор не найден'
          });
        }
        
        res.json({
          success: true,
          monitorId
        });
      } catch (error) {
        this.logError(`Ошибка при остановке мониторинга ${req.params.monitorId}`, error);
        res.status(500).json({ 
          success: false,
          error: error.message
        });
      }
    });
    
    // Получение списка активных мониторов
    app.get('/api/copy-trading/monitors', (req, res) => {
      try {
        const monitors = this.getActiveMonitors();
        
        res.json({
          success: true,
          monitors
        });
      } catch (error) {
        this.logError('Ошибка при получении списка мониторов', error);
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
      this.core.logger('info', `[CopyTradingManager] ${message}`);
    } else {
      console.log(`[CopyTradingManager] ${message}`);
    }
  }

  /**
   * Логирование ошибок
   * @param {string} message - Сообщение об ошибке
   * @param {Error} error - Объект ошибки
   */
  logError(message, error) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('error', `[CopyTradingManager] ${message}`, error);
    } else {
      console.error(`[CopyTradingManager] ${message}`, error);
    }
  }
}

module.exports = CopyTradingManager;