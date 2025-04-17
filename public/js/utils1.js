// utils-fixed.js - Вспомогательные функции (исправленная версия)

import { state, elements } from './app.js';

/**
 * Обработка ошибок с отображением сообщения пользователю
 * @param {string} message - сообщение об ошибке
 * @param {boolean} isWarning - если true, будет отображено как предупреждение, а не ошибка
 */
export function handleError(message, isWarning = false) {
    console[isWarning ? 'warn' : 'error'](message);
    
    // Проверяем, есть ли Bootstrap для создания тоста
    if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
        showToast(message, isWarning ? 'warning' : 'danger');
    } else {
        // Если нет Bootstrap, используем alert
        if (!isWarning) {
            alert(message);
        }
    }
}

/**
 * Показать всплывающее уведомление
 * @param {string} message - сообщение для отображения
 * @param {string} type - тип уведомления (success, info, warning, danger)
 * @param {number} duration - длительность отображения в миллисекундах
 */
export function showToast(message, type = 'info', duration = 5000) {
    // Проверяем, есть ли Bootstrap
    if (typeof bootstrap === 'undefined' || !bootstrap.Toast) {
        console.log(`Уведомление (${type}): ${message}`);
        return;
    }
    
    // Создаем контейнер для тостов, если его еще нет
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Определяем иконку в зависимости от типа
    let icon;
    switch (type) {
        case 'success':
            icon = '<i class="bi bi-check-circle"></i>';
            break;
        case 'warning':
            icon = '<i class="bi bi-exclamation-triangle"></i>';
            break;
        case 'danger':
            icon = '<i class="bi bi-x-circle"></i>';
            break;
        case 'info':
        default:
            icon = '<i class="bi bi-info-circle"></i>';
            break;
    }
    
    // Создаем уникальный ID для тоста
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Создаем элемент тоста
    const toastElement = document.createElement('div');
    toastElement.className = `toast align-items-center text-white bg-${type} border-0`;
    toastElement.id = toastId;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');
    
    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${icon} ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Добавляем тост в контейнер
    toastContainer.appendChild(toastElement);
    
    // Инициализируем и показываем тост
    const toastInstance = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: duration
    });
    
    // Обязательно вызываем метод show()
    toastInstance.show();
    
    // Удаляем элемент тоста после скрытия
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
        
        // Если в контейнере больше нет тостов, удаляем и его
        if (toastContainer.children.length === 0) {
            toastContainer.remove();
        }
    });
}

/**
 * Генерирует тестовые данные для графика
 * @param {number} count - количество свечей для генерации
 * @param {string} pair - торговая пара (для определения базовой цены)
 * @returns {Array} - массив данных свечей
 */
export function generateMockChartData(count = 100, pair = 'BTCUSDT') {
    console.log(`Генерация тестовых данных графика (${count} свечей) для пары ${pair}`);
    
    // Определяем базовую цену в зависимости от пары
    let basePrice;
    if (pair.includes('BTC')) {
        basePrice = 30000 + Math.random() * 10000;
    } else if (pair.includes('ETH')) {
        basePrice = 2000 + Math.random() * 500;
    } else if (pair.includes('SOL')) {
        basePrice = 100 + Math.random() * 50;
    } else if (pair.includes('XRP')) {
        basePrice = 0.5 + Math.random() * 0.2;
    } else {
        basePrice = 100 + Math.random() * 50;
    }
    
    // Генерируем данные
    const data = [];
    let currentPrice = basePrice;
    const volatility = basePrice * 0.01; // 1% волатильность
    
    // Текущее время
    const now = Date.now();
    // Интервал между свечами (1 час)
    const interval = 60 * 60 * 1000;
    
    for (let i = 0; i < count; i++) {
        // Время открытия свечи (от старых к новым)
        const openTime = now - (count - i) * interval;
        // Время закрытия свечи
        const closeTime = openTime + interval - 1;
        
        // Случайное изменение цены с трендом
        const change = (Math.random() - 0.5) * volatility * 2;
        // Добавляем небольшой тренд
        const trend = Math.sin(i / 20) * volatility * 0.5;
        
        // Обновляем цену
        currentPrice = Math.max(0.01, currentPrice + change + trend);
        
        // Генерируем данные свечи
        const open = currentPrice;
        const close = currentPrice + (Math.random() - 0.5) * volatility;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;
        
        // Добавляем свечу в массив
        data.push({
            openTime,
            open,
            high,
            low,
            close,
            volume: Math.random() * basePrice * 10,
            closeTime
        });
    }
    
    return data;
}
/**
 * Загружает тестовые данные графика при отсутствии соединения с сервером
 */
