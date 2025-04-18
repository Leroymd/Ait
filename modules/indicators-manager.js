// modules/indicators-manager.js
// Менеджер для управления индикаторами

const fs = require('fs');
const path = require('path');

class IndicatorsManager {
  constructor(config) {
    this.config = config || {};
    this.indicators = {};
    this.core = null;
    this.isInitialized = false;
    this.indicatorsDir = path.join(process.cwd(), 'modules', 'indicators');
  }
  
  // Инициализация менеджера индикаторов
  async initialize(core) {
    this.core = core;
    
    // Создаем директорию для индикаторов, если она не существует
    if (!fs.existsSync(this.indicatorsDir)) {
      fs.mkdirSync(this.indicatorsDir, { recursive: true });
    }
    
    // Загружаем все доступные индикаторы
    await this.loadIndicators();
    
    // Подписываемся на события ядра
    this.registerCoreEventHandlers();
    
    this.isInitialized = true;
    console.log('Менеджер индикаторов инициализирован');
    
    // Оповещаем о готовности
    if (this.core) {
      this.core.emit('indicators.ready', { 
        count: Object.keys(this.indicators).length,
        availableIndicators: Object.keys(this.indicators)
      });
    }
    
    return true;
  }
  
  // Регистрация обработчиков событий ядра
  registerCoreEventHandlers() {
    if (!this.core) return;
    
    // Подписываемся на событие изменения торговой пары
    this.core.on('tradingPair.changed', (data) => {
      console.log(`[IndicatorsManager] Обработка события изменения пары: ${data.newPair}`);
      // Можно добавить дополнительную логику при изменении пары
    });
  }
  
  // Загрузка всех индикаторов из директории
  async loadIndicators() {
    console.log('Загрузка индикаторов...');
    
    // Проверяем существование директории
    if (!fs.existsSync(this.indicatorsDir)) {
      console.warn('Директория индикаторов не существует');
      return;
    }
    
    // Получаем список файлов в директории
    const files = fs.readdirSync(this.indicatorsDir);
    
    // Исключаем базовый класс и фильтруем только .js файлы
    const indicatorFiles = files.filter(file => 
      file.endsWith('.js') && file !== 'indicator-base.js'
    );
    
    // Загружаем каждый индикатор
    for (const file of indicatorFiles) {
      try {
        const IndicatorClass = require(path.join(this.indicatorsDir, file));
        const filename = path.basename(file, '.js');
        
        // Пропускаем не-классы
        if (typeof IndicatorClass !== 'function') {
          continue;
        }
        
        // Создаем экземпляр индикатора
        const indicator = new IndicatorClass(this.config[filename]);
        
        // Инициализируем индикатор
        await indicator.initialize(this.core);
        
        // Сохраняем индикатор в реестре
        this.indicators[indicator.id] = indicator;
        
        console.log(`Индикатор ${indicator.name} успешно загружен`);
      } catch (error) {
        console.error(`Ошибка при загрузке индикатора ${file}:`, error);
      }
    }
    
    console.log(`Загружено индикаторов: ${Object.keys(this.indicators).length}`);
  }
  
  // Получение индикатора по ID
  getIndicator(id) {
    return this.indicators[id] || null;
  }
  
  // Получение списка всех индикаторов
  getAllIndicators() {
    return Object.values(this.indicators).map(indicator => indicator.getMetadata());
  }
  
  // Расчет индикатора
  async calculateIndicator(id, chartData) {
    const indicator = this.getIndicator(id);
    
    if (!indicator) {
      throw new Error(`Индикатор с ID ${id} не найден`);
    }
    
    return await indicator.calculate(chartData);
  }
  
  // Расчет всех индикаторов
  async calculateAllIndicators(chartData) {
    console.log(`Расчет всех индикаторов для набора данных из ${chartData.length} свечей`);
    
    const results = {};
    
    for (const [id, indicator] of Object.entries(this.indicators)) {
      try {
        results[id] = await indicator.calculate(chartData);
      } catch (error) {
        console.error(`Ошибка при расчете индикатора ${id}:`, error);
        results[id] = null;
      }
    }
    
    return results;
  }
  
