// chart.js - Улучшенный модуль для работы с графиками

import { state, elements } from './app.js';
import { handleError, generateMockChartData } from './utils1.js';
import { validateAndProcessCandleData, isValidCandle } from './utils/data-validator.js';

// Объявляем переменные для графика
let chart = null;
let candleSeries = null;
let volumeSeries = null;
let indicators = {};

/**
 * Инициализация графика
 */
export function initChart() {
    try {
        console.log('Инициализация графика...');
        if (!elements.tradingChart) {
            console.error('Элемент графика не найден');
            return false;
        }

        // Проверяем, доступна ли библиотека LightweightCharts
        if (typeof LightweightCharts === 'undefined') {
            console.error('Библиотека LightweightCharts не загружена');
            createFallbackChart();
            return false;
        }

        // Очищаем контейнер перед созданием нового графика
        elements.tradingChart.innerHTML = '';

        // Создаем экземпляр графика
        chart = LightweightCharts.createChart(elements.tradingChart, {
            width: elements.tradingChart.clientWidth,
            height: elements.tradingChart.clientHeight,
            layout: {
                backgroundColor: '#ffffff',
                textColor: '#333333',
                fontSize: 12,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif'
            },
            grid: {
                vertLines: {
                    color: 'rgba(225, 226, 230, 0.3)',
                    style: 1,
                    visible: true
                },
                horzLines: {
                    color: 'rgba(225, 226, 230, 0.3)',
                    style: 1,
                    visible: true
                },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: {
                    width: 1,
                    color: 'rgba(32, 38, 46, 0.5)',
                    style: 0
                },
                horzLine: {
                    width: 1,
                    color: 'rgba(32, 38, 46, 0.5)',
                    style: 0
                }
            },
            timeScale: {
                borderColor: 'rgba(225, 226, 230, 0.85)',
                timeVisible: true,
                secondsVisible: false,
                borderVisible: true,
                barSpacing: 6,
            },
            rightPriceScale: {
                borderColor: 'rgba(225, 226, 230, 0.85)',
                borderVisible: true,
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2,
                },
            },
            watermark: {
                color: 'rgba(0, 0, 0, 0.05)',
                visible: true,
                text: state.tradingPair || 'CRYPTO',
                fontSize: 36,
                horzAlign: 'center',
                vertAlign: 'center',
            }
        });

        // Создаем серию свечей
        candleSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderUpColor: '#26a69a',
            borderDownColor: '#ef5350',
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            priceFormat: {
                type: 'price',
                precision: getPrecisionForPair(state.tradingPair),
                minMove: getMinMoveForPair(state.tradingPair),
            }
        });

        // Добавляем серию объемов
        addVolumeSeries();

        // Добавляем обработчик прокрутки для подгрузки истории
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleTimeRangeChange);

        // Обработчик изменения размера окна
        window.addEventListener('resize', handleResize);

        console.log('График успешно инициализирован');
        return true;
    } catch (error) {
        console.error('Ошибка при инициализации графика:', error);
        // Создаем резервный график при ошибке
        createFallbackChart();
        return false;
    }
}

/**
 * Обработчик изменения видимого диапазона времени
 * @param {Object} logicalRange - Видимый логический диапазон
 */
function handleTimeRangeChange(logicalRange) {
    if (!logicalRange || !state.chartData || state.chartData.length === 0) {
        return;
    }
    
    // Проверяем, достигли ли мы левой границы данных
    const barsCount = state.chartData.length;
    
    // Если видимый логический диапазон начинается близко к 0, значит мы почти в начале данных
    // Загружаем дополнительные исторические данные
    if (logicalRange.from < 5) { // Если видимы первые 5 свечей
        loadHistoricalData();
    }
}

/**
 * Загрузка исторических данных
 */
function loadHistoricalData() {
    // Защита от множественных запросов
    if (state.loadingHistoricalData) {
        return;
    }
    
    state.loadingHistoricalData = true;
    
    try {
        if (!state.chartData || state.chartData.length === 0) {
            state.loadingHistoricalData = false;
            return;
        }
        
        // Берем время первой (самой старой) свечи как endTime для следующего запроса
        const oldestCandle = state.chartData[0];
        const endTime = oldestCandle.openTime;
        
        console.log('Загрузка исторических данных с endTime:', new Date(endTime));
        
        // Импортируем функцию loadChartData из app.js
        import('./app.js').then(appModule => {
            appModule.loadChartData(endTime).then(() => {
                state.loadingHistoricalData = false;
            }).catch(error => {
                console.error('Ошибка при загрузке исторических данных:', error);
                state.loadingHistoricalData = false;
            });
        }).catch(error => {
            console.error('Ошибка при импорте модуля app.js:', error);
            state.loadingHistoricalData = false;
        });
    } catch (error) {
        console.error('Ошибка при загрузке исторических данных:', error);
        state.loadingHistoricalData = false;
    }
}