export function loadMockChartData() {
    console.log('Загрузка тестовых данных графика...');
    
    // Генерируем тестовые данные
    const mockData = generateMockChartData(100, state.tradingPair);
    
    // Обновляем состояние
    state.chartData = mockData;
    
    // Импортируем функцию updateChart динамически, чтобы избежать циклических зависимостей
    import('./chart.js').then(chartModule => {
        // Сначала очищаем график
        chartModule.resetChart();
        
        // Затем устанавливаем новые данные
        chartModule.updateChart(mockData);
    }).catch(error => {
        console.error('Ошибка при загрузке модуля графика:', error);
    });
}

/**
 * Загружает все тестовые данные для работы приложения в офлайн-режиме
 */
export function loadMockData() {
    console.log('Загрузка всех тестовых данных...');
    
    // Загружаем тестовые данные графика
    loadMockChartData();
    
    // Загружаем тестовые данные модулей
    import('./modules.js').then(modulesModule => {
        modulesModule.loadMockModules();
    }).catch(error => {
        console.error('Ошибка при загрузке модуля модулей:', error);
    });
}

/**
 * Форматирование цены для отображения
 * @param {number} price - цена для форматирования
 * @param {string} pair - торговая пара
 * @returns {string} - отформатированная цена
 */
export function formatPrice(price, pair = state.tradingPair) {
    if (typeof price !== 'number') {
        return '0.00';
    }
    
    // Определяем количество десятичных знаков в зависимости от пары
    let decimals = 2;
    
    if (pair.includes('BTC')) {
        decimals = 1;
    } else if (pair.includes('ETH')) {
        decimals = 2;
    } else if (price < 1) {
        decimals = 6;
    } else if (price < 10) {
        decimals = 4;
    } else if (price < 1000) {
        decimals = 2;
    } else {
        decimals = 0;
    }
    
    return price.toFixed(decimals);
}

/**
 * Форматирование даты и времени
 * @param {number} timestamp - timestamp в миллисекундах
 * @param {boolean} includeSeconds - включать ли секунды
 * @returns {string} - отформатированная дата и время
 */
export function formatDateTime(timestamp, includeSeconds = false) {
    if (!timestamp) {
        return '-';
    }
    
    const date = new Date(timestamp);
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    if (includeSeconds) {
        options.second = '2-digit';
    }
    
    return date.toLocaleString(undefined, options);
}

/**
 * Форматирование процента
 * @param {number} percent - процент для форматирования
 * @param {boolean} includeSign - включать ли знак "+"
 * @returns {string} - отформатированный процент
 */
export function formatPercent(percent, includeSign = true) {
    if (typeof percent !== 'number') {
        return '0.00%';
    }
    
    const sign = includeSign && percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
}

/**
 * Вычисление процента изменения
 * @param {number} oldValue - старое значение
 * @param {number} newValue - новое значение
 * @returns {number} - процент изменения
 */
export function calculatePercentChange(oldValue, newValue) {
    if (!oldValue || !newValue || oldValue === 0) {
        return 0;
    }
    
    return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Задержка выполнения (Promise-версия setTimeout)
 * @param {number} ms - время задержки в миллисекундах
 * @returns {Promise} - промис, который резолвится после указанной задержки
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Получить строку с разницей во времени (например, "2 часа назад")
 * @param {number} timestamp - timestamp в миллисекундах
 * @param {boolean} short - короткий формат
 * @returns {string} - строка с разницей во времени
 */
export function getTimeAgo(timestamp, short = false) {
    const now = Date.now();
    const diff = now - timestamp;
    
    // Конвертируем разницу в секунды
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
        return short ? `${seconds}с` : `${seconds} ${pluralize(seconds, 'секунда', 'секунды', 'секунд')} назад`;
    }
    
    // Конвертируем в минуты
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return short ? `${minutes}м` : `${minutes} ${pluralize(minutes, 'минута', 'минуты', 'минут')} назад`;
    }
    
    // Конвертируем в часы
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return short ? `${hours}ч` : `${hours} ${pluralize(hours, 'час', 'часа', 'часов')} назад`;
    }
    
    // Конвертируем в дни
    const days = Math.floor(hours / 24);
    if (days < 30) {
        return short ? `${days}д` : `${days} ${pluralize(days, 'день', 'дня', 'дней')} назад`;
    }
    
    // Для более длительных периодов просто возвращаем дату
    return formatDateTime(timestamp, false);
}

/**
 * Функция для правильного склонения слов в зависимости от числа
 * @param {number} count - число
 * @param {string} form1 - форма для 1 (день)
 * @param {string} form2 - форма для 2-4 (дня)
 * @param {string} form5 - форма для 5+ (дней)
 * @returns {string} - правильная форма слова
 */
export function pluralize(count, form1, form2, form5) {
    const remainder = Math.abs(count) % 100;
    
    if (remainder >= 11 && remainder <= 19) {
        return form5;
    }
    
    const lastDigit = remainder % 10;
    
    if (lastDigit === 1) {
        return form1;
    }
    
    if (lastDigit >= 2 && lastDigit <= 4) {
        return form2;
    }
    
    return form5;
}