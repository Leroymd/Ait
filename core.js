// core.js - Улучшенное ядро торговой системы

/**
 * Главное ядро торговой системы.
 * Управляет модулями, коннекторами к биржам и системой событий.
 */
class TradingCore {
  /**
   * Создает новый экземпляр ядра торговой системы
   */
  constructor() {
    // Хранилище подключенных модулей
    this.modules = {};
    
    // Базовая конфигурация
    this.config = {
      exchange: null,
      tradingPair: null,
      apiKeys: {},
      loggingLevel: 'info', // 'debug', 'info', 'warn', 'error'
      defaultTimeframe: '1h',
      defaultHistoryLimit: 1000
    };
    
    // Коннекторы к биржам
    this.exchangeConnectors = {};
    
    // Флаг инициализации
    this.isInitialized = false;
    
    // Система событий
    this.eventListeners = {};
    
    // Функция для логирования (с возможностью замены)
    this.logger = this._defaultLogger;
  }

  /**
   * Инициализация ядра
   * @param {Object} config - Конфигурация ядра
   * @returns {Promise<boolean>} - Результат инициализации
   * @throws {Error} Если не указана биржа для подключения
   */
  async initialize(config) {
    try {
      this.logger('info', "Инициализация ядра торговой системы...");
      this.config = { ...this.config, ...config };
      
      // Конфигурируем логгер в зависимости от настроек
      this._configureLogger();
      
      // Проверяем наличие необходимых параметров
      if (!this.config.exchange) {
        throw new Error("Не указана биржа для подключения");
      }
      
      // Загружаем коннектор к бирже
      await this.loadExchangeConnector(this.config.exchange)
        .catch(err => {
          this.logger('error', `Не удалось загрузить коннектор к бирже: ${err.message}`);
          throw err;
        });
      
      // Инициализируем уже загруженные модули
      await this.initializeModules()
        .catch(err => {
          this.logger('warn', `Ошибка при инициализации некоторых модулей: ${err.message}`);
          // Продолжаем работу, даже если некоторые модули не инициализировались
        });
      
      this.isInitialized = true;
      
      // Оповещаем о завершении инициализации
      this.emit('core.initialized', { timestamp: Date.now() });
      
      this.logger('info', "Ядро инициализировано успешно");
      return true;
    } catch (error) {
      this.logger('error', `Ошибка инициализации ядра: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Настройка логгера на основе конфигурации
   * @private
   */
  _configureLogger() {
    // В реальном проекте здесь может быть более сложная логика
    // для настройки уровня логирования и форматирования
    const level = this.config.loggingLevel || 'info';
    
    // Определяем уровни логирования
    const logLevels = {
      'debug': 0,
      'info': 1,
      'warn': 2, 
      'error': 3
    };
    
    // Настраиваем логгер, чтобы он фильтровал сообщения по уровню
    this.logger = (messageLevel, message, data) => {
      if (logLevels[messageLevel] >= logLevels[level]) {
        this._defaultLogger(messageLevel, message, data);
      }
    };
  }

  /**
   * Логгер по умолчанию
   * @param {string} level - Уровень логирования (debug, info, warn, error)
   * @param {string} message - Сообщение для логирования
   * @param {Object} [data] - Дополнительные данные
   * @private
   */
  _defaultLogger(level, message, data) {
    const timestamp = new Date().toISOString();
    switch (level) {
      case 'debug':
        console.debug(`[${timestamp}] [DEBUG] ${message}`);
        break;
      case 'info':
        console.log(`[${timestamp}] [INFO] ${message}`);
        break;
      case 'warn':
        console.warn(`[${timestamp}] [WARN] ${message}`);
        break;
      case 'error':
        console.error(`[${timestamp}] [ERROR] ${message}`);
        if (data) console.error(data);
        break;
      default:
        console.log(`[${timestamp}] ${message}`);
    }
  }

  /**
   * Инициализация уже загруженных модулей
   * @returns {Promise<Array>} - Массив результатов инициализации
   * @private
   */
  async initializeModules() {
    const moduleIds = Object.keys(this.modules);
    
    if (moduleIds.length === 0) {
      this.logger('debug', "Нет модулей для инициализации");
      return [];
    }
    
    this.logger('info', `Инициализация ${moduleIds.length} модулей...`);
    
    const initResults = [];
    
    // Для каждого модуля вызываем метод initialize, но обрабатываем ошибки индивидуально
    for (const moduleId of moduleIds) {
      try {
        const result = await this.modules[moduleId].initialize(this);
        initResults.push({ moduleId, success: true, result });
        this.logger('info', `Модуль ${moduleId} инициализирован`);
      } catch (error) {
        initResults.push({ moduleId, success: false, error });
        this.logger('error', `Ошибка инициализации модуля ${moduleId}: ${error.message}`, error);
      }
    }
    
    // Если все модули завершились с ошибкой, генерируем предупреждение
    if (initResults.every(r => !r.success)) {
      this.logger('warn', "Ни один модуль не был инициализирован успешно");
    }
    
    return initResults;
  }

  /**
   * Загрузка коннектора к бирже
   * @param {string} exchangeName - Имя биржи
   * @returns {Promise<Object>} - Экземпляр коннектора
   * @throws {Error} Если биржа не поддерживается
   */
  async loadExchangeConnector(exchangeName) {
    const exchange = exchangeName.toLowerCase();
    this.logger('info', `Загрузка коннектора к бирже ${exchange}...`);
    
    try {
      let connector;
      
      // Фабрика коннекторов к биржам
      switch (exchange) {
        case 'binance':
          connector = await this._loadConnector('./connectors/binance', exchange);
          break;
        case 'bybit':
          connector = await this._loadConnector('./connectors/bybit', exchange);
          break;
        case 'bitget':
          connector = await this._loadConnector('./connectors/bitget', exchange);
          break;
        case 'mexc':
          connector = await this._loadConnector('./connectors/mexc', exchange);
          break;
        default:
          throw new Error(`Неподдерживаемая биржа: ${exchangeName}`);
      }
      
      // Сохраняем активную биржу в конфигурации
      this.config.activeExchange = exchange;
      
      // Оповещаем о смене биржи
      this.emit('exchange.changed', { exchange });
      
      this.logger('info', `Коннектор к бирже ${exchange} успешно загружен`);
      
      return connector;
    } catch (error) {
      this.logger('error', `Ошибка при загрузке коннектора к бирже ${exchange}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Загрузка коннектора из файла
   * @param {string} connectorPath - Путь к файлу коннектора
   * @param {string} exchange - Имя биржи
   * @returns {Promise<Object>} - Экземпляр коннектора
   * @private
   */
  async _loadConnector(connectorPath, exchange) {
    try {
      const ConnectorClass = require(connectorPath);
      const connector = new ConnectorClass(this.config.apiKeys[exchange] || {});
      this.exchangeConnectors[exchange] = connector;
      
      // Инициализируем коннектор с тайм-аутом для предотвращения зависания
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Превышено время ожидания при инициализации коннектора ${exchange}`)), 30000);
      });
      
      await Promise.race([connector.initialize(), timeoutPromise]);
      
      return connector;
    } catch (error) {
      delete this.exchangeConnectors[exchange];
      throw error;
    }
  }

  /**
   * Получение активного коннектора к бирже
   * @returns {Object} - Экземпляр коннектора
   * @throws {Error} Если ядро не инициализировано или коннектор не найден
   */
  getActiveExchangeConnector() {
    if (!this.isInitialized) {
      throw new Error("Ядро не инициализировано");
    }
    
    const activeExchange = this.config.activeExchange;
    const connector = this.exchangeConnectors[activeExchange];
    
    if (!connector) {
      throw new Error(`Коннектор для биржи ${activeExchange} не найден`);
    }
    
    return connector;
  }

  /**
   * Установка торговой пары
   * @param {string} pair - Торговая пара (например, "BTCUSDT")
   */
  setTradingPair(pair) {
    if (!pair) {
      this.logger('warn', "Попытка установить пустую торговую пару");
      return;
    }
    
    this.logger('info', `Установка торговой пары: ${pair}`);
    const oldPair = this.config.tradingPair;
    this.config.tradingPair = pair;
    
    // Оповещаем все модули об изменении пары через систему событий
    this.emit('tradingPair.changed', { 
      oldPair, 
      newPair: pair 
    });
  }

  /**
   * Получение данных графика выбранной пары
   * @param {Object} params - Параметры запроса
   * @param {string} [params.symbol] - Символ торговой пары (необязательно, по умолчанию из конфигурации)
   * @param {string} [params.interval] - Интервал (timeframe) (необязательно, по умолчанию из конфигурации)
   * @param {number} [params.limit] - Количество свечей (необязательно, по умолчанию из конфигурации)
   * @param {number} [params.endTime] - Время окончания (необязательно)
   * @returns {Promise<Array>} - Массив свечей
   * @throws {Error} Если ядро не инициализировано или пара не выбрана
   */
  async getChartData(params = {}) {
    if (!this.isInitialized) {
      throw new Error("Ядро не инициализировано");
    }
    
    // Применяем значения по умолчанию из конфигурации
    const requestParams = {
      symbol: params.symbol || this.config.tradingPair,
      interval: params.interval || this.config.defaultTimeframe,
      limit: params.limit || this.config.defaultHistoryLimit,
      endTime: params.endTime
    };
    
    if (!requestParams.symbol) {
      throw new Error("Не выбрана торговая пара");
    }
    
    try {
      const exchange = this.getActiveExchangeConnector();
      return await exchange.getChartData(requestParams);
    } catch (error) {
      this.logger('error', `Ошибка при получении данных графика: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Регистрация модуля в системе
   * @param {string} moduleId - Идентификатор модуля
   * @param {Object} moduleInstance - Экземпляр модуля
   * @returns {boolean} - Результат регистрации
   * @throws {Error} Если модуль не реализует необходимый интерфейс
   */
  registerModule(moduleId, moduleInstance) {
    try {
      this.logger('info', `Регистрация модуля: ${moduleId}`);
      
      // Проверяем, что модуль реализует необходимый интерфейс
      if (typeof moduleInstance.initialize !== 'function') {
        throw new Error(`Модуль ${moduleId} не реализует метод initialize`);
      }
      
      // Проверяем, не зарегистрирован ли уже модуль с таким ID
      if (this.modules[moduleId]) {
        this.logger('warn', `Модуль с ID ${moduleId} уже зарегистрирован и будет перезаписан`);
      }
      
      this.modules[moduleId] = moduleInstance;
      
      // Если ядро уже инициализировано, инициализируем и модуль
      if (this.isInitialized) {
        moduleInstance.initialize(this)
          .then(() => {
            this.logger('info', `Модуль ${moduleId} успешно инициализирован`);
            this.emit('module.registered', { moduleId });
          })
          .catch(error => {
            this.logger('error', `Ошибка инициализации модуля ${moduleId}: ${error.message}`, error);
          });
      }
      
      return true;
    } catch (error) {
      this.logger('error', `Ошибка при регистрации модуля ${moduleId}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Получение модуля по ID
   * @param {string} moduleId - Идентификатор модуля
   * @returns {Object|null} - Экземпляр модуля или null, если модуль не найден
   */
  getModule(moduleId) {
    const module = this.modules[moduleId] || null;
    
    if (!module) {
      this.logger('debug', `Запрошен несуществующий модуль: ${moduleId}`);
    }
    
    return module;
  }

  /**
   * Проверка, загружен ли модуль
   * @param {string} moduleId - Идентификатор модуля
   * @returns {boolean} - true, если модуль загружен
   */
  hasModule(moduleId) {
    return moduleId in this.modules;
  }

  /**
   * Выгрузка модуля из системы
   * @param {string} moduleId - Идентификатор модуля
   * @returns {Promise<boolean>} - Результат выгрузки
   */
  async unregisterModule(moduleId) {
    this.logger('info', `Выгрузка модуля: ${moduleId}`);
    
    if (!this.hasModule(moduleId)) {
      this.logger('warn', `Модуль ${moduleId} не найден`);
      return false;
    }
    
    try {
      // Вызываем метод cleanup модуля, если он есть
      if (typeof this.modules[moduleId].cleanup === 'function') {
        await this.modules[moduleId].cleanup();
      }
      
      delete this.modules[moduleId];
      
      // Оповещаем о выгрузке модуля
      this.emit('module.unregistered', { moduleId });
      
      this.logger('info', `Модуль ${moduleId} успешно выгружен`);
      return true;
    } catch (error) {
      this.logger('error', `Ошибка при выгрузке модуля ${moduleId}: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Динамическая загрузка модуля по пути к файлу
   * @param {Object} moduleConfig - Конфигурация модуля
   * @param {string} moduleConfig.id - Идентификатор модуля
   * @param {string} moduleConfig.path - Путь к файлу модуля
   * @param {Object} [moduleConfig.config] - Конфигурация модуля
   * @returns {Promise<boolean>} - Результат загрузки
   */
  async loadModule(moduleConfig) {
    try {
      const { id, path: modulePath, config } = moduleConfig;
      
      if (!id || !modulePath) {
        throw new Error("Неверная конфигурация модуля: отсутствует id или path");
      }
      
      this.logger('info', `Загрузка модуля из файла: ${modulePath}`);
      
      // Загружаем класс модуля
      let ModuleClass;
      try {
        ModuleClass = require(modulePath);
      } catch (error) {
        throw new Error(`Не удалось загрузить файл модуля ${modulePath}: ${error.message}`);
      }
      
      // Создаем экземпляр модуля
      const moduleInstance = new ModuleClass(config || {});
      
      // Регистрируем модуль
      this.registerModule(id, moduleInstance);
      
      return true;
    } catch (error) {
      this.logger('error', `Ошибка при загрузке модуля: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Подписка на событие
   * @param {string} eventType - Тип события
   * @param {Function} callback - Функция-обработчик события
   * @returns {TradingCore} - this для цепочки вызовов
   */
  on(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    
    this.eventListeners[eventType].push(callback);
    return this; // Для цепочки вызовов
  }
  
  /**
   * Отписка от события
   * @param {string} eventType - Тип события
   * @param {Function} [callback] - Функция-обработчик события (если не указана, удаляются все обработчики)
   * @returns {TradingCore} - this для цепочки вызовов
   */
  off(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      return this; // Нет слушателей для этого типа события
    }
    
    // Если callback не указан, удаляем все слушатели для этого типа события
    if (!callback) {
      delete this.eventListeners[eventType];
      return this;
    }
    
    // Удаляем конкретный callback
    this.eventListeners[eventType] = this.eventListeners[eventType]
      .filter(listener => listener !== callback);
    
    return this;
  }
  
  /**
   * Публикация события
   * @param {string} eventType - Тип события
   * @param {Object} [eventData={}] - Данные события
   * @returns {boolean} - Результат публикации (true, если были слушатели)
   */
  emit(eventType, eventData = {}) {
    // Добавляем метаданные события
    eventData.eventType = eventType;
    eventData.timestamp = eventData.timestamp || Date.now();
    
    // Логируем событие
    if (eventType !== 'log') { // Предотвращаем рекурсию
      this.logger('debug', `Событие: ${eventType}`, eventData);
    }
    
    // Если нет слушателей, просто выходим
    if (!this.eventListeners[eventType] || this.eventListeners[eventType].length === 0) {
      return false;
    }
    
    // Вызываем всех слушателей
    let hasErrors = false;
    this.eventListeners[eventType].forEach(callback => {
      try {
        callback(eventData);
      } catch (error) {
        hasErrors = true;
        this.logger('error', `Ошибка в обработчике события ${eventType}: ${error.message}`, error);
      }
    });
    
    if (hasErrors) {
      this.logger('warn', `Возникли ошибки при обработке события ${eventType}`);
    }
    
    return true;
  }
  
  /**
   * Одноразовая подписка на событие
   * @param {string} eventType - Тип события
   * @param {Function} callback - Функция-обработчик события
   * @returns {TradingCore} - this для цепочки вызовов
   */
  once(eventType, callback) {
    const onceCallback = (eventData) => {
      // Отписываемся сразу после первого вызова
      this.off(eventType, onceCallback);
      // Вызываем оригинальный callback
      callback(eventData);
    };
    
    this.on(eventType, onceCallback);
    return this;
  }
}

module.exports = TradingCore;