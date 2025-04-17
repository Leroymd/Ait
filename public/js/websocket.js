// websocket.js - Модуль обработки WebSocket подключений

import { state, elements } from './app.js';
import { updateLastCandle } from './chart.js';
import { handleError, showToast } from './utils1.js';
import { processWebSocketCandleUpdate } from './utils/data-validator.js';

let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

/**
 * Инициализация WebSocket соединения
 */
export function initWebSocket() {
    try {
        console.log('Инициализация WebSocket подключения...');
        
        // Проверяем поддержку WebSocket
        if (!window.WebSocket) {
            throw new Error('WebSocket не поддерживается вашим браузером');
        }
        
        // Создаем WebSocket соединение
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${protocol}://${window.location.host}/ws`;
        
        // Закрываем предыдущее соединение, если оно есть
        if (ws) {
            cleanup();
        }
        
        // Создаем новое соединение
        ws = new WebSocket(wsUrl);
        
        // Устанавливаем обработчики событий
        ws.onopen = handleWSOpen;
        ws.onmessage = handleWSMessage;
        ws.onerror = handleWSError;
        ws.onclose = handleWSClose;
        
        // Обновляем статус
        updateWSStatus('connecting');
        
        return true;
    } catch (error) {
        console.error('Ошибка инициализации WebSocket:', error);
        handleError('Не удалось инициализировать WebSocket подключение');
        updateWSStatus('error');
        return false;
    }
}

/**
 * Обработчик открытия WebSocket соединения
 */
function handleWSOpen() {
    console.log('WebSocket соединение установлено');
    state.connected = true;
    updateWSStatus('connected');
    
    // Сбрасываем счетчик попыток переподключения
    reconnectAttempts = 0;
    
    // Запускаем пинг для поддержания соединения
    startPing();
    
    // Загружаем начальные данные
    import('./app.js').then(appModule => {
        appModule.loadInitialData();
    }).catch(error => {
        console.error('Ошибка при импорте модуля app.js:', error);
    });
    
    // Показываем уведомление
    showToast('Подключение к серверу установлено', 'success');
}

/**
 * Обработчик сообщений WebSocket
 * @param {MessageEvent} event - событие сообщения
 */
function handleWSMessage(event) {
    try {
        const message = JSON.parse(event.data);
        
        // Обработка разных типов сообщений
        switch (message.type) {
            case 'INITIAL_STATE':
                handleInitialState(message.payload);
                break;
            case 'EXCHANGE_CHANGED':
                handleExchangeChanged(message.payload);
                break;
            case 'TRADING_PAIR_CHANGED':
                handlePairChanged(message.payload);
                break;
            case 'CHART_UPDATE':
                handleChartUpdate(message.payload);
                break;
            case 'ERROR':
                handleWSError(message.error);
                break;
            case 'MODULE_STATUS_CHANGED':
                handleModuleStatusChanged(message.payload);
                break;
            case 'PONG':
                // Ответ на пинг, ничего делать не нужно
                break;
            default:
                // Логируем неизвестные сообщения для отладки
                console.log('Получено неизвестное сообщение:', message);
        }
    } catch (error) {
        console.error('Ошибка обработки сообщения WebSocket:', error);
        console.log('Сырое сообщение:', event.data);
    }
}

/**
 * Обработчик ошибок WebSocket
 * @param {Event|string} error - ошибка
 */
function handleWSError(error) {
    console.error('Ошибка WebSocket:', error);
    updateWSStatus('error');
}

/**
 * Обработчик закрытия WebSocket соединения
 * @param {CloseEvent} event - событие закрытия
 */
function handleWSClose(event) {
    console.log(`WebSocket соединение закрыто: ${event.code} ${event.reason}`);
    state.connected = false;
    updateWSStatus('disconnected');
    
    // Останавливаем пинг
    clearInterval(pingInterval);
    pingInterval = null;
    
    // Пытаемся переподключиться, если соединение закрылось не нормально
    if (event.code !== 1000 && event.code !== 1001) {
        attemptReconnect();
    }
}

