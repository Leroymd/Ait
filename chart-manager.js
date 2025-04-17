// modules/chart-manager.js
// Менеджер для управления графиком и взаимодействия с индикаторами

const { createChart, CrosshairMode, LineStyle } = require('lightweight-charts');

class ChartManager {
  constructor(config) {
    this.config = config || {};
    this.core = null;
    this.chart = null;
    this.candleSeries = null;
    this.indicatorSeries = {};
    this.isInitialized = false;
    this.container = null;
    this.currentSymbol = null;
    this.currentInterval = null;
    this.lastData = null;
    this.currentTheme = this.config.theme || 'dark';
    
    // События
    this.eventHandlers = {};
  }
  
  // Инициализация менеджера графика
  async initialize(core, container) {
    this.core = core;
    this.container = container || this.config.container || document.getElementById('chart-container');
    
    if (!this.container) {
      console.error('Не найден контейнер для графика');
      return false;
    }
    
    console.log('Инициализация менеджера графика...');
    
    // Создаем график
    this.chart = createChart(this.container, {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      layout: {
        backgroundColor: this.currentTheme === 'dark' ? '#151924' : '#ffffff',
        textColor: this.currentTheme === 'dark' ? '#d1d4dc' : '#191919',
      },
      grid: {
        vertLines: {
          color: this.currentTheme === 'dark' ? '#2e3241' : '#f0f3fa'
        },
        horzLines: {
          color: this.currentTheme === 'dark' ? '#2e3241' : '#f0f3fa'
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: this.currentTheme === 'dark' ? '#2e3241' : '#2b2b43',
        timeVisible: true,
        secondsVisible: false
      },
      rightPriceScale: {
        borderColor: this.currentTheme === 'dark' ? '#2e3241' : '#2b2b43',
      },
    });
    
    // Серия для свечей
    this.candleSeries = this.chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    
    // Инициализируем текущий символ и интервал
    this.currentSymbol = this.core.config.tradingPair || this.config.defaultSymbol || 'BTCUSDT';
    this.currentInterval = this.config.defaultInterval || '1h';
    
    // Добавляем лого на график
    this.chart.applyOptions({
      watermark: {
        visible: true,
        fontSize: 42,
        horzAlign: 'center',
        vertAlign: 'center',
        color: this.currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        text: this.currentSymbol,
      }
    });
    
    // Настраиваем обработчики событий
    this.setupEventHandlers();
    
    // Загружаем первоначальные данные
    await this.loadChartData();
    
    // Подписываемся на события ядра
    this.registerCoreEventHandlers();
    
    // Регистрируем обработчик изменения размера окна
    window.addEventListener('resize', () => this.handleResize());
    
    this.isInitialized = true;
    console.log('Менеджер графика инициализирован');
    
    // Оповещаем о готовности
    this.emit('chart.ready', { 
      symbol: this.currentSymbol,
      interval: this.currentInterval
    });
    
    return true;
  }
  
  // Настройка обработчиков событий
  setupEventHandlers() {
    // Обработчик изменения видимой области
    this.chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const visibleRange = this.chart.timeScale().getVisibleRange();
      if (visibleRange) {
        this.emit('chart.rangeChanged', visibleRange);
      }
    });
    
