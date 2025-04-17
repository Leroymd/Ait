// utils/data-validator.js - Модуль валидации и обработки данных для графиков

/**
 * Валидация и предобработка данных свечей
 * @param {Array} candleData - Массив данных свечей
 * @returns {Object} Объект с результатом валидации и обработанными данными
 */
export function validateAndProcessCandleData(candleData) {
    if (!candleData || !Array.isArray(candleData) || candleData.length === 0) {
        return {
            isValid: false,
            data: [],
            message: 'Отсутствуют данные свечей'
        };
    }

    const validatedData = [];
    const invalidData = [];
    let hasPriceData = false;
    
    // Проходим по каждой свече и валидируем её
    candleData.forEach((candle, index) => {
        // Проверяем наличие всех необходимых полей
        if (!candle || typeof candle !== 'object') {
            invalidData.push({ index, reason: 'Некорректная структура данных свечи', candle });
            return;
        }
        
        // Проверяем наличие времени открытия
        if (!candle.openTime && candle.openTime !== 0) {
            // Пробуем найти альтернативные поля для времени
            if (candle.time) {
                candle.openTime = typeof candle.time === 'string' ? new Date(candle.time).getTime() : candle.time;
            } else if (candle.timestamp) {
                candle.openTime = typeof candle.timestamp === 'string' ? new Date(candle.timestamp).getTime() : candle.timestamp;
            } else if (candle.date) {
                candle.openTime = typeof candle.date === 'string' ? new Date(candle.date).getTime() : candle.date;
            } else {
                invalidData.push({ index, reason: 'Отсутствует время открытия', candle });
                return;
            }
        }
        
        // Преобразуем время в число, если оно в виде строки
        if (typeof candle.openTime === 'string') {
            candle.openTime = new Date(candle.openTime).getTime();
        }
        
        // Проверяем, что время открытия - это число
        if (isNaN(candle.openTime)) {
            invalidData.push({ index, reason: 'Некорректное время открытия', candle });
            return;
        }
        
        // Проверяем наличие обязательных полей цены
        let hasPrice = true;
        
        // Проверяем и преобразуем цену открытия
        if (candle.open === undefined || candle.open === null) {
            hasPrice = false;
        } else {
            candle.open = parseFloat(candle.open);
            if (isNaN(candle.open)) {
                hasPrice = false;
            }
        }
        
        // Проверяем и преобразуем максимальную цену
        if (candle.high === undefined || candle.high === null) {
            hasPrice = false;
        } else {
            candle.high = parseFloat(candle.high);
            if (isNaN(candle.high)) {
                hasPrice = false;
            }
        }
        
        // Проверяем и преобразуем минимальную цену
        if (candle.low === undefined || candle.low === null) {
            hasPrice = false;
        } else {
            candle.low = parseFloat(candle.low);
            if (isNaN(candle.low)) {
                hasPrice = false;
            }
        }
        
        // Проверяем и преобразуем цену закрытия
        if (candle.close === undefined || candle.close === null) {
            hasPrice = false;
        } else {
            candle.close = parseFloat(candle.close);
            if (isNaN(candle.close)) {
                hasPrice = false;
            }
        }
        
        // Если нет данных о цене, отбрасываем свечу
        if (!hasPrice) {
            invalidData.push({ index, reason: 'Отсутствуют или некорректны данные о цене', candle });
            return;
        }
        
        hasPriceData = true;
        
        // Проверяем логическую корректность цен (high >= max(open, close) >= min(open, close) >= low)
        if (candle.high < Math.max(candle.open, candle.close) || 
            candle.low > Math.min(candle.open, candle.close) ||
            candle.high < candle.low) {
            
            // Исправляем данные, если это возможно
            const fixedCandle = fixInconsistentCandleData(candle);
            validatedData.push(fixedCandle);
            return;
        }
        
        // Преобразуем объем, если он есть
        if (candle.volume !== undefined && candle.volume !== null) {
            candle.volume = parseFloat(candle.volume);
            if (isNaN(candle.volume)) {
                candle.volume = 0;
            }
        } else {
            candle.volume = 0;
        }
        
        // Добавляем closeTime, если его нет
        if (!candle.closeTime) {
            // По умолчанию closeTime = openTime + интервал (например, 1 минута)
            const interval = 60000; // 1 минута в миллисекундах
            candle.closeTime = candle.openTime + interval - 1;
        }
        
        // Добавляем проверенную свечу в массив
        validatedData.push(candle);
    });
    
    // Сортируем данные по времени открытия (от старых к новым)
    validatedData.sort((a, b) => a.openTime - b.openTime);
    
    return {
        isValid: hasPriceData && validatedData.length > 0,
        data: validatedData,
        invalidData: invalidData,
        message: validatedData.length > 0 
            ? `Успешно обработано ${validatedData.length} свечей` 
            : 'Нет валидных данных для отображения'
    };
}

/**
 * Исправление несогласованных данных свечи
 * @param {Object} candle - Данные свечи для исправления
 * @returns {Object} Исправленные данные свечи
 */
