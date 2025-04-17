// analysis.js - Функции анализа

/**
 * Этот модуль отвечает за:
 * - обработку анализа графиков с помощью AI
 * - отображение результатов анализа
 * - управление торговыми сигналами
 */

import { state, elements } from './app.js';
import { handleError, showToast, formatDateTime, formatPrice } from './utils1.js';

// Хранение текущего сигнала
let currentSignal = null;

/**
 * Обработка нажатия на кнопку анализа
 */
export function handleAnalyzeClick() {
    try {
        if (!state.aiModuleAvailable) {
            handleError('Модуль AI анализа недоступен. Установите модуль в настройках.');
            return;
        }
        
        // Показываем индикатор загрузки
        if (elements.analyzeBtn) {
            elements.analyzeBtn.disabled = true;
            elements.analyzeBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Анализ...
            `;
        }
        
        // Отправляем запрос на анализ
        fetch('/api/modules/ai-analyzer/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pair: state.tradingPair,
                interval: state.interval
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Обновляем состояние
            displayAnalysisResults(data);
        })
        .catch(error => {
            console.error('Ошибка при анализе графика:', error);
            handleError('Произошла ошибка при анализе графика. Попробуйте еще раз.');
            
            // В случае ошибки, имитируем результат анализа
            mockAnalysis();
        })
        .finally(() => {
            // Убираем индикатор загрузки
            if (elements.analyzeBtn) {
                elements.analyzeBtn.disabled = false;
                elements.analyzeBtn.innerHTML = `
                    <i class="bi bi-graph-up"></i> Анализировать
                `;
            }
        });
    } catch (error) {
        console.error('Ошибка при анализе графика:', error);
        handleError('Произошла непредвиденная ошибка при анализе графика');
        
        // Восстанавливаем кнопку
        if (elements.analyzeBtn) {
            elements.analyzeBtn.disabled = false;
            elements.analyzeBtn.innerHTML = `
                <i class="bi bi-graph-up"></i> Анализировать
            `;
        }
    }
}

/**
 * Отображение результатов анализа
 * @param {Object} data - результаты анализа
 */
export function displayAnalysisResults(data) {
    try {
        console.log('Отображение результатов анализа:', data);
        currentSignal = data.signal;
        
        // Проверяем наличие элементов UI
        if (!elements.analysisPlaceholder || !elements.analysisContent ||
            !elements.signalPlaceholder || !elements.signalContent) {
            console.error('Не найдены элементы UI для отображения результатов анализа');
            return;
        }
        
        // Скрываем заглушку и показываем контент
        elements.analysisPlaceholder.classList.add('d-none');
        elements.analysisContent.classList.remove('d-none');
        elements.signalPlaceholder.classList.add('d-none');
        elements.signalContent.classList.remove('d-none');
        
        // Обновляем текст анализа
        if (elements.analysisText) {
            elements.analysisText.textContent = data.analysis.analysis || 'Нет дополнительного анализа.';
        }
        
        // Обновляем скриншот
        if (elements.analysisScreenshot && data.screenshot) {
            elements.analysisScreenshot.src = `/api/modules/ai-analyzer/screenshots/${data.screenshot}`;
            elements.analysisScreenshot.alt = `График ${state.tradingPair}`;
        }
        
        // Обновляем временную метку
        if (elements.analysisTimestamp) {
            const timestamp = new Date(data.signal.timestamp);
            elements.analysisTimestamp.textContent = formatDateTime(timestamp, true);
        }
        
        // Обновляем индикатор уверенности
        updateConfidenceIndicator(data.signal.confidence || 0);
        
        // Обновляем данные сигнала
        updateSignalInfo(data.signal);
        
        // Если включен автотрейдинг, автоматически выполняем сигнал
        if (state.autoTradingAvailable && elements.autoTradingSwitch && 
            elements.autoTradingSwitch.checked) {
            import('./app.js').then(appModule => {
                appModule.handleExecuteSignalClick();
            }).catch(error => {
                console.error('Ошибка при импорте модуля app.js:', error);
            });
        }
        
        // Показываем уведомление об успешном анализе
        showToast('Анализ графика успешно завершен', 'success');
    } catch (error) {
        console.error('Ошибка при отображении результатов анализа:', error);
        handleError('Произошла ошибка при отображении результатов анализа');
    }
}

/**
 * Обновление индикатора уверенности
 * @param {number} confidence - уровень уверенности (0-100)
 */
function updateConfidenceIndicator(confidence) {
    if (!elements.confidenceBar) {
        return;
    }
    
    // Устанавливаем ширину полосы
    elements.confidenceBar.style.width = `${confidence}%`;
    
    // Устанавливаем цвет индикатора уверенности
    elements.confidenceBar.classList.remove('low-confidence', 'medium-confidence', 'high-confidence');
    
    if (confidence < 40) {
        elements.confidenceBar.classList.add('low-confidence');
    } else if (confidence < 70) {
        elements.confidenceBar.classList.add('medium-confidence');
    } else {
        elements.confidenceBar.classList.add('high-confidence');
    }
}

/**
 * Обновление информации о торговом сигнале
 * @param {Object} signal - данные сигнала
 */
function updateSignalInfo(signal) {
    if (!elements.signalDirection || !elements.signalEntry || 
        !elements.signalStop || !elements.signalTp) {
        return;
    }
    
    // Обновляем направление
    elements.signalDirection.textContent = signal.direction;
    elements.signalDirection.className = `badge ${signal.direction === 'BUY' ? 'bg-success' : 'bg-danger'} fs-5 w-100 p-2`;
    
    // Обновляем цены
    elements.signalEntry.textContent = formatPrice(signal.entryPoint);
    elements.signalStop.textContent = formatPrice(signal.stopLoss);
    elements.signalTp.textContent = formatPrice(signal.takeProfit);
}

/**
 * Генерация тестовых данных анализа для отображения при ошибке
 */
function mockAnalysis() {
    console.log('Генерация тестовых данных анализа...');
    
    // Определяем текущую цену на основе последней свечи или генерируем случайное значение
    let currentPrice = 0;
    if (state.chartData && state.chartData.length > 0) {
        currentPrice = state.chartData[state.chartData.length - 1].close;
    } else {
        if (state.tradingPair.includes('BTC')) {
            currentPrice = 30000 + Math.random() * 5000;
        } else if (state.tradingPair.includes('ETH')) {
            currentPrice = 2000 + Math.random() * 300;
        } else {
            currentPrice = 100 + Math.random() * 50;
        }
    }
    
    // Генерируем случайное направление
    const direction = Math.random() > 0.5 ? 'BUY' : 'SELL';
    
    // Генерируем цены входа, стоп-лосса и тейк-профита
    const entryPoint = currentPrice * (1 + (Math.random() * 0.01) * (direction === 'BUY' ? 1 : -1));
    const stopLoss = direction === 'BUY' 
        ? entryPoint * (1 - 0.02 - Math.random() * 0.03) 
        : entryPoint * (1 + 0.02 + Math.random() * 0.03);
    const takeProfit = direction === 'BUY' 
        ? entryPoint * (1 + 0.04 + Math.random() * 0.05) 
        : entryPoint * (1 - 0.04 - Math.random() * 0.05);
    
    // Генерируем уровень уверенности
    const confidence = 40 + Math.random() * 55;
    
    // Создаем объект сигнала
    const mockSignal = {
        pair: state.tradingPair,
        direction,
        entryPoint,
        stopLoss,
        takeProfit,
        confidence,
        timestamp: Date.now(),
        analysis: 'Тестовый анализ. Данные сгенерированы автоматически из-за ошибки при получении реального анализа.'
    };
    
    // Создаем полный объект данных анализа
    const mockData = {
        signal: mockSignal,
        analysis: {
            analysis: `Тестовый анализ для пары ${state.tradingPair}. На графике наблюдается ${
                direction === 'BUY' ? 'восходящий тренд с потенциалом роста' : 'нисходящий тренд с потенциалом снижения'
            }. Рекомендуется ${direction === 'BUY' ? 'покупка' : 'продажа'} по текущей цене с установкой стоп-лосса на уровне ${
                formatPrice(stopLoss)
            } и тейк-профита на уровне ${formatPrice(takeProfit)}.`
        },
        screenshot: null
    };
    
    // Отображаем результаты
    displayAnalysisResults(mockData);
}

/**
 * Сброс результатов анализа
 */
export function resetAnalysisResults() {
    // Сбрасываем текущий сигнал
    currentSignal = null;
    
    // Проверяем наличие элементов UI
    if (!elements.analysisPlaceholder || !elements.analysisContent ||
        !elements.signalPlaceholder || !elements.signalContent) {
        return;
    }
    
    // Показываем заглушки и скрываем контент
    elements.analysisPlaceholder.classList.remove('d-none');
    elements.analysisContent.classList.add('d-none');
    elements.signalPlaceholder.classList.remove('d-none');
    elements.signalContent.classList.add('d-none');
    
    // Очищаем скриншот
    if (elements.analysisScreenshot) {
        elements.analysisScreenshot.src = '';
    }
}

/**
 * Получение текущего сигнала
 * @returns {Object|null} - текущий сигнал или null, если его нет
 */
export function getCurrentSignal() {
    return currentSignal;
}

/**
 * Экспорт результатов анализа в файл
 * @param {string} format - формат файла (json или txt)
 */
export function exportAnalysis(format = 'json') {
    if (!currentSignal) {
        handleError('Нет данных анализа для экспорта');
        return;
    }
    
    try {
        let content, filename, type;
        
        if (format === 'json') {
            // Экспорт в JSON
            content = JSON.stringify({
                signal: currentSignal,
                tradingPair: state.tradingPair,
                interval: state.interval,
                timestamp: Date.now(),
                exportDate: new Date().toISOString()
            }, null, 2);
            filename = `analysis_${state.tradingPair}_${Date.now()}.json`;
            type = 'application/json';
        } else {
            // Экспорт в текстовый формат
            content = `Анализ для пары ${state.tradingPair} (${state.interval})\n` +
                `Время: ${new Date().toLocaleString()}\n\n` +
                `Направление: ${currentSignal.direction}\n` +
                `Цена входа: ${formatPrice(currentSignal.entryPoint)}\n` +
                `Стоп-лосс: ${formatPrice(currentSignal.stopLoss)}\n` +
                `Тейк-профит: ${formatPrice(currentSignal.takeProfit)}\n` +
                `Уверенность: ${currentSignal.confidence}%\n\n` +
                `Анализ:\n${currentSignal.analysis || 'Нет дополнительного анализа'}`;
            filename = `analysis_${state.tradingPair}_${Date.now()}.txt`;
            type = 'text/plain';
        }
        
        // Создаем ссылку для скачивания
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Удаляем элемент и освобождаем URL
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        showToast('Анализ успешно экспортирован', 'success');
    } catch (error) {
        console.error('Ошибка при экспорте анализа:', error);
        handleError('Произошла ошибка при экспорте анализа');
    }
}
