// modules/auto-trader.js - Полноценный модуль автотрейдинга

const fs = require('fs');
const path = require('path');

class AutoTraderModule {
  constructor(config) {
    this.name = 'Автотрейдер';
    this.description = 'Модуль для автоматического исполнения торговых сигналов';
    this.config = config || {};
    this.core = null;
    this.activeSignals = [];
    this.activePositions = [];
    this.positionHistory = [];
    this.isInitialized = false;
    this.dataDir = path.join(process.cwd(), 'data');
    this.positionsFile = path.join(this.dataDir, 'positions.json');
    this.historyFile = path.join(this.dataDir, 'trade_history.json');
    this.lastCheck = 0;
    this.checkInterval = 60000; // 1 минута
  }

  // Инициализация модуля
  async initialize(core) {
    console.log('Инициализация модуля автотрейдинга...');
    this.core = core;
    
    // Проверка наличия необходимых API ключей
    const exchange = this.core.config.exchange;
    if (!this.core.config.apiKeys[exchange] || 
        !this.core.config.apiKeys[exchange].apiKey || 
        !this.core.config.apiKeys[exchange].secretKey) {
      console.warn(`Не указаны API ключи для биржи ${exchange}, торговля будет работать в режиме симуляции`);
    }
    
    // Создаем директорию для данных, если она не существует
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Загружаем сохраненные позиции и историю
    this.loadSavedData();
    
    // Регистрируем обработчики событий
    this.registerEventHandlers();
    
    // Запускаем интервал проверки позиций
    this.startPositionChecking();
    
    this.isInitialized = true;
    console.log('Модуль автотрейдинга успешно инициализирован');
    return true;
  }