function fixInconsistentCandleData(candle) {
    const fixedCandle = { ...candle };
    
    // Исправляем high, если он меньше максимального значения open и close
    const maxOpenClose = Math.max(fixedCandle.open, fixedCandle.close);
    if (fixedCandle.high < maxOpenClose) {
        fixedCandle.high = maxOpenClose;
    }
    
    // Исправляем low, если он больше минимального значения open и close
    const minOpenClose = Math.min(fixedCandle.open, fixedCandle.close);
    if (fixedCandle.low > minOpenClose) {
        fixedCandle.low = minOpenClose;
    }
    
    // Проверяем, что high >= low
    if (fixedCandle.high < fixedCandle.low) {
        // Меняем местами high и low
        const temp = fixedCandle.high;
        fixedCandle.high = fixedCandle.low;
        fixedCandle.low = temp;
    }
    
    return fixedCandle;
}

/**
 * Проверка валидности данных одной свечи
 * @param {Object} candle - Данные одной свечи
 * @returns {boolean} - Результат проверки
 */
export function isValidCandle(candle) {
    if (!candle || typeof candle !== 'object') {
        return false;
    }
    
    // Проверяем наличие всех необходимых полей
    if (candle.openTime === undefined || 
        candle.open === undefined || 
        candle.high === undefined || 
        candle.low === undefined || 
        candle.close === undefined) {
        return false;
    }
    
    // Проверяем, что все значения - числа
    if (isNaN(parseFloat(candle.openTime)) || 
        isNaN(parseFloat(candle.open)) || 
        isNaN(parseFloat(candle.high)) || 
        isNaN(parseFloat(candle.low)) || 
        isNaN(parseFloat(candle.close))) {
        return false;
    }
    
    // Проверяем логическую корректность цен
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    
    return high >= Math.max(open, close) && 
           low <= Math.min(open, close) && 
           high >= low;
}

/**
 * Преобразование данных из формата Binance в стандартный формат свечей
 * @param {Array} binanceData - Данные в формате Binance API
 * @returns {Array} Данные в стандартном формате свечей
 */
export function convertBinanceDataToStandardFormat(binanceData) {
    if (!binanceData || !Array.isArray(binanceData)) {
        return [];
    }
    
    return binanceData.map(kline => {
        // Формат данных от Binance API: 
        // [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, trades, ...]
        return {
            openTime: kline[0],
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5]),
            closeTime: kline[6],
            quoteVolume: parseFloat(kline[7]),
            trades: kline[8]
        };
    });
}

/**
 * Преобразование данных из формата Bybit в стандартный формат свечей
 * @param {Object} bybitData - Данные в формате Bybit API
 * @returns {Array} Данные в стандартном формате свечей
 */
export function convertBybitDataToStandardFormat(bybitData) {
    if (!bybitData || !bybitData.result || !Array.isArray(bybitData.result)) {
        return [];
    }
    
    return bybitData.result.map(item => {
        // Bybit формат (пример):
        // { start_at: 1609459200, open: "29026.40", high: "29200.00", low: "28953.00", close: "29024.00", volume: "1.334" }
        return {
            openTime: item.start_at * 1000, // Переводим секунды в миллисекунды
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume),
            closeTime: (item.start_at + (item.interval ? parseInt(item.interval) : 60)) * 1000 - 1
        };
    }).sort((a, b) => a.openTime - b.openTime); // Сортируем по времени
}

/**
 * Обработчик WebSocket-сообщений для обновления графика
 * @param {Object} message - Сообщение от WebSocket
 * @returns {Object|null} Обработанные данные свечи или null, если данные некорректны
 */
export function processWebSocketCandleUpdate(message) {
    // Варианты форматов сообщений от разных источников
    let candleData = null;
    
    try {
        // Формат Binance
        if (message.k) {
            const kline = message.k;
            candleData = {
                openTime: typeof kline.t === 'number' ? kline.t : parseInt(kline.t),
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
                volume: parseFloat(kline.v),
                closeTime: typeof kline.T === 'number' ? kline.T : parseInt(kline.T)
            };
        }
        // Формат собственного API
        else if (message.openTime && message.open !== undefined) {
            candleData = {
                openTime: typeof message.openTime === 'number' ? message.openTime : parseInt(message.openTime),
                open: parseFloat(message.open),
                high: parseFloat(message.high),
                low: parseFloat(message.low),
                close: parseFloat(message.close),
                volume: message.volume ? parseFloat(message.volume) : 0,
                closeTime: message.closeTime ? 
                    (typeof message.closeTime === 'number' ? message.closeTime : parseInt(message.closeTime)) : 
                    (typeof message.openTime === 'number' ? message.openTime : parseInt(message.openTime)) + 60000 - 1
            };
        }
        // Обработка массива свечей
        else if (Array.isArray(message)) {
            // Берем последнюю свечу из массива
            const lastCandle = message[message.length - 1];
            if (lastCandle) {
                candleData = {
                    openTime: lastCandle.openTime || lastCandle.time || Date.now(),
                    open: parseFloat(lastCandle.open),
                    high: parseFloat(lastCandle.high),
                    low: parseFloat(lastCandle.low),
                    close: parseFloat(lastCandle.close),
                    volume: lastCandle.volume ? parseFloat(lastCandle.volume) : 0,
                    closeTime: lastCandle.closeTime || lastCandle.openTime + 60000 - 1
                };
            }
        }
        
        // Проверяем валидность данных
        if (candleData && isValidCandle(candleData)) {
            return candleData;
        }
        
        console.warn('Получены некорректные данные свечи:', message);
        return null;
    } catch (error) {
        console.error('Ошибка при обработке данных свечи:', error);
        return null;
    }
}