    // Обработчик клика на графике
    this.container.addEventListener('click', (e) => {
      const point = {
        x: e.clientX,
        y: e.clientY
      };
      
      // Преобразуем координаты щелчка в координаты графика
      const priceCoord = this.chart.priceScale('right').coordinateToPrice(point.y);
      const timeCoord = this.chart.timeScale().coordinateToTime(point.x);
      
      // Оповещаем о клике
      this.emit('chart.click', {
        price: priceCoord,
        time: timeCoord,
        point: point
      });
    });
  }
  
  // Регистрация обработчиков событий ядра
  registerCoreEventHandlers() {
    if (!this.core) return;
    
    // Подписываемся на событие изменения торговой пары
    this.core.on('tradingPair.changed', async (data) => {
      console.log(`[ChartManager] Обработка события изменения пары: ${data.newPair}`);
      await this.changeSymbol(data.newPair);
    });
    
    // Подписываемся на событие изменения настроек индикаторов
    this.core.on('indicator.configChanged', async (data) => {
      console.log(`[ChartManager] Обработка события изменения настроек индикатора: ${data.id}`);
      await this.updateIndicator(data.id);
    });
    
    // Подписываемся на событие изменения видимости индикаторов
    this.core.on('indicator.visibilityChanged', async (data) => {
      console.log(`[ChartManager] Обработка события изменения видимости индикатора: ${data.id}`);
      
      if (data.visible) {
        await this.showIndicator(data.id);
      } else {
        this.hideIndicator(data.id);
      }
    });
  }
  
  // Обработчик изменения размера окна
  handleResize() {
    if (this.chart && this.container) {
      this.chart.resize(
        this.container.clientWidth,
        this.container.clientHeight
      );
    }
  }
  
  // Загрузка данных графика
  async loadChartData() {
    if (!this.core || !this.candleSeries) return;
    
    console.log(`Загрузка данных графика для ${this.currentSymbol} (${this.currentInterval})`);
    
    try {
      // Получаем данные через ядро
      const chartData = await this.core.getChartData({
        symbol: this.currentSymbol,
        interval: this.currentInterval,
        limit: this.config.dataLimit || 1000
      });
      
      // Конвертируем данные в формат LightweightCharts
      const formattedData = chartData.map(candle => ({
        time: candle.openTime / 1000, // Конвертируем миллисекунды в секунды
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume
      }));
      
      // Устанавливаем данные в серию
      this.candleSeries.setData(formattedData);
      
      // Сохраняем загруженные данные
      this.lastData = chartData;
      
      // Обновляем индикаторы
      await this.updateAllIndicators();
      
      // Обновляем водяной знак
      this.chart.applyOptions({
        watermark: {
          visible: true,
          fontSize: 42,
          horzAlign: 'center',
          vertAlign: 'center',
          color: this.currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          text: this.currentSymbol,
        }
      });
      
      // Оповещаем о загрузке данных
      this.emit('chart.dataLoaded', {
        symbol: this.currentSymbol,
        interval: this.currentInterval,
        count: formattedData.length
      });
      
      return formattedData;
    } catch (error) {
      console.error('Ошибка при загрузке данных графика:', error);
      this.emit('chart.error', {
        error: error.message,
        action: 'loadChartData'
      });
      return null;
    }
  }
  
  // Изменение торговой пары
  async changeSymbol(symbol) {
    if (!this.chart || this.currentSymbol === symbol) return;
    
    console.log(`Изменение символа на ${symbol}`);
    this.currentSymbol = symbol;
    
    // Оповещаем о начале изменения
    this.emit('chart.symbolChanging', { symbol });
    
    // Загружаем данные для нового символа
    await this.loadChartData();
    
    // Оповещаем о завершении изменения
    this.emit('chart.symbolChanged', { symbol });
  }
  
  // Изменение интервала
  async changeInterval(interval) {
    if (!this.chart || this.currentInterval === interval) return;
    
    console.log(`Изменение интервала на ${interval}`);
    this.currentInterval = interval;
    
    // Оповещаем о начале изменения
    this.emit('chart.intervalChanging', { interval });
    
    // Загружаем данные для нового интервала
    await this.loadChartData();
    
    // Оповещаем о завершении изменения
    this.emit('chart.intervalChanged', { interval });
  }
  
  // Добавление и отображение индикатора
  async showIndicator(indicatorId) {
    if (!this.core || !this.chart || !this.lastData) return;
    
    const indicatorsManager = this.core.getModule('indicators-manager');
    if (!indicatorsManager) {
      console.error('Менеджер индикаторов не найден');
      return;
    }
    
    // Получаем индикатор
    const indicator = indicatorsManager.getIndicator(indicatorId);
    if (!indicator) {
      console.error(`Индикатор с ID ${indicatorId} не найден`);
      return;
    }
    
    // Рассчитываем индикатор
    await indicatorsManager.calculateIndicator(indicatorId, this.lastData);
    
    // Получаем данные для визуализации
    const visualData = indicatorsManager.getIndicatorVisualData(indicatorId);
    if (!visualData) {
      console.warn(`Индикатор ${indicatorId} не предоставил данных для визуализации`);
      return;
    }
    
    // Очищаем старые серии индикатора, если они есть
    if (this.indicatorSeries[indicatorId]) {
      this.hideIndicator(indicatorId);
    }
    
    // Создаем массив для хранения серий этого индикатора
    this.indicatorSeries[indicatorId] = [];
    
    // Отображаем различные элементы индикатора
    
    // 1. Маркеры (точки на графике)
    if (visualData.markers) {
      const markerSeries = this.chart.addLineSeries({
        lastValueVisible: false,
        priceLineVisible: false,
        lineWidth: 0
      });
      markerSeries.setMarkers(visualData.markers);
      this.indicatorSeries[indicatorId].push(markerSeries);
    }
    
    // 2. Области (прямоугольники)
    if (visualData.areas) {
      for (const area of visualData.areas) {
        // Для каждой области создаем две серии линий
        const topSeries = this.chart.addLineSeries({
          lastValueVisible: false,
          priceLineVisible: false,
          lineStyle: LineStyle.Solid,
          lineWidth: area.borderWidth || 1,
          color: area.borderColor || area.color,
          lineType: 0 // Сплошная линия
        });
        
        const bottomSeries = this.chart.addLineSeries({
          lastValueVisible: false,
          priceLineVisible: false,
          lineStyle: LineStyle.Solid,
          lineWidth: area.borderWidth || 1,
          color: area.borderColor || area.color,
          lineType: 0
        });
        
        // Заливка между линиями
        const areaSeries = this.chart.addAreaSeries({
          topColor: area.color,
          bottomColor: area.color,
          lineColor: 'transparent',
          lineWidth: 0,
          lastValueVisible: false,
          priceLineVisible: false
        });
        
        // Устанавливаем данные
        const data = [
          { time: area.startTime / 1000, value: area.top }, 
          // Добавляем вторую точку, чтобы область продолжалась до текущего времени
          { time: this.lastData[this.lastData.length - 1].openTime / 1000, value: area.top }
        ];
        
        const bottomData = [
          { time: area.startTime / 1000, value: area.bottom },
          // Добавляем вторую точку, чтобы область продолжалась до текущего времени
          { time: this.lastData[this.lastData.length - 1].openTime / 1000, value: area.bottom }
        ];
        
        topSeries.setData(data);
        bottomSeries.setData(bottomData);
        areaSeries.setData(data); // Верхняя граница для области
        
        this.indicatorSeries[indicatorId].push(topSeries);
        this.indicatorSeries[indicatorId].push(bottomSeries);
        this.indicatorSeries[indicatorId].push(areaSeries);
      }
    }
    
    // 3. Линии
    if (visualData.lines) {
      for (const line of visualData.lines) {
        const lineSeries = this.chart.addLineSeries({
          color: line.color,
          lineWidth: line.width || 1,
          lineStyle: line.style || LineStyle.Solid,
          lastValueVisible: line.showLastValue !== false,
          priceLineVisible: line.showPriceLine !== false
        });
        
        lineSeries.setData(line.data.map(point => ({
          time: point.time / 1000,
          value: point.value
        })));
        
        this.indicatorSeries[indicatorId].push(lineSeries);
      }
    }
    
    // 4. Гистограммы
    if (visualData.histograms) {
      for (const histogram of visualData.histograms) {
        const histSeries = this.chart.addHistogramSeries({
          color: histogram.color || '#26a69a',
          priceFormat: {
            type: 'volume'
          },
          priceScaleId: histogram.scaleId || '',
          scaleMargins: {
            top: histogram.margin?.top || 0.8,
            bottom: histogram.margin?.bottom || 0
          }
        });
        
        histSeries.setData(histogram.data.map(point => ({
          time: point.time / 1000,
          value: point.value,
          color: point.color
        })));
        
        this.indicatorSeries[indicatorId].push(histSeries);
      }
    }
    
    // 5. Боксы (например, для Order Blocks)
    if (visualData.boxes) {
      for (const box of visualData.boxes) {
        // Для каждого бокса создаем две серии линий и одну область
        const topSeries = this.chart.addLineSeries({
          lastValueVisible: false,
          priceLineVisible: false,
          lineStyle: LineStyle.Solid,
          lineWidth: box.borderWidth || 1,
          color: box.borderColor || 'rgba(255, 255, 255, 0.5)',
          lineType: 0
        });
        
        const bottomSeries = this.chart.addLineSeries({
          lastValueVisible: false,
          priceLineVisible: false,
          lineStyle: LineStyle.Solid,
          lineWidth: box.borderWidth || 1,
          color: box.borderColor || 'rgba(255, 255, 255, 0.5)',
          lineType: 0
        });
        
        // Заливка между линиями
        const areaSeries = this.chart.addAreaSeries({
          topColor: box.color || 'rgba(76, 175, 80, 0.2)',
          bottomColor: box.color || 'rgba(76, 175, 80, 0.2)',
          lineColor: 'transparent',
          lineWidth: 0,
          lastValueVisible: false,
          priceLineVisible: false
        });
        
        // Находим конечное время (текущее время или заданный предел)
        const endTime = box.endTime ? 
                      box.endTime / 1000 : 
                      this.lastData[this.lastData.length - 1].openTime / 1000;
        
        // Устанавливаем данные
        const topData = [
          { time: box.time / 1000, value: box.top },
          { time: endTime, value: box.top }
        ];
        
        const bottomData = [
          { time: box.time / 1000, value: box.bottom },
          { time: endTime, value: box.bottom }
        ];
        
        topSeries.setData(topData);
        bottomSeries.setData(bottomData);
        areaSeries.setData(topData); // Верхняя граница для области
        
        this.indicatorSeries[indicatorId].push(topSeries);
        this.indicatorSeries[indicatorId].push(bottomSeries);
        this.indicatorSeries[indicatorId].push(areaSeries);
      }
    }
    
    // 6. Дополнительные элементы (например, SwingHighs и SwingLows)
    if (visualData.swingHighs) {
      const swingHighSeries = this.chart.addLineSeries({
        lastValueVisible: false,
        priceLineVisible: false,
        lineWidth: 0
      });
      swingHighSeries.setMarkers(visualData.swingHighs);
      this.indicatorSeries[indicatorId].push(swingHighSeries);
    }
    
    if (visualData.swingLows) {
      const swingLowSeries = this.chart.addLineSeries({
        lastValueVisible: false,
        priceLineVisible: false,
        lineWidth: 0
      });
      swingLowSeries.setMarkers(visualData.swingLows);
      this.indicatorSeries[indicatorId].push(swingLowSeries);
    }
    
    if (visualData.shifts) {
      const shiftSeries = this.chart.addLineSeries({
        lastValueVisible: false,
        priceLineVisible: false,
        lineWidth: 0
      });
      shiftSeries.setMarkers(visualData.shifts);
      this.indicatorSeries[indicatorId].push(shiftSeries);
    }
    
    // Оповещаем о добавлении индикатора
    this.emit('chart.indicatorAdded', {
      id: indicatorId,
      series: this.indicatorSeries[indicatorId].length
    });
  }
  
  // Скрытие индикатора
  hideIndicator(indicatorId) {
    if (!this.chart || !this.indicatorSeries[indicatorId]) return;
    
    // Удаляем все серии индикатора
    for (const series of this.indicatorSeries[indicatorId]) {
      this.chart.removeSeries(series);
    }
    
    // Очищаем массив серий
    delete this.indicatorSeries[indicatorId];
    
    // Оповещаем о скрытии индикатора
    this.emit('chart.indicatorRemoved', { id: indicatorId });
  }
  
  // Обновление индикатора
  async updateIndicator(indicatorId) {
    // Если индикатор отображается, обновляем его
    if (this.indicatorSeries[indicatorId]) {
      // Скрываем индикатор
      this.hideIndicator(indicatorId);
      
      // Показываем его заново с обновленными данными
      await this.showIndicator(indicatorId);
    }
  }
  
  // Обновление всех отображаемых индикаторов
  async updateAllIndicators() {
    for (const indicatorId in this.indicatorSeries) {
      await this.updateIndicator(indicatorId);
    }
  }
  
  // Изменение темы графика
  setTheme(theme) {
    this.currentTheme = theme;
    
    if (!this.chart) return;
    
    this.chart.applyOptions({
      layout: {
        backgroundColor: theme === 'dark' ? '#151924' : '#ffffff',
        textColor: theme === 'dark' ? '#d1d4dc' : '#191919'
      },
      grid: {
        vertLines: {
          color: theme === 'dark' ? '#2e3241' : '#f0f3fa'
        },
        horzLines: {
          color: theme === 'dark' ? '#2e3241' : '#f0f3fa'
        }
      },
      watermark: {
        color: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
      }
    });
    
    // Оповещаем о смене темы
    this.emit('chart.themeChanged', { theme });
  }
  
  // Подписка на событие
  on(eventName, handler) {
    if (!this.eventHandlers[eventName]) {
      this.eventHandlers[eventName] = [];
    }
    
    this.eventHandlers[eventName].push(handler);
    return this;
  }
  
  // Отписка от события
  off(eventName, handler) {
    if (!this.eventHandlers[eventName]) {
      return this;
    }
    
    if (!handler) {
      delete this.eventHandlers[eventName];
      return this;
    }
    
    this.eventHandlers[eventName] = this.eventHandlers[eventName]
      .filter(h => h !== handler);
    
    return this;
  }
  
  // Вызов обработчиков события
  emit(eventName, data) {
    if (!this.eventHandlers[eventName]) {
      return;
    }
    
    for (const handler of this.eventHandlers[eventName]) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Ошибка в обработчике события ${eventName}:`, error);
      }
    }
  }
  
  // Очистка ресурсов при выгрузке
  cleanup() {
    // Отписываемся от событий ядра
    if (this.core) {
      // Отписка от событий...
    }
    
    // Отписываемся от события изменения размера окна
    window.removeEventListener('resize', this.handleResize);
    
    // Удаляем график
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
    
    // Очищаем серии
    this.candleSeries = null;
    this.indicatorSeries = {};
    
    this.isInitialized = false;
    console.log('Менеджер графика выгружен');
  }
  
  // Регистрация API эндпоинтов
  registerApiEndpoints(app) {
    // Получение текущего состояния графика
    app.get('/api/chart/info', (req, res) => {
      res.json({
        symbol: this.currentSymbol,
        interval: this.currentInterval,
        indicators: Object.keys(this.indicatorSeries),
        theme: this.currentTheme,
        isInitialized: this.isInitialized
      });
    });
    
    // Изменение символа
    app.post('/api/chart/symbol', async (req, res) => {
      try {
        const { symbol } = req.body;
        
        if (!symbol) {
          return res.status(400).json({ error: 'Символ не указан' });
        }
        
        await this.changeSymbol(symbol);
        
        res.json({
          success: true,
          symbol: this.currentSymbol
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Изменение интервала
    app.post('/api/chart/interval', async (req, res) => {
      try {
        const { interval } = req.body;
        
        if (!interval) {
          return res.status(400).json({ error: 'Интервал не указан' });
        }
        
        await this.changeInterval(interval);
        
        res.json({
          success: true,
          interval: this.currentInterval
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Изменение темы
    app.post('/api/chart/theme', (req, res) => {
      try {
        const { theme } = req.body;
        
        if (!theme || (theme !== 'dark' && theme !== 'light')) {
          return res.status(400).json({ error: 'Некорректная тема' });
        }
        
        this.setTheme(theme);
        
        res.json({
          success: true,
          theme: this.currentTheme
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
}

module.exports = ChartManager;