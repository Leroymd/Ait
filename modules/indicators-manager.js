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
  }
}

module.exports = IndicatorsManager;