/**
 * Попытка переподключения
 */
function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('Достигнуто максимальное количество попыток переподключения');
        handleError('Не удалось подключиться к серверу после нескольких попыток');
        return;
    }
    
    // Увеличиваем счетчик попыток
    reconnectAttempts++;
    
    // Обновляем статус
    updateWSStatus('reconnecting');
    
    // Запускаем таймер переподключения
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
        console.log(`Попытка переподключения ${reconnectAttempts}...`);
        initWebSocket();
    }, RECONNECT_DELAY * reconnectAttempts);
}

/**
 * Обработка начального состояния
 * @param {Object} payload - данные состояния
 */
function handleInitialState(payload) {
    console.log('Получено начальное состояние:', payload);
    
    // Обновляем состояние приложения
    if (payload.exchange) {
        state.exchange = payload.exchange;
    }
    
    if (payload.tradingPair) {
        state.tradingPair = payload.tradingPair;
    }
    
    // Обновляем UI элементы
    if (elements.exchangeSelect && state.exchange) {
        elements.exchangeSelect.value = state.exchange;
    }
    
    if (elements.pairSelect && state.tradingPair) {
        elements.pairSelect.value = state.tradingPair;
    }
    
    // Обновляем текущую пару
    if (elements.currentPair && state.tradingPair) {
        elements.currentPair.textContent = state.tradingPair;
    }
    
    // Загружаем модули
    if (payload.modules && Array.isArray(payload.modules)) {
        import('./modules.js').then(modulesModule => {
            modulesModule.updateModulesList(payload.modules);
        }).catch(error => {
            console.error('Ошибка при импорте модуля modules.js:', error);
        });
    }
}

/**
 * Обработка изменения биржи
 * @param {Object} payload - данные об изменении биржи
 */
function handleExchangeChanged(payload) {
    console.log('Биржа изменена:', payload);
    
    if (payload.exchange) {
        state.exchange = payload.exchange;
        
        // Обновляем UI элементы
        if (elements.exchangeSelect) {
            elements.exchangeSelect.value = payload.exchange;
        }
        
        // Показываем уведомление
        showToast(`Биржа изменена на ${payload.exchange}`, 'info');
        
        // Загружаем список торговых пар для новой биржи
        import('./app.js').then(appModule => {
            appModule.loadTradingPairs();
        }).catch(error => {
            console.error('Ошибка при импорте модуля app.js:', error);
        });
    }
}

/**
 * Обработка изменения торговой пары
 * @param {Object} payload - данные об изменении торговой пары
 */
function handlePairChanged(payload) {
    console.log('Торговая пара изменена:', payload);
    
    if (payload.pair) {
        state.tradingPair = payload.pair;
        
        // Обновляем UI элементы
        if (elements.pairSelect) {
            elements.pairSelect.value = payload.pair;
        }
        
        if (elements.currentPair) {
            elements.currentPair.textContent = payload.pair;
        }
        
        // Показываем уведомление
        showToast(`Торговая пара изменена на ${payload.pair}`, 'info');
        
        // Загружаем данные графика для новой пары
        import('./app.js').then(appModule => {
            appModule.loadChartData();
        }).catch(error => {
            console.error('Ошибка при импорте модуля app.js:', error);
        });
    }
}

/**
 * Обработка обновления графика
 * @param {Object} payload - данные обновления графика
 */