  // Получение данных для отрисовки индикатора
  getIndicatorVisualData(id) {
    const indicator = this.getIndicator(id);
    
    if (!indicator) {
      throw new Error(`Индикатор с ID ${id} не найден`);
    }
    
    return indicator.getVisualData();
  }
  
  // Получение данных для отрисовки всех видимых индикаторов
  getAllVisibleIndicatorsData() {
    const visualData = {};
    
    Object.entries(this.indicators)
      .filter(([_, indicator]) => indicator.visible)
      .forEach(([id, indicator]) => {
        visualData[id] = indicator.getVisualData();
      });
    
    return visualData;
  }
  
  // Установка видимости индикатора
  setIndicatorVisibility(id, visible) {
    const indicator = this.getIndicator(id);
    
    if (!indicator) {
      throw new Error(`Индикатор с ID ${id} не найден`);
    }
    
    return indicator.setVisible(visible);
  }
  
  // Обновление конфигурации индикатора
  updateIndicatorConfig(id, config) {
    const indicator = this.getIndicator(id);
    
    if (!indicator) {
      throw new Error(`Индикатор с ID ${id} не найден`);
    }
    
    return indicator.updateConfig(config);
  }
  
  // Очистка ресурсов при выгрузке менеджера
  cleanup() {
    // Выгружаем все индикаторы
    Object.values(this.indicators).forEach(indicator => indicator.cleanup());
    
    this.indicators = {};
    this.isInitialized = false;
    console.log('Менеджер индикаторов выгружен');
  }
  
  // Регистрация нового индикатора по классу
  async registerIndicator(IndicatorClass, config = {}) {
    try {
      if (typeof IndicatorClass !== 'function') {
        throw new Error('Передан недопустимый класс индикатора');
      }
      
      // Создаем экземпляр индикатора
      const indicator = new IndicatorClass(config);
      
      // Инициализируем индикатор
      await indicator.initialize(this.core);
      
      // Сохраняем индикатор в реестре
      this.indicators[indicator.id] = indicator;
      
      console.log(`Индикатор ${indicator.name} успешно зарегистрирован`);
      return true;
    } catch (error) {
      console.error('Ошибка при регистрации индикатора:', error);
      return false;
    }
  }
  
