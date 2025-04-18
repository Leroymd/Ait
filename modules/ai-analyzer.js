// modules/ai-analyzer.js - Модуль AI анализа графиков

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

class AIAnalyzerModule {
  constructor(config) {
    this.name = 'AI анализатор графиков';
    this.description = 'Модуль для анализа графиков с помощью AI и генерации торговых сигналов';
    this.config = config || {};
    this.core = null;
    this.isInitialized = false;
    this.httpClient = null;
    this.browser = null;
    this.screenshotDir = path.join(process.cwd(), 'screenshots');
  }

  // Инициализация модуля
  async initialize(core) {
    console.log('Инициализация модуля AI анализатора...');
    this.core = core;
    
    // Проверка наличия необходимых параметров конфигурации
    if (!this.config.apiKey) {
      console.warn('Не указан API ключ для AI сервиса, функциональность будет ограничена');
    }
    
    if (!this.config.endpoint) {
      throw new Error('Не указан эндпоинт API для AI сервиса');
    }
    
    // Инициализация HTTP клиента
    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Создание директории для скриншотов, если она не существует
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
    
    // Инициализация браузера для создания скриншотов
    this.browser = await puppeteer.launch({
  headless: "new",  // Изменение здесь - было "true", стало "new"
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
    
    // Регистрируем обработчики событий ядра
    this.registerEventHandlers();
    
    this.isInitialized = true;
    console.log('Модуль AI анализатора успешно инициализирован');
    return true;
  }

  // Регистрация обработчиков событий ядра
  registerEventHandlers() {
    // Обработчик изменения торговой пары
    if (typeof this.onTradingPairChanged === 'function') {
      // Если торговая пара уже выбрана, вызываем обработчик
      if (this.core.config.tradingPair) {
        this.onTradingPairChanged(this.core.config.tradingPair);
      }
    }
  }

  // Обработчик изменения торговой пары
  onTradingPairChanged(pair) {
    console.log(`[AI Analyzer] Изменение торговой пары на ${pair}`);
    // Здесь можно выполнить необходимые действия при изменении пары
  }

  // Создание скриншота графика
 // Создание скриншота графика
  async createChartScreenshot(url) {
    if (!this.browser) {
      throw new Error('Браузер не инициализирован');
    }
    
    console.log(`[AI Analyzer] Создание скриншота графика: ${url}`);
    
    try {
      const page = await this.browser.newPage();
      await page.setViewport({ 
        width: this.config.screenshotWidth || 1280, 
        height: this.config.screenshotHeight || 800 
      });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      
      // Ожидаем загрузки графика с увеличенным таймаутом
      await page.waitForSelector('#trading-chart', { 
        timeout: 60000, 
        visible: true 
      }).catch(err => {
        console.warn('Не удалось найти элемент #trading-chart, попробуем использовать другой селектор');
        return page.waitForSelector('.chart-container', { timeout: 30000, visible: true });
      });
      
      // Создаем имя файла скриншота
      const timestamp = Date.now();
      const pair = this.core.config.tradingPair;
      const fileName = `${pair}_${timestamp}.png`;
      const filePath = path.join(this.screenshotDir, fileName);
      
      // Делаем скриншот элемента графика или всей страницы, если селектор не найден
      let chartElement;
      try {
        chartElement = await page.$('#trading-chart');
        if (!chartElement) {
          chartElement = await page.$('.chart-container');
        }
      } catch (err) {
        console.warn('Не удалось найти элемент графика, делаем скриншот всей страницы:', err);
      }
      
      if (chartElement) {
        await chartElement.screenshot({ path: filePath });
      } else {
        // Если не смогли найти элемент графика, делаем скриншот всей страницы
        await page.screenshot({ path: filePath });
      }
      
      await page.close();
      
      console.log(`[AI Analyzer] Скриншот создан: ${filePath}`);
      return {
        path: filePath,
        fileName: fileName
      };
    } catch (error) {
      console.error('Ошибка при создании скриншота:', error);
      throw error;
    }
  }


  // Анализ графика с помощью AI
  async analyzeChart(screenshotPath, additionalText = '') {
    if (!this.isInitialized) {
      throw new Error('Модуль не инициализирован');
    }
    
    console.log(`[AI Analyzer] Анализ графика: ${screenshotPath}`);
    
    try {
      // Проверяем существование файла
      if (!fs.existsSync(screenshotPath)) {
        throw new Error(`Файл скриншота не найден: ${screenshotPath}`);
      }
      
      // Читаем файл как бинарные данные
      const imageBuffer = fs.readFileSync(screenshotPath);
      
      // Кодируем в base64
      const base64Image = imageBuffer.toString('base64');
      
      // Формируем запрос к AI API
      const payload = {
        image: base64Image,
        text: additionalText,
        tradingPair: this.core.config.tradingPair
      };
      
      // Отправляем запрос
      const response = await this.httpClient.post('/analyze', payload);
      
      // Получаем результат анализа
      const analysisResult = response.data;
      
      console.log(`[AI Analyzer] Анализ завершен для ${this.core.config.tradingPair}`);
      
      return analysisResult;
    } catch (error) {
      console.error('Ошибка при анализе графика:', error);
      throw error;
    }
  }

  // Генерация торгового сигнала на основе анализа
  generateTradingSignal(analysisResult) {
    console.log('[AI Analyzer] Генерация торгового сигнала');
    
    try {
      // Извлекаем основные параметры из результата анализа
      const { direction, entryPoint, stopLoss, takeProfit, confidence, analysis } = analysisResult;
      
      // Проверяем наличие всех необходимых параметров
      if (!direction || !entryPoint || !stopLoss || !takeProfit) {
        throw new Error('Не все параметры сигнала получены от AI');
      }
      
      // Формируем сигнал
      const signal = {
        pair: this.core.config.tradingPair,
        direction: direction.toUpperCase(), // BUY или SELL
        entryPoint: parseFloat(entryPoint),
        stopLoss: parseFloat(stopLoss),
        takeProfit: parseFloat(takeProfit),
        confidence: parseFloat(confidence || 0),
        analysis: analysis || 'Нет дополнительного анализа',
        timestamp: Date.now()
      };
      
      console.log(`[AI Analyzer] Сгенерирован сигнал: ${JSON.stringify(signal)}`);
      
      // Публикуем сигнал через систему событий (если бы она была)
      // this.core.events.emit('trading-signal', signal);
      
      return signal;
    } catch (error) {
      console.error('Ошибка при генерации торгового сигнала:', error);
      throw error;
    }
  }

  // Получение сигнала на основе анализа графика
  async getSignalForCurrentChart() {
    console.log('[AI Analyzer] Получение сигнала для текущего графика');
    
    if (!this.core.config.tradingPair) {
      throw new Error('Не выбрана торговая пара');
    }
    
    try {
      // URL страницы с графиком
      const chartUrl = `http://localhost:${this.config.serverPort || 3000}/chart?pair=${this.core.config.tradingPair}`;
      
      // Создаем скриншот
      const screenshotInfo = await this.createChartScreenshot(chartUrl);
      
      // Анализируем с помощью AI
      const analysisResult = await this.analyzeChart(screenshotInfo.path);
      
      // Генерируем сигнал
      const signal = this.generateTradingSignal(analysisResult);
      
      return {
        signal,
        analysis: analysisResult,
        screenshot: screenshotInfo.fileName
      };
    } catch (error) {
      console.error('Ошибка при получении сигнала:', error);
      throw error;
    }
  }

  // Очистка ресурсов при выгрузке модуля
  async cleanup() {
    console.log('[AI Analyzer] Очистка ресурсов модуля...');
    
    // Закрываем браузер, если он был открыт
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.isInitialized = false;
    console.log('[AI Analyzer] Модуль успешно выгружен');
  }

  // Предоставление метаданных модуля для API
  getMetadata() {
    return {
      id: 'ai-analyzer',
      name: this.name,
      description: this.description,
      version: '1.0.0',
      capabilities: [
        'chart_analysis',
        'trading_signals',
        'screenshot_generation'
      ]
    };
  }

  // Добавление эндпоинтов в Express приложение
  registerApiEndpoints(app) {
	app.post('/api/modules/ai-analyzer/analyze', async (req, res) => {
  console.log('[AI-Analyzer] Получен запрос на анализ');
  try {
    // Проверяем, передана ли торговая пара в запросе
    const pair = req.body.pair;
    
    // Если пара не выбрана в ядре, но передана в запросе, устанавливаем её
    if (!this.core.config.tradingPair && pair) {
      this.core.setTradingPair(pair);
      console.log(`[AI-Analyzer] Установлена торговая пара из запроса: ${pair}`);
    } else if (!this.core.config.tradingPair) {
      // Устанавливаем пару по умолчанию из конфигурации
      const defaultPair = this.config.defaultPair || 'BTCUSDT';
      this.core.setTradingPair(defaultPair);
      console.log(`[AI-Analyzer] Установлена пара по умолчанию: ${defaultPair}`);
    }
    
    // Логируем обновленное состояние модуля
    console.log('[AI-Analyzer] Обновленный статус модуля:', {
      isInitialized: this.isInitialized,
      hasBrowser: !!this.browser,
      tradingPair: this.core.config.tradingPair
    });
    
    const result = await this.getSignalForCurrentChart();
    console.log('[AI-Analyzer] Анализ выполнен успешно');
    res.json(result);
  } catch (error) {
    console.error('[AI-Analyzer] Ошибка при анализе:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
});  
    // Эндпоинт для запроса анализа текущего графика
    app.post('/api/modules/ai-analyzer/analyze', async (req, res) => {
  console.log('[AI-Analyzer] Получен запрос на анализ');
  try {
    // Логируем состояние модуля
    console.log('[AI-Analyzer] Статус модуля:', {
      isInitialized: this.isInitialized,
      hasBrowser: !!this.browser,
      tradingPair: this.core.config.tradingPair
    });
    
    const result = await this.getSignalForCurrentChart();
    console.log('[AI-Analyzer] Анализ выполнен успешно');
    res.json(result);
  } catch (error) {
    console.error('[AI-Analyzer] Ошибка при анализе:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
});
    
    // Эндпоинт для получения метаданных модуля
    app.get('/api/modules/ai-analyzer/metadata', (req, res) => {
      res.json(this.getMetadata());
    });
    
    // Эндпоинт для получения скриншота
    app.get('/api/modules/ai-analyzer/screenshots/:fileName', (req, res) => {
      const filePath = path.join(this.screenshotDir, req.params.fileName);
      
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: 'Файл не найден' });
      }
    });
  }
}
// modules/ai-analyzer.js - Улучшенный модуль AI анализа графиков

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * Модуль AI анализа графиков
 * Отвечает за анализ графиков с помощью AI и генерацию торговых сигналов
 */
class AIAnalyzerModule {
  /**
   * Создает новый экземпляр модуля AI анализатора
   * @param {Object} config - Конфигурация модуля
   */
  constructor(config) {
    // Метаданные модуля
    this.name = 'AI анализатор графиков';
    this.description = 'Модуль для анализа графиков с помощью AI и генерации торговых сигналов';
    
    // Конфигурация
    this.config = this._initConfig(config || {});
    
    // Состояние модуля
    this.core = null;
    this.isInitialized = false;
    this.activeJobs = new Map(); // Отслеживание активных задач анализа
    
    // HTTP клиент для взаимодействия с AI API
    this.httpClient = null;
    
    // Браузер для создания скриншотов
    this.browser = null;
    
    // Директория для хранения скриншотов
    this.screenshotDir = path.join(process.cwd(), 'screenshots');
    
    // Обработчики событий
    this.eventHandlers = {};
  }

  /**
   * Инициализирует конфигурацию по умолчанию
   * @param {Object} config - Конфигурация из конструктора
   * @returns {Object} - Инициализированная конфигурация
   * @private
   */
  _initConfig(config) {
    return {
      // Конфигурация API
      apiKey: config.apiKey || '',
      endpoint: config.endpoint || 'https://api.example.com/analyze',
      model: config.model || 'default-model',
      
      // Настройки скриншотов
      screenshotWidth: config.screenshotWidth || 1280,
      screenshotHeight: config.screenshotHeight || 800,
      screenshotQuality: config.screenshotQuality || 80,
      
      // Повторные попытки и тайм-ауты
      maxRetries: config.maxRetries || 3,
      requestTimeout: config.requestTimeout || 30000, // 30 секунд
      
      // Другие настройки
      serverPort: config.serverPort || 3000,
      defaultPair: config.defaultPair || 'BTCUSDT',
      includeIndicatorsInScreenshot: config.includeIndicatorsInScreenshot !== false,
      indicatorsToInclude: config.indicatorsToInclude || ['rsi', 'macd', 'volume'],
      
      // Объединяем с остальными настройками
      ...config
    };
  }

  /**
   * Инициализация модуля
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   * @throws {Error} Если возникла ошибка при инициализации
   */
  async initialize(core) {
    try {
      this.log('Инициализация модуля AI анализатора...');
      this.core = core;
      
      // Проверка наличия необходимых параметров конфигурации
      this._validateConfig();
      
      // Инициализация HTTP клиента
      this._initHttpClient();
      
      // Создание директории для скриншотов
      await this._ensureScreenshotDirectory();
      
      // Инициализация браузера для создания скриншотов
      await this._initBrowser();
      
      // Регистрируем обработчики событий ядра
      this._registerEventHandlers();
      
      this.isInitialized = true;
      this.log('Модуль AI анализатора успешно инициализирован');
      
      return true;
    } catch (error) {
      this.logError('Ошибка инициализации модуля AI анализатора', error);
      throw error;
    }
  }

  /**
   * Проверяет корректность конфигурации
   * @private
   * @throws {Error} Если конфигурация некорректна
   */
  _validateConfig() {
    if (!this.config.endpoint) {
      throw new Error('Не указан эндпоинт API для AI сервиса');
    }
    
    if (!this.config.apiKey) {
      this.log('Предупреждение: Не указан API ключ для AI сервиса, функциональность будет ограничена', 'warn');
    }
  }

  /**
   * Инициализирует HTTP клиент для взаимодействия с AI API
   * @private
   */
  _initHttpClient() {
    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: this.config.requestTimeout
    });
    
    // Добавляем перехватчик для обработки ошибок
    this.httpClient.interceptors.response.use(
      response => response,
      error => {
        // Логируем ошибку и добавляем контекст
        if (error.response) {
          // Ошибка от сервера
          this.logError(`Ошибка API (${error.response.status}): ${error.response.data.message || error.message}`);
        } else if (error.request) {
          // Нет ответа от сервера
          this.logError(`Нет ответа от AI API: ${error.message}`);
        } else {
          // Ошибка при формировании запроса
          this.logError(`Ошибка запроса к AI API: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Создает директорию для скриншотов, если она не существует
   * @returns {Promise<void>}
   * @private
   */
  async _ensureScreenshotDirectory() {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
      this.log(`Директория для скриншотов создана: ${this.screenshotDir}`);
    } catch (error) {
      // Игнорируем ошибку, если директория уже существует
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Инициализирует браузер для создания скриншотов
   * @returns {Promise<void>}
   * @private
   */
  async _initBrowser() {
    try {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      this.log('Браузер для создания скриншотов инициализирован');
    } catch (error) {
      this.logError('Ошибка при инициализации браузера', error);
      throw new Error(`Не удалось инициализировать браузер: ${error.message}`);
    }
  }

  /**
   * Регистрирует обработчики событий ядра
   * @private
   */
  _registerEventHandlers() {
    if (!this.core) return;
    
    // Обработчик изменения торговой пары
    this._addEventHandler('tradingPair.changed', this._onTradingPairChanged.bind(this));
    
    // Обработчик завершения работы системы
    this._addEventHandler('system.shutdown', this._onSystemShutdown.bind(this));
  }

  /**
   * Добавляет обработчик события
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
   * Обработчик изменения торговой пары
   * @param {Object} data - Данные события
   * @private
   */
  _onTradingPairChanged(data) {
    this.log(`Изменение торговой пары на ${data.newPair}`);
    // Здесь можно выполнить необходимые действия при изменении пары
  }

  /**
   * Обработчик завершения работы системы
   * @private
   */
  _onSystemShutdown() {
    this.log('Получено событие завершения работы системы');
    this.cleanup()
      .then(() => this.log('Выгрузка модуля AI анализатора завершена'))
      .catch(error => this.logError('Ошибка при выгрузке модуля AI анализатора', error));
  }

  /**
   * Создание скриншота графика
   * @param {string} url - URL страницы с графиком
   * @returns {Promise<Object>} - Информация о скриншоте (путь и имя файла)
   * @throws {Error} Если возникла ошибка при создании скриншота
   */
  async createChartScreenshot(url) {
    if (!this.browser) {
      throw new Error('Браузер не инициализирован');
    }
    
    this.log(`Создание скриншота графика: ${url}`);
    
    let page = null;
    
    try {
      page = await this.browser.newPage();
      
      // Устанавливаем размер viewport
      await page.setViewport({ 
        width: this.config.screenshotWidth, 
        height: this.config.screenshotHeight 
      });
      
      // Переходим на страницу с графиком
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
      });
      
      // Ожидаем загрузки графика с увеличенным таймаутом
      let chartElement = null;
      
      try {
        await page.waitForSelector('#trading-chart', { 
          timeout: 60000, 
          visible: true 
        });
        
        chartElement = await page.$('#trading-chart');
      } catch (error) {
        this.log('Не удалось найти элемент #trading-chart, попробуем использовать другой селектор');
        
        try {
          await page.waitForSelector('.chart-container', { 
            timeout: 30000, 
            visible: true 
          });
          
          chartElement = await page.$('.chart-container');
        } catch (innerError) {
          this.log('Не удалось найти элемент .chart-container, будет сделан скриншот всей страницы');
        }
      }
      
      // Создаем имя файла скриншота
      const timestamp = Date.now();
      const pair = this.core.config.tradingPair || 'unknown';
      const fileName = `${pair}_${timestamp}.png`;
      const filePath = path.join(this.screenshotDir, fileName);
      
      // Делаем скриншот элемента графика или всей страницы
      if (chartElement) {
        await chartElement.screenshot({ 
          path: filePath,
          quality: this.config.screenshotQuality
        });
      } else {
        // Если не смогли найти элемент графика, делаем скриншот всей страницы
        await page.screenshot({ 
          path: filePath,
          quality: this.config.screenshotQuality
        });
      }
      
      this.log(`Скриншот создан: ${filePath}`);
      
      return {
        path: filePath,
        fileName: fileName
      };
    } catch (error) {
      this.logError('Ошибка при создании скриншота', error);
      throw new Error(`Не удалось создать скриншот: ${error.message}`);
    } finally {
      // Обязательно закрываем страницу в любом случае
      if (page) {
        await page.close().catch(e => this.logError('Ошибка при закрытии страницы браузера', e));
      }
    }
  }

  /**
   * Анализ графика с помощью AI
   * @param {string} screenshotPath - Путь к файлу скриншота
   * @param {string} [additionalText=''] - Дополнительный текст для анализа
   * @returns {Promise<Object>} - Результат анализа
   * @throws {Error} Если возникла ошибка при анализе
   */
  async analyzeChart(screenshotPath, additionalText = '') {
    if (!this.isInitialized) {
      throw new Error('Модуль не инициализирован');
    }
    
    this.log(`Анализ графика: ${screenshotPath}`);
    
    try {
      // Проверяем существование файла
      try {
        await fs.access(screenshotPath);
      } catch (error) {
        throw new Error(`Файл скриншота не найден: ${screenshotPath}`);
      }
      
      // Читаем файл как бинарные данные
      const imageBuffer = await fs.readFile(screenshotPath);
      
      // Кодируем в base64
      const base64Image = imageBuffer.toString('base64');
      
      // Формируем запрос к AI API с учетом повторных попыток
      return await this._makeApiRequestWithRetry(async () => {
        const payload = {
          image: base64Image,
          text: additionalText,
          tradingPair: this.core.config.tradingPair,
          indicators: this.config.includeIndicatorsInScreenshot ? this.config.indicatorsToInclude : []
        };
        
        const response = await this.httpClient.post('/analyze', payload);
        return response.data;
      });
    } catch (error) {
      this.logError('Ошибка при анализе графика', error);
      throw new Error(`Не удалось проанализировать график: ${error.message}`);
    }
  }

  /**
   * Выполнение запроса с повторными попытками в случае ошибки
   * @param {Function} requestFn - Функция, выполняющая запрос
   * @returns {Promise<Object>} - Результат запроса
   * @private
   */
  async _makeApiRequestWithRetry(requestFn) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        
        // Проверяем, имеет ли смысл повторять запрос
        const shouldRetry = this._shouldRetryRequest(error, attempt);
        
        if (!shouldRetry) {
          break;
        }
        
        // Ждем перед следующей попыткой с экспоненциальной задержкой
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.log(`Повторная попытка ${attempt}/${this.config.maxRetries} через ${delay}мс`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Превышено максимальное количество попыток');
  }

  /**
   * Проверяет, нужно ли повторить запрос
   * @param {Error} error - Объект ошибки
   * @param {number} attempt - Номер текущей попытки
   * @returns {boolean} - true, если нужно повторить запрос
   * @private
   */
  _shouldRetryRequest(error, attempt) {
    // Не повторяем запрос при последней попытке
    if (attempt >= this.config.maxRetries) {
      return false;
    }
    
    // Повторяем запрос при ошибках сети и временных ошибках сервера
    if (!error.response) {
      // Ошибка сети
      return true;
    }
    
    // Повторяем только при определенных кодах ошибок (5xx, 429)
    const statusCode = error.response.status;
    return statusCode >= 500 || statusCode === 429;
  }

  /**
   * Генерация торгового сигнала на основе анализа
   * @param {Object} analysisResult - Результат анализа
   * @returns {Object} - Торговый сигнал
   * @throws {Error} Если не удалось сгенерировать сигнал
   */
  generateTradingSignal(analysisResult) {
    this.log('Генерация торгового сигнала');
    
    try {
      // Извлекаем основные параметры из результата анализа
      const { direction, entryPoint, stopLoss, takeProfit, confidence, analysis } = analysisResult;
      
      // Проверяем наличие всех необходимых параметров
      if (!direction || !entryPoint || !stopLoss || !takeProfit) {
        throw new Error('Не все параметры сигнала получены от AI');
      }
      
      // Формируем сигнал
      const signal = {
        pair: this.core.config.tradingPair,
        direction: direction.toUpperCase(), // BUY или SELL
        entryPoint: parseFloat(entryPoint),
        stopLoss: parseFloat(stopLoss),
        takeProfit: parseFloat(takeProfit),
        confidence: parseFloat(confidence || 0),
        analysis: analysis || 'Нет дополнительного анализа',
        timestamp: Date.now(),
        source: 'ai-analyzer'
      };
      
      this.log(`Сгенерирован сигнал: ${JSON.stringify(signal)}`);
      
      // Публикуем сигнал через систему событий
      if (this.core) {
        this.core.emit('trading-signal', { signal });
      }
      
      return signal;
    } catch (error) {
      this.logError('Ошибка при генерации торгового сигнала', error);
      throw error;
    }
  }

  /**
   * Получение сигнала на основе анализа графика для текущей торговой пары
   * @param {Object} [options={}] - Дополнительные опции
   * @returns {Promise<Object>} - Объект с сигналом, анализом и информацией о скриншоте
   * @throws {Error} Если возникла ошибка
   */
  async getSignalForCurrentChart(options = {}) {
    this.log('Получение сигнала для текущего графика');
    
    // Генерируем уникальный ID для этой задачи
    const jobId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Проверяем наличие выбранной торговой пары
    if (!this.core.config.tradingPair) {
      throw new Error('Не выбрана торговая пара');
    }
    
    try {
      // Добавляем задачу в список активных
      this.activeJobs.set(jobId, {
        status: 'running',
        startTime: Date.now(),
        pair: this.core.config.tradingPair
      });
      
      // URL страницы с графиком
      const chartUrl = `http://localhost:${this.config.serverPort || 3000}/chart?pair=${this.core.config.tradingPair}`;
      
      // Создаем скриншот
      const screenshotInfo = await this.createChartScreenshot(chartUrl);
      
      // Формируем дополнительный текст с описанием стратегии (если предоставлено)
      const additionalText = options.strategy ? 
        `Анализируйте график с точки зрения стратегии: ${options.strategy}` : '';
      
      // Анализируем с помощью AI
      const analysisResult = await this.analyzeChart(screenshotInfo.path, additionalText);
      
      // Генерируем сигнал
      const signal = this.generateTradingSignal(analysisResult);
      
      // Обновляем статус задачи
      this.activeJobs.set(jobId, {
        status: 'completed',
        startTime: this.activeJobs.get(jobId).startTime,
        endTime: Date.now(),
        pair: this.core.config.tradingPair,
        result: {
          signal: signal.direction,
          confidence: signal.confidence
        }
      });
      
      return {
        jobId,
        signal,
        analysis: analysisResult,
        screenshot: screenshotInfo.fileName
      };
    } catch (error) {
      // Обновляем статус задачи в случае ошибки
      if (this.activeJobs.has(jobId)) {
        this.activeJobs.set(jobId, {
          status: 'failed',
          startTime: this.activeJobs.get(jobId).startTime,
          endTime: Date.now(),
          pair: this.core.config.tradingPair,
          error: error.message
        });
      }
      
      this.logError('Ошибка при получении сигнала', error);
      throw error;
    } finally {
      // Удаляем задачу из списка активных через некоторое время
      setTimeout(() => {
        this.activeJobs.delete(jobId);
      }, 3600000); // 1 час
    }
  }

  /**
   * Запуск автоматического анализа с заданным интервалом
   * @param {Object} options - Опции автоматического анализа
   * @param {string[]} options.pairs - Массив торговых пар для анализа
   * @param {string} options.interval - Интервал между анализами (например, '1h', '30m')
   * @param {string} [options.strategy] - Стратегия для анализа
   * @param {boolean} [options.autoTrade=false] - Автоматически исполнять сигналы
   * @returns {Object} - Информация о запущенном автоматическом анализе
   */
  startAutomatedAnalysis(options) {
    if (!options || !options.pairs || !options.pairs.length || !options.interval) {
      throw new Error('Необходимо указать массив торговых пар и интервал');
    }
    
    // Генерируем уникальный ID для задачи автоматического анализа
    const automationId = `auto_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Преобразуем интервал в миллисекунды
    const intervalMs = this._parseIntervalToMs(options.interval);
    
    if (!intervalMs) {
      throw new Error(`Некорректный формат интервала: ${options.interval}`);
    }
    
    // Создаем функцию для выполнения анализа
    const runAnalysis = async () => {
      // Проходим по всем парам
      for (const pair of options.pairs) {
        try {
          // Устанавливаем текущую пару
          this.core.setTradingPair(pair);
          
          // Небольшая задержка для обновления графика
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Получаем сигнал
          const result = await this.getSignalForCurrentChart({
            strategy: options.strategy
          });
          
          this.log(`Автоматический анализ пары ${pair} завершен: ${result.signal.direction} (${result.signal.confidence})`);
          
          // Если включена автоторговля, исполняем сигнал
          if (options.autoTrade) {
            await this._executeSignal(result.signal);
          }
        } catch (error) {
          this.logError(`Ошибка при автоматическом анализе пары ${pair}`, error);
        }
      }
    };
    
    // Запускаем первый анализ
    runAnalysis();
    
    // Создаем интервал для регулярного анализа
    const intervalId = setInterval(runAnalysis, intervalMs);
    
    // Сохраняем информацию о задаче
    const automationInfo = {
      id: automationId,
      pairs: [...options.pairs],
      interval: options.interval,
      intervalMs,
      strategy: options.strategy,
      autoTrade: options.autoTrade || false,
      startTime: Date.now(),
      intervalId
    };
    
    // Сохраняем в глобальной переменной или в хранилище
    if (!this.automatedAnalysisTasks) {
      this.automatedAnalysisTasks = new Map();
    }
    
    this.automatedAnalysisTasks.set(automationId, automationInfo);
    
    this.log(`Запущен автоматический анализ для ${options.pairs.length} пар с интервалом ${options.interval}`);
    
    // Публикуем событие о запуске автоматического анализа
    if (this.core) {
      this.core.emit('ai-analysis.automated.started', {
        id: automationId,
        pairs: options.pairs,
        interval: options.interval,
        autoTrade: options.autoTrade || false
      });
    }
    
    return {
      id: automationId,
      pairs: options.pairs,
      interval: options.interval,
      startTime: automationInfo.startTime
    };
  }

  /**
   * Остановка автоматического анализа
   * @param {string} automationId - ID задачи автоматического анализа
   * @returns {boolean} - Результат остановки
   */
  stopAutomatedAnalysis(automationId) {
    if (!this.automatedAnalysisTasks || !this.automatedAnalysisTasks.has(automationId)) {
      return false;
    }
    
    const task = this.automatedAnalysisTasks.get(automationId);
    
    // Останавливаем интервал
    clearInterval(task.intervalId);
    
    // Удаляем задачу из списка
    this.automatedAnalysisTasks.delete(automationId);
    
    this.log(`Остановлен автоматический анализ ${automationId}`);
    
    // Публикуем событие об остановке автоматического анализа
    if (this.core) {
      this.core.emit('ai-analysis.automated.stopped', {
        id: automationId,
        pairs: task.pairs,
        runTime: Date.now() - task.startTime
      });
    }
    
    return true;
  }

  /**
   * Получение списка активных задач автоматического анализа
   * @returns {Array} - Список активных задач
   */
  getAutomatedAnalysisTasks() {
    if (!this.automatedAnalysisTasks) {
      return [];
    }
    
    return Array.from(this.automatedAnalysisTasks.values()).map(task => ({
      id: task.id,
      pairs: task.pairs,
      interval: task.interval,
      strategy: task.strategy,
      autoTrade: task.autoTrade,
      startTime: task.startTime,
      runTime: Date.now() - task.startTime
    }));
  }

  /**
   * Выполнение сигнала через модуль автотрейдинга
   * @param {Object} signal - Торговый сигнал
   * @returns {Promise<Object>} - Результат выполнения сигнала
   * @private
   */
  async _executeSignal(signal) {
    if (!this.core) {
      throw new Error('Ядро не инициализировано');
    }
    
    // Получаем модуль автотрейдинга
    const autoTrader = this.core.getModule('auto-trader');
    
    if (!autoTrader) {
      throw new Error('Модуль автотрейдинга не найден');
    }
    
    this.log(`Выполнение сигнала для пары ${signal.pair}: ${signal.direction}`);
    
    try {
      // Вызываем метод обработки сигнала
      const result = await autoTrader.handleNewSignal(signal);
      
      if (!result.success) {
        throw new Error(result.error || 'Неизвестная ошибка при выполнении сигнала');
      }
      
      this.log(`Сигнал успешно выполнен: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logError('Ошибка при выполнении сигнала', error);
      throw error;
    }
  }

  /**
   * Преобразует строковое представление интервала в миллисекунды
   * @param {string} interval - Интервал в формате '1h', '30m', '1d' и т.д.
   * @returns {number|null} - Интервал в миллисекундах или null при ошибке
   * @private
   */
  _parseIntervalToMs(interval) {
    const match = interval.match(/^(\d+)([mhdw])$/);
    
    if (!match) {
      return null;
    }
    
    const [, value, unit] = match;
    const numValue = parseInt(value, 10);
    
    switch (unit) {
      case 'm': // минуты
        return numValue * 60 * 1000;
      case 'h': // часы
        return numValue * 60 * 60 * 1000;
      case 'd': // дни
        return numValue * 24 * 60 * 60 * 1000;
      case 'w': // недели
        return numValue * 7 * 24 * 60 * 60 * 1000;
      default:
        return null;
    }
  }

  /**
   * Очистка ресурсов при выгрузке модуля
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.log('Очистка ресурсов модуля AI анализатора...');
    
    // Остановка всех задач автоматического анализа
    if (this.automatedAnalysisTasks) {
      for (const [id] of this.automatedAnalysisTasks) {
        this.stopAutomatedAnalysis(id);
      }
    }
    
    // Отписка от всех событий
    this._cleanupEventHandlers();
    
    // Закрытие браузера
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
      } catch (error) {
        this.logError('Ошибка при закрытии браузера', error);
      }
    }
    
    this.isInitialized = false;
    this.log('Модуль AI анализатора успешно выгружен');
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
   * Предоставление метаданных модуля для API
   * @returns {Object} - Метаданные модуля
   */
  getMetadata() {
    return {
      id: 'ai-analyzer',
      name: this.name,
      description: this.description,
      version: '1.0.0',
      capabilities: [
        'chart_analysis',
        'trading_signals',
        'screenshot_generation',
        'automated_analysis'
      ],
      activeJobs: this.activeJobs.size,
      automatedTasks: this.automatedAnalysisTasks ? this.automatedAnalysisTasks.size : 0
    };
  }

  /**
   * Регистрация API эндпоинтов
   * @param {Object} app - Экземпляр Express приложения
   */
  registerApiEndpoints(app) {
    if (!app) return;
    
    // Эндпоинт для запроса анализа текущего графика
    app.post('/api/modules/ai-analyzer/analyze', async (req, res) => {
      this.log('Получен запрос на анализ');
      
      try {
        // Проверяем, передана ли торговая пара в запросе
        const pair = req.body.pair;
        
        // Если пара не выбрана в ядре, но передана в запросе, устанавливаем её
        if (!this.core.config.tradingPair && pair) {
          this.core.setTradingPair(pair);
          this.log(`Установлена торговая пара из запроса: ${pair}`);
        } else if (!this.core.config.tradingPair) {
          // Устанавливаем пару по умолчанию из конфигурации
          const defaultPair = this.config.defaultPair || 'BTCUSDT';
          this.core.setTradingPair(defaultPair);
          this.log(`Установлена пара по умолчанию: ${defaultPair}`);
        }
        
        // Логируем обновленное состояние модуля
        this.log('Обновленный статус модуля: ' + JSON.stringify({
          isInitialized: this.isInitialized,
          hasBrowser: !!this.browser,
          tradingPair: this.core.config.tradingPair
        }));
        
        // Выполняем анализ с учетом стратегии
        const result = await this.getSignalForCurrentChart({
          strategy: req.body.strategy
        });
        
        this.log('Анализ выполнен успешно');
        res.json(result);
      } catch (error) {
        this.logError('Ошибка при анализе', error);
        res.status(500).json({ 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });
    
    // Эндпоинт для запуска автоматического анализа
    app.post('/api/modules/ai-analyzer/start-auto', async (req, res) => {
      this.log('Получен запрос на запуск автоматического анализа');
      
      try {
        const { pairs, interval, strategy, autoTrade } = req.body;
        
        if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
          return res.status(400).json({
            error: 'Необходимо указать массив торговых пар'
          });
        }
        
        if (!interval) {
          return res.status(400).json({
            error: 'Необходимо указать интервал'
          });
        }
        
        const result = this.startAutomatedAnalysis({
          pairs,
          interval,
          strategy,
          autoTrade: !!autoTrade
        });
        
        this.log('Автоматический анализ запущен');
        res.json({
          success: true,
          automation: result
        });
      } catch (error) {
        this.logError('Ошибка при запуске автоматического анализа', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для остановки автоматического анализа
    app.post('/api/modules/ai-analyzer/stop-auto/:id', async (req, res) => {
      try {
        const id = req.params.id;
        
        if (!id) {
          return res.status(400).json({
            error: 'Необходимо указать ID задачи автоматического анализа'
          });
        }
        
        const result = this.stopAutomatedAnalysis(id);
        
        if (!result) {
          return res.status(404).json({
            error: 'Задача автоматического анализа не найдена'
          });
        }
        
        this.log(`Автоматический анализ ${id} остановлен`);
        res.json({
          success: true,
          id
        });
      } catch (error) {
        this.logError('Ошибка при остановке автоматического анализа', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения списка задач автоматического анализа
    app.get('/api/modules/ai-analyzer/auto-tasks', (req, res) => {
      try {
        const tasks = this.getAutomatedAnalysisTasks();
        
        res.json({
          success: true,
          tasks
        });
      } catch (error) {
        this.logError('Ошибка при получении списка задач автоматического анализа', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения метаданных модуля
    app.get('/api/modules/ai-analyzer/metadata', (req, res) => {
      try {
        res.json(this.getMetadata());
      } catch (error) {
        this.logError('Ошибка при получении метаданных', error);
        res.status(500).json({ 
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения скриншота
    app.get('/api/modules/ai-analyzer/screenshots/:fileName', (req, res) => {
      const filePath = path.join(this.screenshotDir, req.params.fileName);
      
      fs.access(filePath)
        .then(() => {
          res.sendFile(filePath);
        })
        .catch(() => {
          res.status(404).json({ error: 'Файл не найден' });
        });
    });
    
    // Эндпоинт для получения списка активных задач анализа
    app.get('/api/modules/ai-analyzer/jobs', (req, res) => {
      try {
        const jobs = Array.from(this.activeJobs.entries()).map(([id, job]) => ({
          id,
          ...job
        }));
        
        res.json({
          success: true,
          jobs
        });
      } catch (error) {
        this.logError('Ошибка при получении списка активных задач', error);
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
      this.core.logger('info', `[AI-Analyzer] ${message}`);
    } else {
      console.log(`[AI-Analyzer] ${message}`);
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
      this.core.logger('error', `[AI-Analyzer] ${message}`, error);
    } else {
      console.error(`[AI-Analyzer] ${message}`, error);
    }
  }
}

module.exports = AIAnalyzerModule;