function handleChartUpdate(payload) {
    if (!payload) {
        console.warn('Получен пустой payload обновления графика');
        return;
    }
    
    try {
        // Обрабатываем данные свечи с использованием универсального обработчика
        const candleData = processWebSocketCandleUpdate(payload);
        
        if (!candleData) {
            console.warn('Не удалось обработать данные свечи:', payload);
            return;
        }
        
        // Обновляем последнюю свечу на графике
        updateLastCandle(candleData);
        
        // Обновляем данные в состоянии
        if (state.chartData && state.chartData.length > 0) {
            const lastCandle = state.chartData[state.chartData.length - 1];
            
            if (lastCandle.openTime === candleData.openTime) {
                // Обновляем существующую свечу
                state.chartData[state.chartData.length - 1] = candleData;
            } else {
                // Добавляем новую свечу
                state.chartData.push(candleData);
                
                // Удаляем первую свечу, если достигнут лимит
                if (state.chartData.length > 500) {
                    state.chartData.shift();
                }
            }
        }
    } catch (error) {
        console.error('Ошибка обработки обновления графика:', error);
    }
}

/**
 * Обработка изменения статуса модуля
 * @param {Object} payload - данные об изменении статуса модуля
 */
function handleModuleStatusChanged(payload) {
    console.log('Изменен статус модуля:', payload);
    
    // Обновляем список модулей
    import('./modules.js').then(modulesModule => {
        modulesModule.loadModules();
    }).catch(error => {
        console.error('Ошибка при импорте модуля modules.js:', error);
    });
    
    // Показываем уведомление
    if (payload.id && payload.active !== undefined) {
        const status = payload.active ? 'активирован' : 'деактивирован';
        showToast(`Модуль ${payload.name || payload.id} ${status}`, 'info');
    }
}

/**
 * Отправка WebSocket сообщения
 * @param {Object} message - сообщение для отправки
 */
export function sendWebSocketMessage(message) {
    try {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket не подключен, сообщение не отправлено');
            return false;
        }
        
        ws.send(JSON.stringify(message));
        return true;
    } catch (error) {
        console.error('Ошибка отправки WebSocket сообщения:', error);
        return false;
    }
}

/**
 * Старт пинга для поддержания соединения
 */
function startPing() {
    // Останавливаем предыдущий пинг, если есть
    clearInterval(pingInterval);
    
    // Запускаем новый пинг
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            sendWebSocketMessage({ type: 'PING', timestamp: Date.now() });
        } else {
            clearInterval(pingInterval);
            pingInterval = null;
        }
    }, 30000); // Пинг каждые 30 секунд
}

/**
 * Обновление индикатора статуса WebSocket
 * @param {string} status - статус соединения
 */
function updateWSStatus(status) {
    if (!elements.wsStatus) {
        return;
    }
    
    let statusText, statusColor;
    
    switch (status) {
        case 'connecting':
            statusText = 'Подключение...';
            statusColor = '#f0ad4e'; // Оранжевый
            break;
        case 'connected':
            statusText = 'Подключено';
            statusColor = '#5cb85c'; // Зеленый
            break;
        case 'disconnected':
            statusText = 'Отключено';
            statusColor = '#d9534f'; // Красный
            break;
        case 'error':
            statusText = 'Ошибка';
            statusColor = '#d9534f'; // Красный
            break;
        case 'reconnecting':
            statusText = `Переподключение (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`;
            statusColor = '#f0ad4e'; // Оранжевый
            break;
        default:
            statusText = status;
            statusColor = '#5bc0de'; // Голубой
    }
    
    elements.wsStatus.textContent = `WebSocket: ${statusText}`;
    elements.wsStatus.style.backgroundColor = statusColor;
}

/**
 * Очистка ресурсов WebSocket
 */
export function cleanup() {
    // Останавливаем пинг
    clearInterval(pingInterval);
    pingInterval = null;
    
    // Отменяем переподключение
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
    
    // Закрываем WebSocket, если он существует
    if (ws) {
        // Удаляем обработчики
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        
        // Закрываем соединение, если оно открыто
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close(1000, 'Выгрузка приложения');
        }
        
        ws = null;
    }
    
    // Обновляем статус
    state.connected = false;
    updateWSStatus('disconnected');
}