/**
 * Подгоняет содержимое графика к видимой области
 */
export function fitVisibleContent() {
    if (chart && chart.timeScale) {
        chart.timeScale().fitContent();
    }
}

/**
 * Очистка данных графика без пересоздания графика
 */
export function clearChartData() {
    if (candleSeries) {
        candleSeries.setData([]);
    }
    
    if (volumeSeries) {
        volumeSeries.setData([]);
    }
}

/**
 * Полное пересоздание графика
 */
export function resetChart() {
    // Очищаем обработчики и ресурсы
    cleanup();
    
    // Пересоздаем график
    return initChart();
}

/**
 * Получить точность отображения цены для пары
 * @param {string} pair - торговая пара
 * @returns {number} - количество знаков после запятой
 */
function getPrecisionForPair(pair) {
    if (!pair) return 2;
    
    // Определяем точность в зависимости от пары
    if (pair.includes('BTC')) {
        return 1;
    } else if (pair.includes('ETH')) {
        return 2;
    } else if (pair.includes('DOGE') || pair.includes('SHIB')) {
        return 6;
    } else {
        return 2;
    }
}

/**
 * Получить минимальное изменение цены для пары
 * @param {string} pair - торговая пара
 * @returns {number} - минимальное изменение цены
 */
function getMinMoveForPair(pair) {
    if (!pair) return 0.01;
    
    // Определяем минимальное изменение в зависимости от пары
    if (pair.includes('BTC')) {
        return 0.1;
    } else if (pair.includes('ETH')) {
        return 0.01;
    } else if (pair.includes('DOGE') || pair.includes('SHIB')) {
        return 0.000001;
    } else {
        return 0.01;
    }
}

/**
 * Добавление серии объемов
 */
function addVolumeSeries() {
    if (!chart) return null;
    
    // Очищаем предыдущую серию объемов, если она существует
    if (volumeSeries) {
        chart.removeSeries(volumeSeries);
        volumeSeries = null;
    }
    
    // Создаем новую серию объемов
    volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '',
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });
    
    return volumeSeries;
}

/**
 * Обработчик изменения размера окна
 */
function handleResize() {
    if (chart && elements.tradingChart) {
        const width = elements.tradingChart.clientWidth;
        const height = elements.tradingChart.clientHeight;
        
        if (width > 0 && height > 0) {
            chart.resize(width, height);
        }
    }
}

/**
 * Обновление данных графика
 * @param {Array} chartData - Массив данных свечей для отображения
 */
export function updateChart(chartData) {
    try {
        if (!chart || !candleSeries) {
            console.warn('График или серия свечей не инициализированы');
            return;
        }

        if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
            console.warn('Получены некорректные данные графика:', chartData);
            return;
        }

        // Валидируем и обрабатываем данные
        const processedData = validateAndProcessCandleData(chartData);
        if (!processedData.isValid) {
            console.warn(processedData.message);
            return;
        }

        // Используем проверенные данные
        const validatedData = processedData.data;
        
        if (processedData.invalidData.length > 0) {
            console.log(`Отфильтровано ${processedData.invalidData.length} некорректных данных из ${chartData.length}`);
        }

        // Преобразуем данные в формат, понятный графику
        const formattedData = validatedData.map(candle => ({
            time: Math.floor(candle.openTime / 1000), // Convert to seconds
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: candle.volume ? parseFloat(candle.volume) : undefined
        }));

        // Устанавливаем данные для свечей
        candleSeries.setData(formattedData);
        
        // Устанавливаем данные для объемов, если они есть
        if (volumeSeries) {
            const volumeData = formattedData.map(candle => ({
                time: candle.time,
                value: candle.volume || 0,
                color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
            }));
            volumeSeries.setData(volumeData);
        }
        
        // Подгоняем масштаб времени
        chart.timeScale().fitContent();
        
        // Обновляем водяной знак с торговой парой
        if (chart.applyOptions) {
            chart.applyOptions({
                watermark: {
                    text: state.tradingPair,
                    visible: true
                }
            });
        }
        
        // Сохраняем данные в состоянии
        state.chartData = validatedData;
        
        console.log(`Обновлены данные графика (${formattedData.length} свечей)`);
    } catch (error) {
        console.error('Ошибка при обновлении графика:', error);
        handleError('Произошла ошибка при обновлении графика');
    }
}

/**
 * Добавление новой свечи или обновление последней
 * @param {Object} candleData - Данные новой/обновленной свечи
 */
