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

module.exports = AIAnalyzerModule;
