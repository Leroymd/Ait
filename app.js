// app.js - Основной интерфейс приложения
const axios = require('axios')
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const TradingCore = require('./core');
const fs = require('fs');
const config = require('./config');

class TradingApp {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.core = new TradingCore();
    this.loadedModules = [];
  }

  // Инициализация приложения
  async initialize() {
    console.log('Инициализация торгового приложения...');
    
    // Настройка Express
    this.setupExpress();
    
    // Настройка WebSocket
    this.setupWebSocket();
    
    // Инициализация ядра
    await this.core.initialize({
      ...config.core,
      apiKeys: {
        binance: {
          apiKey: config.connections.binance.apiKey,
          secretKey: config.connections.binance.secretKey
        }
      }
    });
    
    // Загрузка модулей
    await this.loadModules();
    
    // Регистрация API эндпоинтов модулей
    this.registerModuleApiEndpoints();
    
    console.log('Торговое приложение успешно инициализировано');
  }

  // Настройка Express
setupExpress() {
 
  // Настройка Content Security Policy
this.app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://cdn.jsdelivr.net; " +
    "connect-src 'self' wss: ws:;"
  );
  next();
});
  
  // Обработка статических файлов
  this.app.use(express.static(path.join(__dirname, 'public')));
  
  // Middleware для обработки JSON
  this.app.use(express.json());
  
  // Настройка маршрутов API
  this.setupApiRoutes();
  
  // Обработка маршрута для главной страницы
    
 this.app.get('/api/orders', async (req, res) => {
  try {
    const pair = req.query.pair || this.core.config.tradingPair;

    // Если ядро инициализировано и есть биржа — получаем реальные ордера
    let exchange = null;
if (typeof this.core.getActiveExchangeConnector === 'function') {
  exchange = this.core.getActiveExchangeConnector();
}
    if (exchange && typeof exchange.getOpenOrders === 'function') {
      const openOrders = await exchange.getOpenOrders(pair);
      return res.json({ orders: openOrders });
    }

    // Иначе — возвращаем заглушку (мок-данные)
    console.warn('Ядро не инициализировано или биржа не подключена — возвращаем тестовые ордера');
    return res.json({
      orders: [
        { id: 'mock1', price: 50200, side: 'buy', status: 'open' },
        { id: 'mock2', price: 50900, side: 'sell', status: 'open' }
      ]
    });

  } catch (error) {
    console.error('Ошибка при получении ордеров:', error);
    res.status(500).json({ error: error.message });
  }
});



    // Обработка маршрутов для дополнительных страниц
    this.app.get('/analytics', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'analytics.html'));
    });

    this.app.get('/positions', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'positions.html'));
    });

    this.app.get('/settings', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'settings.html'));
    });
  }

  // Настройка маршрутов API
  setupApiRoutes() {
	  const self = this;
    // Маршрут для получения списка доступных бирж
    this.app.get('/api/exchanges', (req, res) => {
      res.json({
        exchanges: ['binance', 'bybit']
      });
    });
    
    // Маршрут для получения списка доступных торговых пар
   this.app.get('/api/pairs', async (req, res) => {
  try {
    const exchangeName = req.query.exchange || this.core.config.exchange;
    const marketType = req.query.type || 'spot'; // 'spot' или 'futures'
    
    let exchangeConnector;
    
    // Если указана другая биржа, используем её коннектор
    if (exchangeName !== this.core.config.exchange && this.core.exchangeConnectors[exchangeName]) {
      exchangeConnector = this.core.exchangeConnectors[exchangeName];
    } else {
      exchangeConnector = this.core.getActiveExchangeConnector();
    }
    
    if (!exchangeConnector) {
      return res.status(400).json({ error: `Биржа ${exchangeName} не подключена` });
    }
    
    let pairs;
    
    // Получаем список пар в зависимости от типа рынка
    if (marketType === 'futures' && typeof exchangeConnector.getFuturesTradingPairs === 'function') {
      pairs = await exchangeConnector.getFuturesTradingPairs();
    } else {
      pairs = await exchangeConnector.getTradingPairs();
    }
    
    res.json({ pairs });
  } catch (error) {
    console.error('Ошибка при получении списка пар:', error);
    res.status(500).json({ error: error.message });
  }
});
    
    
 // Маршрут для получения данных графика
this.app.get('/api/chart', async (req, res) => {
  try {
    const { pair, interval, limit, endTime } = req.query;
    const exchange = self.core.getActiveExchangeConnector();
    
    // Параметры запроса
    const params = {
      symbol: pair || self.core.config.tradingPair,
      interval: interval || '1h',
      limit: parseInt(limit || 100, 10)
    };
    
    // Добавляем endTime, если он указан
    if (endTime) {
      params.endTime = parseInt(endTime, 10);
    }
    
    const chartData = await exchange.getChartData({
  symbol: pair || this.core.config.tradingPair,
  interval: interval || '1h',
  limit: parseInt(limit || 100, 10),
  endTime: endTime ? parseInt(endTime) : undefined,
  marketType: req.query.type || 'futures'
});
    res.json({ chartData });
  } catch (error) {
    console.error('Ошибка при получении данных графика:', error);
    res.status(500).json({ error: error.message });
  }
});
    
    // Маршрут для получения списка загруженных модулей
    this.app.get('/api/modules', (req, res) => {
      res.json({
        modules: this.loadedModules.map(moduleId => ({
          id: moduleId,
          name: this.core.getModule(moduleId).name || moduleId,
          description: this.core.getModule(moduleId).description || '',
          active: true
        }))
      });
    });
    
    // Маршрут для проверки статуса сервера
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'ok',
        core: {
          initialized: this.core.isInitialized,
          exchange: this.core.config.exchange,
          tradingPair: this.core.config.tradingPair
        }
      });
    });

    // Маршрут для получения настроек системы
    this.app.get('/api/settings', (req, res) => {
      // Возвращаем копию настроек, убрав конфиденциальные данные
      const safeConfig = { ...config };
      
      // Убираем секретные ключи
      if (safeConfig.connections?.binance?.secretKey) {
        safeConfig.connections.binance.secretKey = safeConfig.connections.binance.secretKey ? '********' : '';
      }
      
      if (safeConfig.connections?.bybit?.secretKey) {
        safeConfig.connections.bybit.secretKey = safeConfig.connections.bybit.secretKey ? '********' : '';
      }
      
      res.json(safeConfig);
    });

    // Маршрут для сохранения настроек
    this.app.post('/api/settings', (req, res) => {
      try {
        // В реальном приложении здесь должна быть логика сохранения настроек
        // Например, в файл или базу данных
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Маршрут для аналитики (заглушка, будет реализована через модули)
    this.app.get('/api/analytics/data', (req, res) => {
      // Временная заглушка для тестирования
      res.json({
        overallMetrics: {
          totalTrades: 0,
          winRate: 0,
          totalProfit: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          sharpeRatio: 0
        },
        pairPerformance: {},
        capitalCurve: [],
        recommendedPairs: [],
        recommendedTimeSlots: []
      });
    });

    // Маршрут для получения ежедневной статистики (заглушка)
    this.app.get('/api/analytics/daily-stats', (req, res) => {
      res.json([]);
    });

    // Маршрут для позиций (заглушка, будет реализована через модули)
    this.app.get('/api/positions/active', (req, res) => {
      res.json({ positions: [] });
    });

    this.app.get('/api/positions/history', (req, res) => {
      res.json({ positions: [] });
    });

    // Маршрут для балансов (заглушка)
    this.app.get('/api/balances', (req, res) => {
      res.json({ balances: {} });
    });

    // Маршрут для ордеров (заглушка)
    this.app.get('/api/orders', (req, res) => {
      res.json({ orders: [] });
    });

    // Исполнение сигналов будет обрабатываться через модуль автотрейдинга
    this.app.post('/api/execute-signal', async (req, res) => {
      try {
        const autoTraderModule = this.core.getModule('auto-trader');
        if (!autoTraderModule) {
          return res.status(404).json({ 
            success: false, 
            error: 'Модуль автотрейдинга не установлен' 
          });
        }
        
        const result = await autoTraderModule.handleNewSignal(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ 
          success: false,
          error: error.message 
        });
      }
    });
  }

  // Настройка WebSocket
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('Клиент подключился к WebSocket');
      
      // Отправляем начальное состояние
      this.sendInitialState(ws);
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Ошибка обработки WebSocket сообщения:', error);
          ws.send(JSON.stringify({ error: error.message }));
        }
      });
      
      ws.on('close', () => {
        console.log('Клиент отключился от WebSocket');
      });
    });
  }

  // Обработка сообщений WebSocket
  handleWebSocketMessage(ws, data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'SET_EXCHANGE':
        this.handleSetExchange(ws, payload);
        break;
      case 'SET_TRADING_PAIR':
        this.handleSetTradingPair(ws, payload);
        break;
      case 'SUBSCRIBE_TO_CHART':
        this.handleSubscribeToChart(ws, payload);
        break;
      case 'GET_INITIAL_STATE':
        this.sendInitialState(ws);
        break;
      // Другие типы сообщений
      default:
        ws.send(JSON.stringify({ error: `Неизвестный тип сообщения: ${type}` }));
    }
  }

  // Обработчик установки биржи
  async handleSetExchange(ws, payload) {
    try {
      const { exchange } = payload;
      await this.core.loadExchangeConnector(exchange);
      
      ws.send(JSON.stringify({
        type: 'EXCHANGE_CHANGED',
        payload: { exchange }
      }));
    } catch (error) {
      ws.send(JSON.stringify({ error: error.message }));
    }
  }

  // Обработчик установки торговой пары
  handleSetTradingPair(ws, payload) {
    try {
      const { pair } = payload;
      this.core.setTradingPair(pair);
      
      ws.send(JSON.stringify({
        type: 'TRADING_PAIR_CHANGED',
        payload: { pair }
      }));
    } catch (error) {
      ws.send(JSON.stringify({ error: error.message }));
    }
  }

  // Обработчик подписки на данные графика
  handleSubscribeToChart(ws, payload) {
    try {
      const { interval } = payload;
      const symbol = this.core.config.tradingPair;
      const exchange = this.core.getActiveExchangeConnector();
      
      // Подписываемся на обновления кандлстиков через WebSocket
      const streamName = exchange.subscribeToKlineStream(symbol, interval, (data) => {
        ws.send(JSON.stringify({
          type: 'CHART_UPDATE',
          payload: data
        }));
      });
      
      // Сохраняем информацию о подписке, чтобы можно было отписаться при закрытии соединения
      ws._chartSubscription = streamName;
      
      ws.send(JSON.stringify({
        type: 'CHART_SUBSCRIPTION_SUCCESS',
        payload: { symbol, interval }
      }));
    } catch (error) {
      ws.send(JSON.stringify({ error: error.message }));
    }
  }

  // Отправка начального состояния при подключении клиента
  sendInitialState(ws) {
    ws.send(JSON.stringify({
      type: 'INITIAL_STATE',
      payload: {
        exchange: this.core.config.exchange,
        tradingPair: this.core.config.tradingPair,
        modules: this.loadedModules.map(moduleId => ({
          id: moduleId,
          name: this.core.getModule(moduleId).name || moduleId,
          description: this.core.getModule(moduleId).description || ''
        }))
      }
    }));
  }

  // Загрузка модулей из конфигурации
  async loadModules() {
    console.log('Загрузка модулей...');
    
    // Проверяем наличие директории с модулями
    const modulesDir = path.join(__dirname, 'modules');
    if (!fs.existsSync(modulesDir)) {
      console.log('Директория с модулями не найдена, создаем...');
      fs.mkdirSync(modulesDir, { recursive: true });
    }
    async loadModules() {
  console.log('Загрузка модулей...');
  
  // Проверяем наличие директории с модулями
  const modulesDir = path.join(__dirname, 'modules');
  if (!fs.existsSync(modulesDir)) {
    console.log('Директория с модулями не найдена, создаем...');
    fs.mkdirSync(modulesDir, { recursive: true });
  }
  
  // Загружаем базовые модули сначала
  
  // 1. Загружаем менеджер индикаторов
  try {
    const IndicatorsManager = require('./modules/indicators-manager');
    const indicatorsManager = new IndicatorsManager(config.indicators || {});
    this.core.registerModule('indicators-manager', indicatorsManager);
    this.loadedModules.push('indicators-manager');
    console.log('Модуль менеджера индикаторов успешно загружен');
  } catch (error) {
    console.error('Ошибка загрузки менеджера индикаторов:', error);
  }
  
  // 2. Загружаем менеджер графика
  try {
    const ChartManager = require('./modules/chart-manager');
    const chartManager = new ChartManager(config.chart || {});
    this.core.registerModule('chart-manager', chartManager);
    this.loadedModules.push('chart-manager');
    console.log('Модуль менеджера графика успешно загружен');
  } catch (error) {
    console.error('Ошибка загрузки менеджера графика:', error);
  }
  
  // Получаем список всех модулей, которые нужно загрузить из конфигурации
  const modulesToLoad = config.modules || [];
  
  for (const moduleConfig of modulesToLoad) {
    try {
      // Пропускаем отключенные модули
      if (moduleConfig.enabled === false) {
        console.log(`Модуль ${moduleConfig.id} отключен, пропускаем загрузку`);
        continue;
      }
      
      const { id, path: modulePath, config: moduleOptions } = moduleConfig;
      
      // Путь к модулю - относительный или абсолютный
      const fullModulePath = path.isAbsolute(modulePath)
        ? modulePath
        : path.join(__dirname, modulePath);
      
      // Загружаем модуль
      const ModuleClass = require(fullModulePath);
      const moduleInstance = new ModuleClass(moduleOptions);
      
      // Регистрируем модуль в ядре
      this.core.registerModule(id, moduleInstance);
      this.loadedModules.push(id);
      
      console.log(`Модуль ${id} успешно загружен`);
    } catch (error) {
      console.error(`Ошибка загрузки модуля ${moduleConfig.id}:`, error.message);
      console.error(error.stack);
    }
  }
  
  console.log(`Загружено модулей: ${this.loadedModules.length}`);
}
    // Получаем список всех модулей, которые нужно загрузить
    const modulesToLoad = config.modules || [];
    
    for (const moduleConfig of modulesToLoad) {
      try {
        // Пропускаем отключенные модули
        if (moduleConfig.enabled === false) {
          console.log(`Модуль ${moduleConfig.id} отключен, пропускаем загрузку`);
          continue;
        }
        
        const { id, path: modulePath, config: moduleOptions } = moduleConfig;
        
        // Путь к модулю - относительный или абсолютный
        const fullModulePath = path.isAbsolute(modulePath)
          ? modulePath
          : path.join(__dirname, modulePath);
        
        // Загружаем модуль
        const ModuleClass = require(fullModulePath);
        const moduleInstance = new ModuleClass(moduleOptions);
        
        // Регистрируем модуль в ядре
        this.core.registerModule(id, moduleInstance);
        this.loadedModules.push(id);
        
        console.log(`Модуль ${id} успешно загружен`);
      } catch (error) {
        console.error(`Ошибка загрузки модуля ${moduleConfig.id}:`, error);
      }
    }
    
    console.log(`Загружено модулей: ${this.loadedModules.length}`);
  }

  // Регистрация API эндпоинтов из модулей
  registerModuleApiEndpoints() {
    console.log('Регистрация API эндпоинтов модулей...');
    
    this.loadedModules.forEach(moduleId => {
      const moduleInstance = this.core.getModule(moduleId);
      
      // Проверяем, есть ли у модуля метод для регистрации API эндпоинтов
      if (typeof moduleInstance.registerApiEndpoints === 'function') {
        try {
          moduleInstance.registerApiEndpoints(this.app);
          console.log(`API эндпоинты модуля ${moduleId} успешно зарегистрированы`);
        } catch (error) {
          console.error(`Ошибка при регистрации API эндпоинтов модуля ${moduleId}:`, error);
        }
      }
    });
  }

  // Запуск сервера
  start(port = 3000) {
    this.server.listen(port, () => {
      console.log(`Сервер запущен на порту ${port}`);
    });
  }
}

module.exports = TradingApp;