  // Регистрация API эндпоинтов для управления индикаторами
  registerApiEndpoints(app) {
    // Получение списка индикаторов
    app.get('/api/indicators', (req, res) => {
      res.json({
        indicators: this.getAllIndicators()
      });
    });
    
    // Получение данных индикатора
    app.get('/api/indicators/:id', (req, res) => {
      try {
        const indicator = this.getIndicator(req.params.id);
        
        if (!indicator) {
          return res.status(404).json({
            error: `Индикатор с ID ${req.params.id} не найден`
          });
        }
        
        res.json({
          indicator: indicator.getMetadata(),
          visualData: indicator.getVisualData()
        });
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Управление видимостью индикатора
    app.post('/api/indicators/:id/visibility', (req, res) => {
      try {
        const { visible } = req.body;
        
        if (typeof visible !== 'boolean') {
          return res.status(400).json({
            error: 'Параметр visible должен быть логическим значением'
          });
        }
        
        const result = this.setIndicatorVisibility(req.params.id, visible);
        
        res.json({
          success: true,
          visible: result
        });
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Обновление конфигурации индикатора
    app.post('/api/indicators/:id/config', (req, res) => {
      try {
        const newConfig = req.body;
        
        if (!newConfig || typeof newConfig !== 'object') {
          return res.status(400).json({
            error: 'Необходимо передать объект конфигурации'
          });
        }
        
        const config = this.updateIndicatorConfig(req.params.id, newConfig);
        
        res.json({
          success: true,
          config
        });
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Получение визуальных данных для всех видимых индикаторов
    app.get('/api/indicators/visual-data/all', (req, res) => {
      try {
        res.json({
          visualData: this.getAllVisibleIndicatorsData()
        });
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Расчет индикатора для определенного графика
    app.post('/api/indicators/:id/calculate', async (req, res) => {
      try {
        const { symbol, interval, limit } = req.body;
        
        if (!symbol) {
          return res.status(400).json({
            error: 'Необходимо указать символ торговой пары'
          });
        }
        
        // Получаем данные графика
        const chartData = await this.core.getChartData({
          symbol,
          interval: interval || '1h',
          limit: limit || 100
        });
        
        // Рассчитываем индикатор
        const result = await this.calculateIndicator(req.params.id, chartData);
        
        res.json({
          success: true,
          indicator: req.params.id,
          result
        });
      } catch (error) {
        res.status(500).json({
          error: error.message
        });
      }
    });
  }/ modules/indicators-manager.js
// Улучшенный менеджер для управления индикаторами

const fs = require('fs');
const path = require('path');

/**
 * Менеджер для управления индикаторами
 * Отвечает за загрузку, инициализацию, расчет и управление индикаторами
 */
class IndicatorsManager {
  /**
   * Создает новый экземпляр менеджера индикаторов
   * @param {Object} config - Конфигурация менеджера
   */
  constructor(config) {
    // Конфигурация
    this.config = config || {};
    
    // Хранилище зарегистрированных индикаторов
    this.indicators = {};
    
    // Ссылка на ядро системы
    this.core = null;
    
    // Флаг инициализации
    this.isInitialized = false;
    
    // Директория с индикаторами (по умолчанию)
    this.indicatorsDir = path.join(process.cwd(), 'modules', 'indicators');
    
    // Обработчики событий
    this.eventHandlers = {};
  }
  
  /**
   * Инициализация менеджера индикаторов
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize(core) {
    try {
      this.core = core;
      
      this.log('Инициализация менеджера индикаторов...');
      
      // Создаем директорию для индикаторов, если она не существует
      await this._ensureIndicatorsDirectory();
      
      // Загружаем все доступные индикаторы
      await this.loadIndicators();
      
      // Подписываемся на события ядра
      this._registerCoreEventHandlers();
      
      this.isInitialized = true;
      this.log('Менеджер индикаторов инициализирован');
      
      // Оповещаем о готовности
      this._notifyReady();
      
      return true;
    } catch (error) {
      this.logError('Ошибка при инициализации менеджера индикаторов', error);
      throw error;
    }
  }
  
  /**
   * Создание директории для индикаторов, если она не существует
   * @returns {Promise<void>}
   * @private
   */
  async _ensureIndicatorsDirectory() {
    try {
      // Проверяем наличие директории
      const exists = await this._directoryExists(this.indicatorsDir);
      
      // Создаем директорию, если она не существует
      if (!exists) {
        this.log(`Создание директории для индикаторов: ${this.indicatorsDir}`);
        await fs.promises.mkdir(this.indicatorsDir, { recursive: true });
      }
    } catch (error) {
      this.logError(`Ошибка при создании директории для индикаторов: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Проверка существования директории
   * @param {string} dirPath - Путь к директории
   * @returns {Promise<boolean>} - true, если директория существует
   * @private
   */
  async _directoryExists(dirPath) {
    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
  
  /**
   * Регистрация обработчиков событий ядра
   * @private
   */
  _registerCoreEventHandlers() {
    if (!this.core) return;
    
    // Подписываемся на событие изменения торговой пары
    this._addEventHandler('tradingPair.changed', this._handleTradingPairChanged.bind(this));
    
    // Подписываемся на другие события при необходимости
    this._addEventHandler('chart.dataLoaded', this._handleChartDataLoaded.bind(this));
  }
  
  /**
   * Обработчик события изменения торговой пары
   * @param {Object} data - Данные события
   * @private
   */
  _handleTradingPairChanged(data) {
    this.log(`Обработка события изменения пары: ${data.newPair}`);
    // Можно добавить дополнительную логику при изменении пары
  }
  
  /**
   * Обработчик события загрузки данных графика
   * @param {Object} data - Данные события
   * @private
   */
  _handleChartDataLoaded(data) {
    this.log(`Обработка события загрузки данных графика: ${data.symbol} (${data.interval})`);
    // Можно добавить дополнительную логику при загрузке данных графика
  }
  
  /**
   * Добавление обработчика события
   * @param {string} eventType - Тип события
   * @param {Function} handler - Функция-обработчик
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
   * Оповещение о готовности менеджера индикаторов
   * @private
   */
  _notifyReady() {
    if (this.core) {
      this.core.emit('indicators.ready', { 
        count: Object.keys(this.indicators).length,
        availableIndicators: Object.keys(this.indicators)
      });
    }
  }
  
  /**
   * Загрузка всех индикаторов из директории
   * @returns {Promise<void>}
   */
  async loadIndicators() {
    this.log('Загрузка индикаторов...');
    
    try {
      // Проверяем существование директории
      const exists = await this._directoryExists(this.indicatorsDir);
      
      if (!exists) {
        this.log('Директория индикаторов не существует');
        return;
      }
      
      // Получаем список файлов в директории
      const files = await fs.promises.readdir(this.indicatorsDir);
      
      // Исключаем базовый класс и фильтруем только .js файлы
      const indicatorFiles = files.filter(file => 
        file.endsWith('.js') && file !== 'indicator-base.js'
      );
      
      this.log(`Найдено индикаторов для загрузки: ${indicatorFiles.length}`);
      
      // Загружаем каждый индикатор
      for (const file of indicatorFiles) {
        await this._loadIndicatorFromFile(file);
      }
      
      this.log(`Загружено индикаторов: ${Object.keys(this.indicators).length}`);
    } catch (error) {
      this.logError('Ошибка при загрузке индикаторов', error);
      throw error;
    }
  }
  
  /**
   * Загрузка индикатора из файла
   * @param {string} file - Имя файла индикатора
   * @returns {Promise<void>}
   * @private
   */
  async _loadIndicatorFromFile(file) {
    try {
      const filename = path.basename(file, '.js');
      const filePath = path.join(this.indicatorsDir, file);
      
      this.log(`Загрузка индикатора из файла: ${file}`);
      
      // Загружаем класс индикатора
      let IndicatorClass;
      try {
        IndicatorClass = require(filePath);
      } catch (error) {
        throw new Error(`Ошибка загрузки файла индикатора ${file}: ${error.message}`);
      }
      
      // Пропускаем не-классы
      if (typeof IndicatorClass !== 'function') {
        this.log(`Файл ${file} не содержит класса индикатора, пропускаем`);
        return;
      }
      
      // Создаем экземпляр индикатора с конфигурацией из основной конфигурации (если есть)
      const indicatorConfig = this.config[filename] || {};
      
      // Создаем экземпляр индикатора
      const indicator = new IndicatorClass(indicatorConfig);
      
      // Проверяем наличие необходимых методов
      if (typeof indicator.initialize !== 'function' || 
          typeof indicator.calculate !== 'function' ||
          typeof indicator.getVisualData !== 'function') {
        throw new Error(`Индикатор ${file} не реализует необходимый интерфейс`);
      }
      
      // Инициализируем индикатор
      await indicator.initialize(this.core);
      
      // Сохраняем индикатор в реестре
      this.indicators[indicator.id] = indicator;
      
      this.log(`Индикатор ${indicator.name} успешно загружен`);
    } catch (error) {
      this.logError(`Ошибка при загрузке индикатора ${file}`, error);
    }
  }
  
  /**
   * Получение индикатора по ID
   * @param {string} id - Идентификатор индикатора
   * @returns {Object|null} - Экземпляр индикатора или null, если не найден
   */
  getIndicator(id) {
    return this.indicators[id] || null;
  }
  
  /**
   * Получение списка всех индикаторов
   * @returns {Array<Object>} - Массив метаданных индикаторов
   */
  getAllIndicators() {
    return Object.values(this.indicators).map(indicator => indicator.getMetadata());
  }
  
  /**
   * Расчет индикатора
   * @param {string} id - Идентификатор индикатора
   * @param {Array} chartData - Данные графика для расчета
   * @returns {Promise<Object>} - Результат расчета
   * @throws {Error} Если индикатор не найден
   */
  async calculateIndicator(id, chartData) {
    const indicator = this.getIndicator(id);
    
    if (!indicator) {
      throw new Error(`Индикатор с ID ${id} не найден`);
    }
    
    try {
      return await indicator.calculate(chartData);
    } catch (error) {
      this.logError(`Ошибка при расчете индикатора ${id}`, error);
      throw new Error(`Ошибка при расчете индикатора ${id}: ${error.message}`);
    }
  }
  
  /**
   * Расчет всех индикаторов
   * @param {Array} chartData - Данные графика для расчета
   * @returns {Promise<Object>} - Объект с результатами расчетов всех индикаторов
   */
  async calculateAllIndicators(chartData) {
    this.log(`Расчет всех индикаторов для набора данных из ${chartData.length} свечей`);
    
    const results = {};
    const errors = [];
    
    // Параллельный расчет для увеличения производительности
    const calculations = Object.entries(this.indicators).map(async ([id, indicator]) => {
      try {
        results[id] = await indicator.calculate(chartData);
      } catch (error) {
        this.logError(`Ошибка при расчете индикатора ${id}`, error);
        errors.push({ id, error: error.message });
        results[id] = null;
      }
    });
    
    // Ждем завершения всех расчетов
    await Promise.all(calculations);
    
    // Если были ошибки, логируем их общим сообщением
    if (errors.length > 0) {
      this.log(`Не удалось рассчитать ${errors.length} индикаторов`);
    }
    
    return {
      results,
      errors: errors.length > 0 ? errors : null
    };
  }
  
  /**
   * Получение данных для отрисовки индикатора
   * @param {string} id - Идентификатор индикатора
   * @returns {Object} - Данные для отрисовки
   * @throws {Error} Если индикатор не найден
   */
  getIndicatorVisualData(id) {
    const indicator = this.getIndicator(id);
    
    if (!indicator) {
      throw new Error(`Индикатор с ID ${id} не найден`);
    }
    
    try {
      return indicator.getVisualData();
    } catch (error) {
      this.logError(`Ошибка при получении визуальных данных индикатора ${id}`, error);
      throw new Error(`Ошибка при получении визуальных данных индикатора ${id}: ${error.message}`);
    }
  }
  
  /**
   * Получение данных для отрисовки всех видимых индикаторов
   * @returns {Object} - Объект с данными для отрисовки всех видимых индикаторов
   */
  getAllVisibleIndicatorsData() {
    const visualData = {};
    const errors = [];
    
    Object.entries(this.indicators)
      .filter(([_, indicator]) => indicator.visible)
      .forEach(([id, indicator]) => {
        try {
          visualData[id] = indicator.getVisualData();
        } catch (error) {
          this.logError(`Ошибка при получении визуальных данных индикатора ${id}`, error);
          errors.push({ id, error: error.message });
        }
      });
    
    // Если были ошибки, логируем их общим сообщением
    if (errors.length > 0) {
      this.log(`Не удалось получить визуальные данные для ${errors.length} индикаторов`);
    }
    
    return visualData;
  }
  
  /**
   * Установка видимости индикатора
   * @param {string} id - Идентификатор индикатора
   * @param {boolean} visible - Новое состояние видимости
   * @returns {boolean} - Результирующее состояние видимости
   * @throws {Error} Если индикатор не найден
   */
  setIndicatorVisibility(id, visible) {
    const indicator = this.getIndicator(id);
    
    if (!indicator) {
      throw new Error(`Индикатор с ID ${id} не найден`);
    }
    
    return indicator.setVisible(visible);
  }
  
  /**
   * Обновление конфигурации индикатора
   * @param {string} id - Идентификатор индикатора
   * @param {Object} config - Новая конфигурация
   * @returns {Object} - Результирующая конфигурация
   * @throws {Error} Если индикатор не найден
   */
  updateIndicatorConfig(id, config) {
    const indicator = this.getIndicator(id);
    
    if (!indicator) {
      throw new Error(`Индикатор с ID ${id} не найден`);
    }
    
    try {
      return indicator.updateConfig(config);
    } catch (error) {
      this.logError(`Ошибка при обновлении конфигурации индикатора ${id}`, error);
      throw new Error(`Ошибка при обновлении конфигурации индикатора ${id}: ${error.message}`);
    }
  }
  
  /**
   * Очистка ресурсов при выгрузке менеджера
   */
  cleanup() {
    // Отписываемся от всех событий
    this._cleanupEventHandlers();
    
    // Выгружаем все индикаторы
    this._cleanupIndicators();
    
    this.indicators = {};
    this.isInitialized = false;
    
    this.log('Менеджер индикаторов выгружен');
  }
  
  /**
   * Очистка всех индикаторов
   * @private
   */
  _cleanupIndicators() {
    Object.values(this.indicators).forEach(indicator => {
      try {
        indicator.cleanup();
      } catch (error) {
        this.logError(`Ошибка при выгрузке индикатора ${indicator.id}`, error);
      }
    });
  }
  
  /**
   * Очистка обработчиков событий
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
   * Регистрация нового индикатора по классу
   * @param {Function} IndicatorClass - Класс индикатора
   * @param {Object} [config={}] - Конфигурация индикатора
   * @returns {Promise<boolean>} - Результат регистрации
   */
  async registerIndicator(IndicatorClass, config = {}) {
    try {
      if (typeof IndicatorClass !== 'function') {
        throw new Error('Передан недопустимый класс индикатора');
      }
      
      // Создаем экземпляр индикатора
      const indicator = new IndicatorClass(config);
      
      // Проверяем наличие необходимых методов
      if (typeof indicator.initialize !== 'function' || 
          typeof indicator.calculate !== 'function' ||
          typeof indicator.getVisualData !== 'function') {
        throw new Error(`Индикатор не реализует необходимый интерфейс`);
      }
      
      // Если индикатор с таким ID уже существует, выгружаем его
      if (this.indicators[indicator.id]) {
        await this._unregisterIndicator(indicator.id);
      }
      
      // Инициализируем индикатор
      await indicator.initialize(this.core);
      
      // Сохраняем индикатор в реестре
      this.indicators[indicator.id] = indicator;
      
      this.log(`Индикатор ${indicator.name} успешно зарегистрирован`);
      
      // Оповещаем о регистрации нового индикатора
      if (this.core) {
        this.core.emit('indicator.registered', {
          id: indicator.id,
          name: indicator.name
        });
      }
      
      return true;
    } catch (error) {
      this.logError('Ошибка при регистрации индикатора', error);
      return false;
    }
  }
  
  /**
   * Отмена регистрации индикатора
   * @param {string} id - Идентификатор индикатора
   * @returns {Promise<boolean>} - Результат отмены регистрации
   * @private
   */
  async _unregisterIndicator(id) {
    if (!this.indicators[id]) {
      return false;
    }
    
    try {
      // Вызываем cleanup для индикатора
      await this.indicators[id].cleanup();
      
      // Удаляем индикатор из реестра
      delete this.indicators[id];
      
      this.log(`Индикатор ${id} выгружен`);
      
      // Оповещаем о выгрузке индикатора
      if (this.core) {
        this.core.emit('indicator.unregistered', { id });
      }
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при выгрузке индикатора ${id}`, error);
      return false;
    }
  }
  
  /**
   * Регистрация API эндпоинтов для управления индикаторами
   * @param {Object} app - Экземпляр Express приложения
   */
  registerApiEndpoints(app) {
    if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
      this.logError('Невозможно зарегистрировать API эндпоинты: некорректный объект приложения Express');
      return;
    }
    
    // Получение списка индикаторов
    app.get('/api/indicators', (req, res) => {
      try {
        res.json({
          indicators: this.getAllIndicators()
        });
      } catch (error) {
        this.logError('Ошибка при обработке запроса GET /api/indicators', error);
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Получение данных индикатора
    app.get('/api/indicators/:id', (req, res) => {
      try {
        const indicator = this.getIndicator(req.params.id);
        
        if (!indicator) {
          return res.status(404).json({
            error: `Индикатор с ID ${req.params.id} не найден`
          });
        }
        
        res.json({
          indicator: indicator.getMetadata(),
          visualData: indicator.getVisualData()
        });
      } catch (error) {
        this.logError(`Ошибка при обработке запроса GET /api/indicators/${req.params.id}`, error);
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Управление видимостью индикатора
    app.post('/api/indicators/:id/visibility', (req, res) => {
      try {
        const { visible } = req.body;
        
        if (typeof visible !== 'boolean') {
          return res.status(400).json({
            error: 'Параметр visible должен быть логическим значением'
          });
        }
        
        const result = this.setIndicatorVisibility(req.params.id, visible);
        
        res.json({
          success: true,
          visible: result
        });
      } catch (error) {
        this.logError(`Ошибка при обработке запроса POST /api/indicators/${req.params.id}/visibility`, error);
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Обновление конфигурации индикатора
    app.post('/api/indicators/:id/config', (req, res) => {
      try {
        const newConfig = req.body;
        
        if (!newConfig || typeof newConfig !== 'object') {
          return res.status(400).json({
            error: 'Необходимо передать объект конфигурации'
          });
        }
        
        const config = this.updateIndicatorConfig(req.params.id, newConfig);
        
        res.json({
          success: true,
          config
        });
      } catch (error) {
        this.logError(`Ошибка при обработке запроса POST /api/indicators/${req.params.id}/config`, error);
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Получение визуальных данных для всех видимых индикаторов
    app.get('/api/indicators/visual-data/all', (req, res) => {
      try {
        res.json({
          visualData: this.getAllVisibleIndicatorsData()
        });
      } catch (error) {
        this.logError('Ошибка при обработке запроса GET /api/indicators/visual-data/all', error);
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Расчет индикатора для определенного графика
    app.post('/api/indicators/:id/calculate', async (req, res) => {
      try {
        const { symbol, interval, limit } = req.body;
        
        if (!symbol) {
          return res.status(400).json({
            error: 'Необходимо указать символ торговой пары'
          });
        }
        
        // Получаем данные графика
        const chartData = await this.core.getChartData({
          symbol,
          interval: interval || '1h',
          limit: limit || 100
        });
        
        // Рассчитываем индикатор
        const result = await this.calculateIndicator(req.params.id, chartData);
        
        res.json({
          success: true,
          indicator: req.params.id,
          result
        });
      } catch (error) {
        this.logError(`Ошибка при расчете индикатора ${req.params.id}`, error);
        res.status(500).json({
          error: error.message
        });
      }
    });
    
    // Добавлен новый эндпоинт для одновременного расчета всех индикаторов
    app.post('/api/indicators/calculate-all', async (req, res) => {
      try {
        const { symbol, interval, limit } = req.body;
        
        if (!symbol) {
          return res.status(400).json({
            error: 'Необходимо указать символ торговой пары'
          });
        }
        
        // Получаем данные графика
        const chartData = await this.core.getChartData({
          symbol,
          interval: interval || '1h',
          limit: limit || 100
        });
        
        // Рассчитываем все индикаторы
        const { results, errors } = await this.calculateAllIndicators(chartData);
        
        res.json({
          success: true,
          results,
          errors
        });
      } catch (error) {
        this.logError(`Ошибка при расчете всех индикаторов`, error);
        res.status(500).json({
          error: error.message
        });
      }
    });
  }
  
  /**
   * Вспомогательный метод для логирования
   * @param {string} message - Сообщение для логирования
   */
  log(message) {
    // Если есть логгер в ядре, используем его
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('info', `[IndicatorsManager] ${message}`);
    } else {
      console.log(`[IndicatorsManager] ${message}`);
    }
  }
  
  /**
   * Вспомогательный метод для логирования ошибок
   * @param {string} message - Сообщение об ошибке
   * @param {Error} [error] - Объект ошибки
   */
  logError(message, error) {
    // Если есть логгер в ядре, используем его
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('error', `[IndicatorsManager] ${message}`, error);
    } else {
      console.error(`[IndicatorsManager] ${message}`, error);
    }
  }
}