// server.js - Точка входа для запуска сервера

const dotenv = require('dotenv');
const TradingApp = require('./app');
const config = require('./config');

// Загружаем переменные окружения из .env файла
dotenv.config();

console.log('✅ ENV LOADED:');
console.log('BINANCE KEY:', process.env.BINANCE_API_KEY ? '****' + process.env.BINANCE_API_KEY.slice(-4) : 'Не задан');
console.log('AI KEY:', process.env.AI_API_KEY ? '****' + process.env.AI_API_KEY.slice(-4) : 'Не задан');

// Создаем и инициализируем приложение
async function startServer() {
    try {
        // Создаем экземпляр приложения
        const app = new TradingApp();
        
        // Инициализируем приложение
        await app.initialize();
        
        // Определяем порт для запуска сервера
        // Используем порт из конфигурации, переменных окружения или по умолчанию 3000
        const port = config.general?.port || process.env.PORT || 3000;
        
        // Запускаем сервер
        app.start(port);
        
        console.log(`Сервер запущен и доступен по адресу http://localhost:${port}`);
        
        // Выводим доступные маршруты
        console.log('Доступные маршруты:');
        console.log('- http://localhost:' + port + '/ - Главная страница');
        console.log('- http://localhost:' + port + '/analytics - Аналитика');
        console.log('- http://localhost:' + port + '/positions - Позиции');
        console.log('- http://localhost:' + port + '/settings - Настройки');
    } catch (error) {
        console.error('Ошибка при запуске сервера:', error);
        process.exit(1);
    }
}

// Обработка ошибок и исключений
process.on('uncaughtException', (error) => {
    console.error('Непойманное исключение:', error);
    // Здесь можно добавить логирование ошибки, отправку уведомления и т.д.
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Необработанный отказ Promise:', reason);
    // Здесь можно добавить логирование ошибки, отправку уведомления и т.д.
});

// Запускаем сервер
startServer();