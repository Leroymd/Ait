// Интеграция новых модулей в app.js
// Добавить эти изменения в метод loadModules класса TradingApp

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