// modules/indicators/indicator-base.js
// Базовый класс для всех индикаторов

class IndicatorBase {
  constructor(config) {
    this.name = 'Базовый индикатор';
    this.description = 'Базовый класс для всех индикаторов';
    this.id = 'base-indicator';
    this.config = config || {};
    this.core = null;
    this.isInitialized = false;
    this.visible = false;
    this.lastCalculation = null;
    this.lastCalculationTime = null;
  }

  // Инициализация индикатора
  async initialize(core) {
    this.core = core;
    this.isInitialized = true;
    console.log(`Индикатор ${this.name} инициализирован`);
    return true;
  }

  // Расчет значений индикатора
  async calculate(chartData) {
    throw new Error('Метод calculate() должен быть переопределен в дочернем классе');
  }

  // Получение данных для отрисовки индикатора на графике
  getVisualData() {
    throw new Error('Метод getVisualData() должен быть переопределен в дочернем классе');
  }

  // Установка видимости индикатора
  setVisible(visible) {
    this.visible = visible;
    
    // Оповещаем о изменении видимости, если есть core
    if (this.core && typeof this.core.emit === 'function') {
      this.core.emit('indicator.visibilityChanged', {
        id: this.id,
        visible: this.visible
      });
    }
    
    return this.visible;
  }

  // Получение метаданных индикатора
  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      visible: this.visible,
      configurable: true,
      config: this.config,
      lastCalculationTime: this.lastCalculationTime
    };
  }

  // Обновление конфигурации индикатора
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Оповещаем о изменении конфигурации, если есть core
    if (this.core && typeof this.core.emit === 'function') {
      this.core.emit('indicator.configChanged', {
        id: this.id,
        config: this.config
      });
    }
    
    return this.config;
  }

  // Очистка ресурсов при выгрузке индикатора
  cleanup() {
    this.isInitialized = false;
    console.log(`Индикатор ${this.name} выгружен`);
  }
  
  // Вспомогательный метод для кэширования результатов расчета
  cacheCalculation(result) {
    this.lastCalculation = result;
    this.lastCalculationTime = Date.now();
    return result;
  }
  
  // Проверка, устарел ли кэш
  isCacheStale(maxAgeMs = 60000) {
    if (!this.lastCalculationTime) return true;
    return Date.now() - this.lastCalculationTime > maxAgeMs;
  }
  
  // Вспомогательный метод для логирования
  log(message) {
    console.log(`[${this.id}] ${message}`);
  }
}

module.exports = IndicatorBase;