export function updateLastCandle(candleData) {
    try {
        if (!candleSeries) {
            console.warn('Серия свечей не инициализирована');
            return;
        }

        if (!candleData) {
            console.warn('Получены некорректные данные свечи');
            return;
        }

        // Проверяем, что openTime - это число
        const openTimeAsNumber = typeof candleData.openTime === 'number' 
            ? candleData.openTime 
            : new Date(candleData.openTime).getTime();

        // Форматируем данные свечи
        const formattedCandle = {
            time: Math.floor(openTimeAsNumber / 1000), // Конвертируем в секунды и убеждаемся, что это число
            open: parseFloat(candleData.open),
            high: parseFloat(candleData.high),
            low: parseFloat(candleData.low),
            close: parseFloat(candleData.close)
        };

        // Дополнительно проверяем, что time - это действительно число
        if (typeof formattedCandle.time !== 'number' || isNaN(formattedCandle.time)) {
            console.warn('Некорректное время свечи:', formattedCandle.time, candleData.openTime);
            return;
        }

        // Валидируем данные свечи
        if (formattedCandle.high < formattedCandle.low || isNaN(formattedCandle.open) || 
            isNaN(formattedCandle.high) || isNaN(formattedCandle.low) || isNaN(formattedCandle.close)) {
            console.warn('Некорректные данные свечи, пропускаем обновление:', formattedCandle);
            return;
        }

        // Обновляем последнюю свечу
        candleSeries.update(formattedCandle);
        
        // Обновляем объем, если есть данные
        if (volumeSeries && candleData.volume !== undefined) {
            volumeSeries.update({
                time: formattedCandle.time,
                value: parseFloat(candleData.volume),
                color: formattedCandle.close >= formattedCandle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
            });
        }

        // Обновляем в состоянии последнюю свечу
        if (state.chartData && state.chartData.length > 0) {
            const lastIndex = state.chartData.length - 1;
            const lastCandleTime = state.chartData[lastIndex].openTime;
            
            if (lastCandleTime === candleData.openTime) {
                // Обновляем существующую свечу
                state.chartData[lastIndex] = candleData;
            } else {
                // Добавляем новую свечу
                state.chartData.push(candleData);
                
                // Удаляем старую, если массив слишком большой
                if (state.chartData.length > 500) {
                    state.chartData.shift();
                }
            }
        }
    } catch (error) {
        console.error('Ошибка при обновлении последней свечи:', error);
    }
}

/**
 * Создание резервного графика при ошибке
 */
