// server.js - Улучшенная точка входа для запуска сервера

const dotenv = require('dotenv');
const TradingApp = require('./app');
const config = require('./config');

/**
 * Основной класс для запуска сервера приложения
 */
class ServerLauncher {
  /**
   * Запуск серверного приложения
   */
  static async start() {
    try {
      console.log('Запуск торговой платформы...');
      
      // Загружаем переменные окружения из .env файла
      dotenv.config();
      
      // Вывод информации о ключах (скрытых)
      console.log('✅ ENV LOADED:');
      ServerLauncher.logMaskedKey('BINANCE KEY', process.env.BINANCE_API_KEY);
      ServerLauncher.logMaskedKey('AI KEY', process.env.AI_API_KEY);
      
      // Создаем экземпляр приложения
      const app = new TradingApp();
      
      // Инициализируем приложение с обработкой ошибок
      await ServerLauncher.initializeApp(app);
      
      // Определяем порт для запуска сервера
      const port = config.general?.port || process.env.PORT || 3000;
      
      // Запускаем сервер
      app.start(port);
      
      console.log(`Сервер запущен и доступен по адресу http://localhost:${port}`);
      
      // Выводим доступные маршруты
      ServerLauncher.logAvailableRoutes(port);
      
      // Возвращаем экземпляр приложения для тестирования
      return app;
    } catch (error) {
      console.error('Критическая ошибка при запуске сервера:', error);
      process.exit(1);
    }
  }
  
  /**
   * Инициализирует приложение с обработкой ошибок
   * @param {Object} app - Экземпляр приложения
   * @returns {Promise<void>}
   */
  static async initializeApp(app) {
    try {
      // Устанавливаем таймаут на инициализацию
      const timeout = setTimeout(() => {
        console.error('Превышено время ожидания инициализации приложения (60 секунд)');
        process.exit(1);
      }, 60000);
      
      // Инициализируем приложение
      await app.initialize();
      
      // Очищаем таймаут
      clearTimeout(timeout);
    } catch (error) {
      console.error('Ошибка при инициализации приложения:', error);
      throw error;
    }
  }
  
  /**
   * Выводит в лог информацию о ключе API (скрытую)
   * @param {string} name - Название ключа
   * @param {string} key - Значение ключа
   */
  static logMaskedKey(name, key) {
    console.log(`${name}:`, key ? '****' + key.slice(-4) : 'Не задан');
  }
  
  /**
   * Выводит в лог доступные маршруты
   * @param {number} port - Порт сервера
   */
  static logAvailableRoutes(port) {
    console.log('Доступные маршруты:');
    console.log(`- http://localhost:${port}/ - Главная страница`);
    console.log(`- http://localhost:${port}/analytics - Аналитика`);
    console.log(`- http://localhost:${port}/positions - Позиции`);
    console.log(`- http://localhost:${port}/settings - Настройки`);
    console.log(`- http://localhost:${port}/api/status - Статус сервера (API)`);
  }
}

// Обработка ошибок и исключений
process.on('uncaughtException', (error) => {
  console.error('Непойманное исключение:', error);
  // В продакшене можно добавить логирование ошибки в файл или отправку уведомления
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанный отказ Promise:', reason);
  // В продакшене можно добавить логирование ошибки в файл или отправку уведомления
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('Получен сигнал SIGINT, завершение работы...');
  // Здесь можно добавить логику для корректного завершения работы
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, завершение работы...');
  // Здесь можно добавить логику для корректного завершения работы
  process.exit(0);
});

// Запускаем сервер
if (require.main === module) {
  ServerLauncher.start();
}

// Экспортируем для тестирования
module.exports = ServerLauncher;