  // Загрузка сохраненных данных
  loadSavedData() {
    try {
      // Загружаем активные позиции
      if (fs.existsSync(this.positionsFile)) {
        const data = fs.readFileSync(this.positionsFile, 'utf8');
        this.activePositions = JSON.parse(data);
        console.log(`Загружено ${this.activePositions.length} активных позиций`);
      }
      
      // Загружаем историю торговли
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        this.positionHistory = JSON.parse(data);
        console.log(`Загружено ${this.positionHistory.length} исторических позиций`);
      }
    } catch (error) {
      console.error('Ошибка при загрузке сохраненных данных:', error);
      // Инициализируем пустыми массивами на случай ошибки
      this.activePositions = [];
      this.positionHistory = [];
    }
  }

  // Сохранение данных в файлы
  saveData() {
    try {
      // Сохраняем активные позиции
      fs.writeFileSync(this.positionsFile, JSON.stringify(this.activePositions, null, 2));
      
      // Сохраняем историю торговли
      fs.writeFileSync(this.historyFile, JSON.stringify(this.positionHistory, null, 2));
    } catch (error) {
      console.error('Ошибка при сохранении данных:', error);
    }
  }

  // Регистрация обработчиков событий
  registerEventHandlers() {
    console.log('Регистрация обработчиков событий автотрейдинга');
    // Поскольку прямой системы событий нет, мы будем
    // полагаться на API вызовы в app.js
  }

  // Запуск проверки позиций по интервалу
  startPositionChecking() {
    // Запускаем первую проверку
    this.checkOpenPositions();
    
    // Запускаем интервал для проверки позиций
    setInterval(() => {
      this.checkOpenPositions();
    }, this.checkInterval);
  }

  // Обработка нового торгового сигнала
  async handleNewSignal(signal) {
    console.log('Получен новый торговый сигнал:', signal);
    
    // Проверяем настройки риск-менеджмента
    const riskSettings = this.config.riskManagement || this.core.config.trading || {};
    const maxConcurrentTrades = riskSettings.maxConcurrentTrades || 3;
    
    // Проверяем, не превышен ли лимит одновременных сделок
    const openPositions = this.getOpenPositions();
    if (openPositions.length >= maxConcurrentTrades) {
      console.warn('Превышен лимит одновременных сделок');
      return {
        success: false,
        error: 'Превышен лимит одновременных сделок'
      };
    }
    
    // Проверяем, нет ли уже открытой позиции по этой паре
    const existingPosition = openPositions.find(p => p.pair === signal.pair);
    if (existingPosition) {
      console.warn(`По паре ${signal.pair} уже есть открытая позиция`);
      return {
        success: false,
        error: `По паре ${signal.pair} уже есть открытая позиция`
      };
    }
    
    // Сохраняем сигнал
    signal.timestamp = signal.timestamp || Date.now();
    this.activeSignals.push(signal);
    
    // Если включен автотрейдинг и не включен режим подтверждения вручную,
    // сразу исполняем сигнал
    if (riskSettings.autoTrading && !riskSettings.confirmationMode) {
      return await this.executeSignal(signal);
    }
    
    return {
      success: true,
      message: 'Сигнал успешно добавлен в очередь, ожидает подтверждения'
    };
  }

  // Исполнение торгового сигнала
  async executeSignal(signal) {
    console.log('Исполнение торгового сигнала:', signal);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Рассчитываем размер позиции
      const positionSize = this.calculatePositionSize(signal);
      
      // Создаем уникальный идентификатор для позиции
      const positionId = `${signal.pair}_${signal.direction}_${Date.now()}`;
      
      // Создаем объект позиции
      const position = {
        id: positionId,
        pair: signal.pair,
        direction: signal.direction,
        entryPoint: signal.entryPoint,
        currentPrice: signal.entryPoint,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit,
        size: positionSize,
        status: 'PENDING',
        openTime: Date.now(),
        closeTime: null,
        profit: 0,
        profitPercent: 0,
        closeReason: null,
        orderId: null
      };
      
      // Пытаемся создать ордер на бирже
      try {
        // Проверяем режим работы (реальный или симуляция)
        if (this.config.simulationMode || !exchange.apiKey) {
          console.log('Работа в режиме симуляции, ордер не отправляется на биржу');
          position.status = 'OPEN';
          position.simulationMode = true;
        } else {
          // Создаем ордер на бирже
          const order = await exchange.createOrder(
            signal.pair,
            signal.direction,
            'LIMIT',
            positionSize,
            signal.entryPoint
          );
          position.orderId = order.orderId;
          position.status = 'OPEN';
        }
      } catch (orderError) {
        console.error('Ошибка при создании ордера:', orderError);
        position.status = 'ERROR';
        position.error = orderError.message;
      }
      
      // Добавляем позицию в список активных
      this.activePositions.push(position);
      
      // Сохраняем данные
      this.saveData();
      
      console.log('Сигнал успешно исполнен, создана позиция:', positionId);
      
      return {
        success: true,
        positionId: positionId,
        position: position
      };
    } catch (error) {
      console.error('Ошибка при исполнении сигнала:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Расчет размера позиции
  calculatePositionSize(signal) {
    // Получаем настройки риск-менеджмента
    const riskSettings = this.config.riskManagement || this.core.config.trading || {};
    const maxRiskPercent = riskSettings.maxRiskPercent || 1; // % от депозита на сделку
    
    // Получаем информацию о депозите (заглушка)
    const deposit = this.getDepositInfo();
    
    // Рассчитываем риск на сделку в абсолютном выражении
    const riskAmount = deposit.total * (maxRiskPercent / 100);
    
    // Рассчитываем максимальный убыток в % от цены входа до стоп-лосса
    const entryPrice = signal.entryPoint;
    const stopLossPrice = signal.stopLoss;
    const riskPerUnit = Math.abs(entryPrice - stopLossPrice) / entryPrice * 100;
    
    // Рассчитываем размер позиции
    let positionSize = riskAmount / (entryPrice * riskPerUnit / 100);
    
    // Если включен разгон депозита, учитываем серию успешных сделок
    if (riskSettings.depositAcceleration) {
      const successStreak = this.calculateSuccessStreak();
      // Увеличиваем размер позиции на 10% за каждую успешную сделку подряд,
      // но не более чем в 3 раза от базового размера
      const accelerationFactor = Math.min(1 + (successStreak * 0.1), 3);
      positionSize *= accelerationFactor;
    }
    
    // Округляем до 4 знаков после запятой
    positionSize = Math.round(positionSize * 10000) / 10000;
    
    console.log(`Расчет размера позиции: депозит=${deposit.total}, риск=${maxRiskPercent}%, размер=${positionSize}`);
    
    return positionSize;
  }

  // Получение информации о депозите (заглушка)
  getDepositInfo() {
    // В реальном модуле здесь будет запрос к бирже
    
    // Для примера используем фиксированные значения
    return {
      total: 1000, // Общий размер депозита в USD
      available: 900, // Доступно для торговли
      margin: 100 // Занято в открытых позициях
    };
  }

  // Расчет количества успешных сделок подряд
  calculateSuccessStreak() {
    if (this.positionHistory.length === 0) {
      return 0;
    }
    
    // Сортируем историю по времени закрытия (от новых к старым)
    const sortedHistory = [...this.positionHistory]
      .sort((a, b) => b.closeTime - a.closeTime);
    
    // Считаем количество успешных сделок подряд
    let streak = 0;
    for (const position of sortedHistory) {
      if (position.profit > 0) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }
 // Обработка нового торгового сигнала
  async handleNewSignal(signal) {
    console.log('Получен новый торговый сигнал:', signal);
    
    // Проверяем настройки риск-менеджмента
    const riskSettings = this.config.riskManagement || this.core.config.trading || {};
    const maxConcurrentTrades = riskSettings.maxConcurrentTrades || 3;
    
    // Проверяем, не превышен ли лимит одновременных сделок
    const openPositions = this.getOpenPositions();
    if (openPositions.length >= maxConcurrentTrades) {
      console.warn('Превышен лимит одновременных сделок');
      return {
        success: false,
        error: 'Превышен лимит одновременных сделок'
      };
    }
    
    // Проверяем, нет ли уже открытой позиции по этой паре
    const existingPosition = openPositions.find(p => p.pair === signal.pair);
    if (existingPosition) {
      console.warn(`По паре ${signal.pair} уже есть открытая позиция`);
      return {
        success: false,
        error: `По паре ${signal.pair} уже есть открытая позиция`
      };
    }
    
    // Сохраняем сигнал
    signal.timestamp = signal.timestamp || Date.now();
    this.activeSignals.push(signal);
    
    // Если включен автотрейдинг и не включен режим подтверждения вручную,
    // сразу исполняем сигнал
    if (riskSettings.autoTrading && !riskSettings.confirmationMode) {
      return await this.executeSignal(signal);
    }
    
    return {
      success: true,
      message: 'Сигнал успешно добавлен в очередь, ожидает подтверждения'
    };
  }
  // Проверка и обновление статуса открытых позиций
  async checkOpenPositions() {
    const openPositions = this.getOpenPositions();
    if (openPositions.length === 0) {
      return;
    }
    
    console.log(`Проверка открытых позиций: ${openPositions.length}`);
    const now = Date.now();
    
    // Чтобы не отправлять слишком много запросов, делаем проверку не чаще чем раз в минуту
    if (now - this.lastCheck < this.checkInterval) {
      return;
    }
    
    this.lastCheck = now;
    
    // Получаем активный коннектор к бирже
    const exchange = this.core.getActiveExchangeConnector();
    
    // Проверяем каждую открытую позицию
    for (const position of openPositions) {
      try {
        // Получаем текущую цену для пары
        let currentPrice;
        
        if (position.simulationMode) {
          // В режиме симуляции генерируем случайную цену
          const randomMove = (Math.random() - 0.5) * 0.01; // -0.5% до +0.5%
          currentPrice = position.currentPrice * (1 + randomMove);
        } else {
          // Получаем реальную цену с биржи
          const ticker = await exchange.getTicker(position.pair);
          currentPrice = parseFloat(ticker.lastPrice);
        }
        
        // Обновляем текущую цену в позиции
        position.currentPrice = currentPrice;
        
        // Рассчитываем текущую прибыль/убыток
        this.calculatePositionProfitLoss(position);
        
        // Проверяем, достигнут ли стоп-лосс или тейк-профит
        if (this.shouldClosePosition(position)) {
          await this.closePosition(position.id, 'TP/SL');
        }
      } catch (error) {
        console.error(`Ошибка при проверке позиции ${position.id}:`, error);
      }
    }
    
    // Сохраняем обновленные данные
    this.saveData();
  }

  // Расчет прибыли/убытка позиции
  calculatePositionProfitLoss(position) {
    const entryPrice = position.entryPoint;
    const currentPrice = position.currentPrice;
    
    let profitPercent;
    if (position.direction === 'BUY') {
      profitPercent = (currentPrice - entryPrice) / entryPrice * 100;
    } else {
      profitPercent = (entryPrice - currentPrice) / entryPrice * 100;
    }
    
    // Абсолютная прибыль/убыток
    const profit = position.size * entryPrice * (profitPercent / 100);
    
    // Обновляем данные позиции
    position.profit = Math.round(profit * 100) / 100; // Округляем до 2 знаков
    position.profitPercent = Math.round(profitPercent * 100) / 100; // Округляем до 2 знаков
    
    return {
      profit,
      profitPercent
    };
  }

  // Проверка, нужно ли закрыть позицию по TP/SL
  shouldClosePosition(position) {
    const currentPrice = position.currentPrice;
    
    // Проверяем стоп-лосс
    if (position.direction === 'BUY' && currentPrice <= position.stopLoss) {
      console.log(`Позиция ${position.id} достигла стоп-лосса`);
      return true;
    }
    
    if (position.direction === 'SELL' && currentPrice >= position.stopLoss) {
      console.log(`Позиция ${position.id} достигла стоп-лосса`);
      return true;
    }
    
    // Проверяем тейк-профит
    if (position.direction === 'BUY' && currentPrice >= position.takeProfit) {
      console.log(`Позиция ${position.id} достигла тейк-профита`);
      return true;
    }
    
    if (position.direction === 'SELL' && currentPrice <= position.takeProfit) {
      console.log(`Позиция ${position.id} достигла тейк-профита`);
      return true;
    }
    
    return false;
  }

  // Закрытие позиции
  async closePosition(positionId, reason) {
    const position = this.activePositions.find(p => p.id === positionId);
    if (!position) {
      console.warn(`Позиция ${positionId} не найдена`);
      return {
        success: false,
        error: 'Позиция не найдена'
      };
    }
    
    console.log(`Закрытие позиции ${positionId} по причине: ${reason}`);
    
    try {
      // Если не в режиме симуляции и есть orderId, закрываем на бирже
      if (!position.simulationMode && position.orderId) {
        // Получаем активный коннектор к бирже
        const exchange = this.core.getActiveExchangeConnector();
        
        // Создаем ордер закрытия
        await exchange.createOrder(
          position.pair,
          position.direction === 'BUY' ? 'SELL' : 'BUY',
          'MARKET',
          position.size
        );
      }
      
      // Обновляем статус позиции
      position.status = 'CLOSED';
      position.closeTime = Date.now();
      position.closeReason = reason;
      
      // Рассчитываем финальную прибыль/убыток
      this.calculatePositionProfitLoss(position);
      
      // Перемещаем позицию из активных в историю
      this.activePositions = this.activePositions.filter(p => p.id !== positionId);
      this.positionHistory.push(position);
      
      // Сохраняем данные
      this.saveData();
      
      console.log(`Позиция ${positionId} успешно закрыта с P/L ${position.profit} (${position.profitPercent}%)`);
      
      return {
        success: true,
        position: position
      };
    } catch (error) {
      console.error(`Ошибка при закрытии позиции ${positionId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение открытых позиций
  getOpenPositions() {
    return this.activePositions.filter(p => p.status === 'OPEN' || p.status === 'PENDING');
  }

  // Получение истории позиций
  getPositionHistory() {
    return this.positionHistory;
  }

  // Получение статистики торговли
  getTradingStats() {
    // Собираем всю историю (закрытые позиции)
    const history = this.positionHistory;
    
    // Если история пуста, возвращаем пустую статистику
    if (history.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgProfit: 0,
        totalProfit: 0,
        maxProfit: 0,
        maxLoss: 0,
        profitFactor: 0,
        successStreak: 0,
        currentStreak: 0
      };
    }
    
    // Подсчитываем базовую статистику
    const totalTrades = history.length;
    const profitableTrades = history.filter(p => p.profit > 0).length;
    const winRate = (profitableTrades / totalTrades) * 100;
    
    // Общая прибыль/убыток
    const totalProfit = history.reduce((sum, p) => sum + p.profit, 0);
    const avgProfit = totalProfit / totalTrades;
    
    // Максимальная прибыль и убыток
    const maxProfit = Math.max(...history.map(p => p.profit));
    const maxLoss = Math.min(...history.map(p => p.profit));
    
    // Profit factor (отношение общей прибыли к общему убытку)
    const totalGain = history.filter(p => p.profit > 0).reduce((sum, p) => sum + p.profit, 0);
    const totalLoss = Math.abs(history.filter(p => p.profit < 0).reduce((sum, p) => sum + p.profit, 0));
    const profitFactor = totalLoss !== 0 ? totalGain / totalLoss : totalGain;
    
    // Текущая серия успешных/неуспешных сделок
    const sortedHistory = [...history].sort((a, b) => b.closeTime - a.closeTime);
    let currentStreak = 0;
    const lastResult = sortedHistory[0]?.profit > 0;
    
    for (const position of sortedHistory) {
      if ((position.profit > 0) === lastResult) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Если последняя сделка убыточная, делаем стрик отрицательным
    if (!lastResult) {
      currentStreak = -currentStreak;
    }
    
    // Максимальная серия успешных сделок
    const successStreak = this.calculateSuccessStreak();
    
    return {
      totalTrades,
      winRate: Math.round(winRate * 100) / 100,
      avgProfit: Math.round(avgProfit * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      maxProfit: Math.round(maxProfit * 100) / 100,
      maxLoss: Math.round(maxLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      successStreak,
      currentStreak
    };
  }

  // Очистка ресурсов при выгрузке модуля
  async cleanup() {
    console.log('Очистка ресурсов модуля автотрейдинга...');
    
    // Сохраняем текущее состояние
    this.saveData();
    
    this.isInitialized = false;
    console.log('Модуль автотрейдинга успешно выгружен');
  }

  // Предоставление метаданных модуля для API
  getMetadata() {
    return {
      id: 'auto-trader',
      name: this.name,
      description: this.description,
      version: '1.0.0',
      capabilities: [
        'execute_signals',
        'manage_positions',
        'risk_management',
        'trading_statistics'
      ]
    };
  }

  // Добавление эндпоинтов в Express приложение
  registerApiEndpoints(app) {
    // Эндпоинт для исполнения сигнала
    app.post('/api/execute-signal', async (req, res) => {
      try {
        const signal = req.body;
        const result = await this.executeSignal(signal);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Эндпоинт для получения открытых позиций
    app.get('/api/positions', (req, res) => {
      res.json({
        openPositions: this.getOpenPositions(),
        history: this.getPositionHistory()
      });
    });
    
    // Эндпоинт для получения статистики торговли
    app.get('/api/trading-stats', (req, res) => {
      res.json(this.getTradingStats());
    });
    
    // Эндпоинт для закрытия позиции
    app.post('/api/close-position/:id', async (req, res) => {
      try {
        const positionId = req.params.id;
        const reason = req.body.reason || 'MANUAL';
        
        const result = await this.closePosition(positionId, reason);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
}

module.exports = AutoTraderModule;
