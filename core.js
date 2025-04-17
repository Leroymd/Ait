// core.js - Улучшенное ядро торговой системы

class TradingCore {
  constructor() {
    this.modules = {}; // Хранилище подключенных модулей
    this.config = {
      exchange: null,
      tradingPair: null,
      apiKeys: {}
    };
    this.exchangeConnectors = {}; // Коннекторы к биржам
    this.isInitialized = false;
    
    // Система событий
    this.eventListeners = {};
  }

  // Инициализация ядра
  async initialize(config) {
    console.log("Инициализация ядра торговой системы...");
    this.config = { ...this.config, ...config };
    
    // Проверяем наличие необходимых параметров
    if (!this.config.exchange) {
      throw new Error("Не указана биржа для подключения");
    }
    
    // Загружаем коннектор к бирже
    await this.loadExchangeConnector(this.config.exchange);
    
    // Инициализируем уже загруженные модули
    await this.initializeModules();
    
    this.isInitialized = true;
    
    // Оповещаем о завершении инициализации
    this.emit('core.initialized', { timestamp: Date.now() });
    
    console.log("Ядро инициализировано успешно");
    return true;
  }

  // Инициализация уже загруженных модулей
  async initializeModules() {
    const moduleIds = Object.keys(this.modules);
    
    if (moduleIds.length > 0) {
      console.log(`Инициализация ${moduleIds.length} модулей...`);
      
      for (const moduleId of moduleIds) {
        try {
          await this.modules[moduleId].initialize(this);
          console.log(`Модуль ${moduleId} инициализирован`);
        } catch (error) {
          console.error(`Ошибка инициализации модуля ${moduleId}:`, error);
        }
      }
    }
  }

  // Загрузка коннектора к бирже
  async loadExchangeConnector(exchangeName) {
    console.log(`Загрузка коннектора к бирже ${exchangeName}...`);
    
    // Здесь будет логика загрузки и инициализации соответствующего коннектора
    const exchange = exchangeName.toLowerCase();
    
    if (exchange === 'binance') {
      const BinanceConnector = require('./connectors/binance');
      this.exchangeConnectors.binance = new BinanceConnector(this.config.apiKeys.binance);
      await this.exchangeConnectors.binance.initialize();
    } else if (exchange === 'bybit') {
      const BybitConnector = require('./connectors/bybit');
      this.exchangeConnectors.bybit = new BybitConnector(this.config.apiKeys.bybit);
      await this.exchangeConnectors.bybit.initialize();
    } else if (exchange === 'bitget') {
      const BitgetConnector = require('./connectors/bitget');
      this.exchangeConnectors.bitget = new BitgetConnector(this.config.apiKeys.bitget);
      await this.exchangeConnectors.bitget.initialize();
    } else if (exchange === 'mexc') {
      const MexcConnector = require('./connectors/mexc');
      this.exchangeConnectors.mexc = new MexcConnector(this.config.apiKeys.mexc);
      await this.exchangeConnectors.mexc.initialize();
    } else {
      throw new Error(`Неподдерживаемая биржа: ${exchangeName}`);
    }
    
    this.config.activeExchange = exchange;
    
    // Оповещаем о смене биржи
    this.emit('exchange.changed', { exchange });
    
    console.log(`Коннектор к бирже ${exchangeName} успешно загружен`);
  }

  // Получение активного коннектора к бирже
  getActiveExchangeConnector() {
    if (!this.isInitialized) {
      throw new Error("Ядро не инициализировано");
    }
    
    return this.exchangeConnectors[this.config.activeExchange];
  }

  // Установка торговой пары
  setTradingPair(pair) {
    console.log(`Установка торговой пары: ${pair}`);
    const oldPair = this.config.tradingPair;
    this.config.tradingPair = pair;
    
    // Оповещаем все модули об изменении пары через систему событий
    this.emit('tradingPair.changed', { 
      oldPair, 
      newPair: pair 
    });
  }

  // Получение графика выбранной пары
  async getChartData(params) {
    if (!this.isInitialized) {
      throw new Error("Ядро не инициализировано");
    }
    
    const symbol = params.symbol || this.config.tradingPair;
    if (!symbol) {
      throw new Error("Не выбрана торговая пара");
    }
    
    const exchange = this.getActiveExchangeConnector();
    return await exchange.getChartData(params);
  }

  // Регистрация модуля в системе
  registerModule(moduleId, moduleInstance) {
    console.log(`Регистрация модуля: ${moduleId}`);
    
    // Проверяем, что модуль реализует необходимый интерфейс
    if (typeof moduleInstance.initialize !== 'function') {
      throw new Error(`Модуль ${moduleId} не реализует метод initialize`);
    }
    
    // Проверяем, не зарегистрирован ли уже модуль с таким ID
    if (this.modules[moduleId]) {
      console.warn(`Модуль с ID ${moduleId} уже зарегистрирован и будет перезаписан`);
    }
    
    this.modules[moduleId] = moduleInstance;
    
    // Если ядро уже инициализировано, инициализируем и модуль
    if (this.isInitialized) {
      moduleInstance.initialize(this)
        .then(() => {
          console.log(`Модуль ${moduleId} успешно инициализирован`);
          this.emit('module.registered', { moduleId });
        })
        .catch(error => {
          console.error(`Ошибка инициализации модуля ${moduleId}:`, error);
        });
    }
    
    return true;
  }

  // Получение модуля по ID
  getModule(moduleId) {
    return this.modules[moduleId] || null;
  }

  // Проверка, загружен ли модуль
  hasModule(moduleId) {
    return moduleId in this.modules;
  }

  // Выгрузка модуля из системы
  async unregisterModule(moduleId) {
    console.log(`Выгрузка модуля: ${moduleId}`);
    
    if (!this.hasModule(moduleId)) {
      console.warn(`Модуль ${moduleId} не найден`);
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
      
      console.log(`Модуль ${moduleId} успешно выгружен`);
      return true;
    } catch (error) {
      console.error(`Ошибка при выгрузке модуля ${moduleId}:`, error);
      return false;
    }
  }

  // Динамическая загрузка модуля по пути к файлу
  async loadModule(moduleConfig) {
    try {
      const { id, path: modulePath, config } = moduleConfig;
      
      // Загружаем класс модуля
      const ModuleClass = require(modulePath);
      
      // Создаем экземпляр модуля
      const moduleInstance = new ModuleClass(config || {});
      
      // Регистрируем модуль
      this.registerModule(id, moduleInstance);
      
      return true;
    } catch (error) {
      console.error(`Ошибка при загрузке модуля:`, error);
      return false;
    }
  }

  // Система событий
  
  // Подписка на событие
  on(eventType, callback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    
    this.eventListeners[eventType].push(callback);
    return this; // Для цепочки вызовов
  }
  
  // Отписка от события
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
  
  // Публикация события
  emit(eventType, eventData = {}) {
    // Добавляем метаданные события
    eventData.eventType = eventType;
    eventData.timestamp = eventData.timestamp || Date.now();
    
    // Логируем событие
    if (eventType !== 'log') { // Предотвращаем рекурсию
      console.log(`Событие: ${eventType}`, eventData);
    }
    
    // Если нет слушателей, просто выходим
    if (!this.eventListeners[eventType]) {
      return false;
    }
    
    // Вызываем всех слушателей
    this.eventListeners[eventType].forEach(callback => {
      try {
        callback(eventData);
      } catch (error) {
        console.error(`Ошибка в обработчике события ${eventType}:`, error);
      }
    });
    
    return true;
  }
  
  // Одноразовая подписка на событие
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