export function createFallbackChart() {
    console.log('Создание резервного графика...');
    
    try {
        // Проверяем наличие элемента графика
        if (!elements.tradingChart) {
            console.error('Элемент графика не найден');
            return;
        }
        
        // Очищаем элемент графика
        elements.tradingChart.innerHTML = '';
        
        // Создаем контейнер для canvas
        const canvasContainer = document.createElement('div');
        canvasContainer.style.width = '100%';
        canvasContainer.style.height = '100%';
        canvasContainer.style.display = 'flex';
        canvasContainer.style.justifyContent = 'center';
        canvasContainer.style.alignItems = 'center';
        canvasContainer.style.backgroundColor = '#f8f9fa';
        canvasContainer.style.border = '1px solid #ddd';
        canvasContainer.style.borderRadius = '5px';
        
        // Создаем canvas элемент
        const canvas = document.createElement('canvas');
        canvas.id = 'fallback-chart';
        canvas.width = elements.tradingChart.clientWidth;
        canvas.height = elements.tradingChart.clientHeight;
        
        // Добавляем canvas в контейнер
        canvasContainer.appendChild(canvas);
        
        // Добавляем контейнер в элемент графика
        elements.tradingChart.appendChild(canvasContainer);
        
        // Генерируем тестовые данные
        const mockData = generateMockChartData(100, state.tradingPair);
        
        // Отрисовываем простой график на canvas
        drawSimpleChart(canvas, mockData);

        // Сохраняем данные в состоянии
        state.chartData = mockData;
        
        console.log('Резервный график создан успешно');
    } catch (error) {
        console.error('Ошибка при создании резервного графика:', error);
        
        // В случае критической ошибки, просто показываем сообщение
        if (elements.tradingChart) {
            elements.tradingChart.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; background-color: #f8f9fa; border: 1px solid #ddd; border-radius: 5px;">
                    <div style="text-align: center;">
                        <p>Не удалось отобразить график</p>
                        <button id="retry-chart" class="btn btn-primary">Повторить</button>
                    </div>
                </div>
            `;
            
            // Добавляем обработчик для кнопки повтора
            document.getElementById('retry-chart')?.addEventListener('click', () => {
                initChart();
            });
        }
    }
}

/**
 * Отрисовка простого графика на canvas
 * @param {HTMLCanvasElement} canvas - Canvas элемент для отрисовки
 * @param {Array} data - Массив данных свечей
 */
function drawSimpleChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Очищаем canvas
    ctx.clearRect(0, 0, width, height);
    
    // Находим минимальное и максимальное значение цены
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    data.forEach(candle => {
        minPrice = Math.min(minPrice, candle.low);
        maxPrice = Math.max(maxPrice, candle.high);
    });
    
    // Добавляем отступ 10%
    const range = maxPrice - minPrice;
    minPrice -= range * 0.1;
    maxPrice += range * 0.1;
    
    // Вычисляем масштаб
    const priceScale = height / (maxPrice - minPrice);
    const timeScale = width / data.length;
    
    // Отрисовываем сетку
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    
    // Горизонтальные линии
    for (let i = 0; i <= 5; i++) {
        const y = height - (i / 5) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Подписи цен
        const price = minPrice + (i / 5) * (maxPrice - minPrice);
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.fillText(price.toFixed(2), 5, y - 5);
    }
    
    // Отрисовываем свечи
    data.forEach((candle, index) => {
        const x = index * timeScale;
        const candleWidth = Math.max(timeScale * 0.8, 1);
        
        const openY = height - (candle.open - minPrice) * priceScale;
        const closeY = height - (candle.close - minPrice) * priceScale;
        const highY = height - (candle.high - minPrice) * priceScale;
        const lowY = height - (candle.low - minPrice) * priceScale;
        
        // Определяем цвет свечи
        const isUp = candle.close >= candle.open;
        ctx.fillStyle = isUp ? '#28a745' : '#dc3545';
        ctx.strokeStyle = isUp ? '#28a745' : '#dc3545';
        
        // Рисуем тело свечи
        ctx.fillRect(x, Math.min(openY, closeY), candleWidth, Math.abs(closeY - openY) || 1);
        
        // Рисуем верхнюю и нижнюю тени
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, Math.min(openY, closeY));
        ctx.moveTo(x + candleWidth / 2, Math.max(openY, closeY));
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();
    });
    
    // Подписи осей
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText('Цена', 5, 15);
    ctx.fillText('Время', width - 50, height - 5);
}

/**
 * Добавление индикатора скользящей средней
 * @param {number} period - период индикатора
 * @param {string} color - цвет линии
 */
export function addMovingAverage(period = 20, color = '#2962FF') {
    if (!chart || !candleSeries || !state.chartData || state.chartData.length === 0) {
        console.warn('График не инициализирован или нет данных');
        return null;
    }
    
    const indicatorId = `ma${period}`;
    
    // Удаляем старый индикатор, если он есть
    if (indicators[indicatorId]) {
        chart.removeSeries(indicators[indicatorId]);
        delete indicators[indicatorId];
    }
    
    // Создаем серию для MA
    const maSeries = chart.addLineSeries({
        color: color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
        title: `MA(${period})`,
    });
    
    // Рассчитываем значения MA
    const maData = [];
    const data = state.chartData;
    
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        
        const maValue = sum / period;
        maData.push({
            time: Math.floor(data[i].openTime / 1000),
            value: maValue
        });
    }
    
    // Устанавливаем данные
    maSeries.setData(maData);
    
    // Сохраняем индикатор
    indicators[indicatorId] = maSeries;
    
    return maSeries;
}

/**
 * Очистка всех индикаторов с графика
 */
export function clearIndicators() {
    if (!chart) return;
    
    for (const id in indicators) {
        if (indicators[id]) {
            chart.removeSeries(indicators[id]);
            delete indicators[id];
        }
    }
}

/**
 * Очистка графика
 */
export function cleanup() {
    window.removeEventListener('resize', handleResize);
    
    if (chart) {
        // Отписываемся от событий
        if (chart.timeScale) {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleTimeRangeChange);
        }
        
        // Очищаем индикаторы
        clearIndicators();
        
        // Очищаем серии
        if (volumeSeries) {
            try {
                chart.removeSeries(volumeSeries);
            } catch(e) {
                console.warn('Ошибка при удалении серии объемов:', e);
            }
            volumeSeries = null;
        }
        
        if (candleSeries) {
            try {
                chart.removeSeries(candleSeries);
            } catch(e) {
                console.warn('Ошибка при удалении серии свечей:', e);
            }
            candleSeries = null;
        }
        
        // Удаляем график
        try {
            chart.remove();
        } catch(e) {
            console.warn('Ошибка при удалении графика:', e);
        }
        chart = null;
    }
    
    // Очищаем элемент графика, если он существует
    if (elements.tradingChart) {
        elements.tradingChart.innerHTML = '';
    }
}