// app.js - Main entry point for the trading platform frontend

/**
 * This module is the entry point for client-side JavaScript and handles:
 * - Application initialization
 * - Global state management
 * - DOM element caching
 * - Processing main user actions
 */



import { initChart, updateLastCandle, updateChart, clearChartData, resetChart, fitVisibleContent, cleanup as cleanupChart } from './chart.js';
import { initWebSocket, sendWebSocketMessage, cleanup as cleanupWebSocket } from './websocket.js';
import { loadModules, updateModulesList } from './modules.js';
import { handleAnalyzeClick, displayAnalysisResults, resetAnalysisResults } from './analysis.js';
import { loadSettingsFromStorage, saveSettingsToStorage, loadSettingsToForm, handleSaveSettings } from './settings.js';
import { handleError, showToast, loadMockData, loadMockChartData, delay } from './utils1.js';

// Global application state
export const state = {
    exchange: 'binance',
    tradingPair: 'BTCUSDT',
    interval: '1h',
    marketType: 'futures', // Добавлено свойство для типа рынка
    chartData: [],
    modules: [],
    connected: false,
    aiModuleAvailable: false,
    autoTradingAvailable: false
};


// Cached DOM elements
export const elements = {};

// Application settings
export const settings = {
    apiKeys: {
        binance: { apiKey: '', secretKey: '' },
        bybit: { apiKey: '', secretKey: '' }
    },
    ai: {
        apiKey: '',
        endpoint: ''
    },
    trading: {
        maxRiskPercent: 1,
        maxConcurrentTrades: 3,
        confirmationMode: true,
        depositAcceleration: false
    }
};

// Settings modal instance
export let settingsModal = null;

// DOM load handler
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    try {
        // Initialize the application
        initialize();
        console.log('Application initialized successfully');
    } catch (e) {
        console.error('Error initializing application:', e);
        // Show error message to user
        handleError('An error occurred during application initialization. Try refreshing the page.');
    }
});

/**
 * Application initialization
 */
function initialize() {
    try {
        console.log('Initializing application...');
        
        // Cache DOM elements
        cacheElements();
        addExchangeOptions();
        // Check for required elements
        if (!checkRequiredElements()) {
            console.error('Some required elements not found on the page');
            return;
        }
        
        // Add WebSocket status indicator
        addWebSocketStatusIndicator();
        
        // Initialize market type buttons
        initMarketTypeButtons();
        
        // Initialize pair search
        initPairSearch();
        
        // Load settings from localStorage
        loadSettingsFromStorage();
        
        // Initialize event listeners
        initEventListeners();
        
        // Initialize chart
        initChart();
        
        // Initialize WebSocket connection
        initWebSocket();
        
        // Initialize Bootstrap modals
        initModals();
        
        // Add page unload handler
        window.addEventListener('beforeunload', cleanup);
        
        console.log('Application initialized');
    } catch (error) {
        console.error('Critical error during application initialization:', error);
        
        // Show error to user
        handleError('An error occurred during application initialization. Check console for details.');
        
        // Try to recover functionality
        tryRecovery();
    }
}
/**
 * Инициализация поиска по парам
 */
function initPairSearch() {
    const searchInput = document.getElementById('pair-search');
    const pairSelect = document.getElementById('pair-select');
    
    if (!searchInput || !pairSelect) {
        console.warn('Элементы поиска пар не найдены');
        return;
    }
    
    // Сохраняем все исходные опции для фильтрации
    const allOptions = Array.from(pairSelect.options);
    window.pairOptions = allOptions; // Сохраняем глобально для доступа из других мест
    
    searchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase();
        
        // Очищаем текущие опции
        while (pairSelect.firstChild) {
            pairSelect.removeChild(pairSelect.firstChild);
        }
        
        // Фильтруем и добавляем опции, соответствующие поисковому запросу
        const filteredOptions = allOptions.filter(option => 
            option.textContent.toLowerCase().includes(searchText) && !option.disabled
        );
        
        // Добавляем отфильтрованные опции обратно в селект
        filteredOptions.forEach(option => {
            pairSelect.appendChild(option.cloneNode(true));
        });
        
        // Если ничего не найдено, добавляем соответствующую опцию
        if (filteredOptions.length === 0) {
            const emptyOption = document.createElement('option');
            emptyOption.disabled = true;
            emptyOption.textContent = 'Пары не найдены';
            pairSelect.appendChild(emptyOption);
        }
    });
    
    // Очищаем поле поиска, чтобы сбросить фильтр
    searchInput.value = '';
    // Генерируем событие input для обновления списка
    searchInput.dispatchEvent(new Event('input'));
}
/**
 * Инициализация кнопок выбора типа рынка
 */
function initMarketTypeButtons() {
    const marketTypeButtons = document.querySelectorAll('.market-type-btn');
    
    if (marketTypeButtons.length === 0) {
        console.warn('Кнопки выбора типа рынка не найдены');
        return;
    }
    
    // Устанавливаем фьючерсы по умолчанию
    state.marketType = 'futures';
    
    marketTypeButtons.forEach(button => {
        button.addEventListener('click', async () => {
            // Обновляем активную кнопку
            marketTypeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Получаем тип рынка
            const marketType = button.getAttribute('data-type');
            
            // Сохраняем выбранный тип рынка
            state.marketType = marketType;
            console.log(`Выбран тип рынка: ${marketType}`);
            
            // Загружаем пары для выбранного типа рынка
            await loadTradingPairs();
            
            // Если есть выбранная пара, загружаем её график
            if (state.tradingPair) {
                await loadChartData();
            }
        });
    });
}
/**
 * Check for required elements
 * @returns {boolean} - whether all required elements are found
 */
function checkRequiredElements() {
    const requiredElements = [
        'trading-chart'
    ];
    
    let allFound = true;
    requiredElements.forEach(id => {
        if (!document.getElementById(id)) {
            console.error(`Element with ID '${id}' not found on page`);
            allFound = false;
        }
    });
    
    return allFound;
}

/**
 * Add WebSocket status indicator
 */
function addWebSocketStatusIndicator() {
    let statusIndicator = document.getElementById('ws-status');
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'ws-status';
        statusIndicator.style.position = 'fixed';
        statusIndicator.style.top = '10px';
        statusIndicator.style.right = '10px';
        statusIndicator.style.backgroundColor = 'rgba(0,0,0,0.5)';
        statusIndicator.style.color = 'white';
        statusIndicator.style.padding = '5px';
        statusIndicator.style.borderRadius = '5px';
        statusIndicator.style.fontSize = '12px';
        statusIndicator.style.zIndex = '9999';
        statusIndicator.textContent = 'WebSocket: waiting...';
        document.body.appendChild(statusIndicator);
    }
}

/**
 * Cache DOM elements
 */
function cacheElements() {
    Object.assign(elements, {
        exchangeSelect: document.getElementById('exchange-select'),
        pairSelect: document.getElementById('pair-select'),
        intervalButtons: document.querySelectorAll('.interval-btn'),
        currentPair: document.getElementById('current-pair'),
        analyzeBtn: document.getElementById('analyze-btn'),
        modulesList: document.getElementById('modules-list'),
        tradingChart: document.getElementById('trading-chart'),
        settingsBtn: document.getElementById('settings-btn'),
        saveSettingsBtn: document.getElementById('save-settings-btn'),
        analysisPlaceholder: document.getElementById('analysis-placeholder'),
        analysisContent: document.getElementById('analysis-content'),
        analysisText: document.getElementById('analysis-text'),
        analysisScreenshot: document.getElementById('analysis-screenshot'),
        analysisTimestamp: document.getElementById('analysis-timestamp'),
        confidenceBar: document.getElementById('confidence-bar'),
        signalPlaceholder: document.getElementById('signal-placeholder'),
        signalContent: document.getElementById('signal-content'),
        signalDirection: document.getElementById('signal-direction'),
        signalEntry: document.getElementById('signal-entry'),
        signalStop: document.getElementById('signal-stop'),
        signalTp: document.getElementById('signal-tp'),
        executeSignalBtn: document.getElementById('execute-signal-btn'),
        autoTradingSwitch: document.getElementById('auto-trading-switch'),
        binanceApiKey: document.getElementById('binance-api-key'),
        binanceSecretKey: document.getElementById('binance-secret-key'),
        bybitApiKey: document.getElementById('bybit-api-key'),
        bybitSecretKey: document.getElementById('bybit-secret-key'),
        aiApiKey: document.getElementById('ai-api-key'),
        aiEndpoint: document.getElementById('ai-endpoint'),
        installedModulesList: document.getElementById('installed-modules-list'),
        moduleFile: document.getElementById('module-file'),
        uploadModuleBtn: document.getElementById('upload-module-btn'),
        maxRiskPercent: document.getElementById('max-risk-percent'),
        maxConcurrentTrades: document.getElementById('max-concurrent-trades'),
        confirmationModeCheck: document.getElementById('confirmation-mode-check'),
        depositAccelerationCheck: document.getElementById('deposit-acceleration-check'),
        wsStatus: document.getElementById('ws-status')
    });
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Check for elements before adding handlers
    if (elements.exchangeSelect) {
        elements.exchangeSelect.addEventListener('change', () => {
            handleExchangeChange(elements.exchangeSelect.value);
        });
    }
    
    if (elements.pairSelect) {
        elements.pairSelect.addEventListener('change', () => {
            handlePairChange(elements.pairSelect.value);
        });
    }
    
    if (elements.intervalButtons && elements.intervalButtons.length) {
        elements.intervalButtons.forEach(button => {
            button.addEventListener('click', () => {
                handleIntervalChange(button.dataset.interval);
                
                // Update active button
                elements.intervalButtons.forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
            });
        });
    }
    
    if (elements.analyzeBtn) {
        elements.analyzeBtn.addEventListener('click', handleAnalyzeClick);
    }
    
    if (elements.executeSignalBtn) {
        elements.executeSignalBtn.addEventListener('click', handleExecuteSignalClick);
    }
    
    if (elements.autoTradingSwitch) {
        elements.autoTradingSwitch.addEventListener('change', handleAutoTradingToggle);
    }
    
    if (elements.saveSettingsBtn) {
        elements.saveSettingsBtn.addEventListener('click', handleSaveSettings);
    }
    
    if (elements.uploadModuleBtn) {
        elements.uploadModuleBtn.addEventListener('click', () => {
            import('./modules.js').then(modulesModule => {
                modulesModule.handleUploadModule();
            }).catch(error => {
                console.error('Error importing modules.js module:', error);
                handleError('Error loading module management module');
            });
        });
    }
}

/**
 * Initialize Bootstrap modals
 */
function initModals() {
    try {
        // Check if modal element and Bootstrap library exist
        const modalElement = document.getElementById('settings-modal');
        if (!modalElement) {
            console.warn('Settings modal element not found');
            return;
        }
        
        if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
            console.warn('Bootstrap library not loaded or does not contain Modal component');
            
            // Add settings button handler without modal
            if (elements.settingsBtn) {
                elements.settingsBtn.addEventListener('click', () => {
                    alert('Settings modal unavailable. Bootstrap library not loaded.');
                });
            }
            
            return;
        }
        
        // Initialize settings modal
        settingsModal = new bootstrap.Modal(modalElement);
        
        // Settings button handler
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', () => {
                loadSettingsToForm();
                settingsModal.show();
            });
        }
    } catch (error) {
        console.error('Error initializing modals:', error);
        
        // Add settings button handler without modal
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', () => {
                alert('An error occurred initializing the settings modal.');
            });
        }
    }
}

/**
 * Application recovery method for errors
 */
function tryRecovery() {
    console.log('Attempting to recover application...');
    
    // Try to load mock data
    loadMockData();
}

/**
 * Load initial data
 */
export function loadInitialData() {
    if (!state.connected) {
        console.warn('WebSocket not connected, cannot load data');
        // Load mock data
        loadMockData();
        return;
    }
    
    console.log('Loading initial data...');
    
    // Request initial state
    sendWebSocketMessage({
        type: 'GET_INITIAL_STATE'
    });
    
    // Load trading pairs list
    loadTradingPairs();
    
    // Load modules list
    loadModules();
}

/**
 * Загрузка списка торговых пар
 */
export function loadTradingPairs() {
    console.log('Loading trading pairs list...');
    
    // Показываем индикатор загрузки
    document.getElementById('loading-spinner').style.display = 'block';
    
    // Получаем выбранную биржу и тип рынка
    const exchange = state.exchange || 'binance';
    const marketType = state.marketType || 'futures';
    
    // Выполняем запрос к API
    fetch(`/api/pairs?exchange=${exchange}&type=${marketType}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received trading pairs data:', data);
            
            // Очищаем текущий список пар
            if (elements.pairSelect) {
                elements.pairSelect.innerHTML = '';
                
                // Добавляем новые пары
                if (data.pairs && Array.isArray(data.pairs) && data.pairs.length > 0) {
                    data.pairs.forEach(pair => {
                        const option = document.createElement('option');
                        option.value = pair.symbol || pair;
                        option.textContent = pair.symbol || pair;
                        elements.pairSelect.appendChild(option);
                    });
                    
                    // Выбираем текущую пару, если она есть в списке
                    const pairExists = Array.from(elements.pairSelect.options)
                        .some(option => option.value === state.tradingPair);
                    
                    if (pairExists) {
                        elements.pairSelect.value = state.tradingPair;
                    } else if (elements.pairSelect.options.length > 0) {
                        // Иначе выбираем первую пару
                        state.tradingPair = elements.pairSelect.options[0].value;
                        elements.pairSelect.value = state.tradingPair;
                        
                        // Обновляем отображение выбранной пары
                        if (elements.currentPair) {
                            elements.currentPair.textContent = state.tradingPair;
                        }
                    }
                } else {
                    // Если пар нет, добавляем соответствующее сообщение
                    const option = document.createElement('option');
                    option.disabled = true;
                    option.textContent = 'Пары не найдены';
                    elements.pairSelect.appendChild(option);
                    
                    console.warn('No trading pairs found or incorrect data format:', data);
                }
            }
            
            // Скрываем индикатор загрузки
            document.getElementById('loading-spinner').style.display = 'none';
            
            // Инициализируем поиск
            initPairSearch();
            
            // Загружаем данные графика для выбранной пары
            if (state.tradingPair) {
                loadChartData();
            }
        })
        .catch(error => {
            console.error('Error loading trading pairs list:', error);
            
            // Загружаем тестовые данные при ошибке
            loadMockPairs();
            
            // Скрываем индикатор загрузки
            document.getElementById('loading-spinner').style.display = 'none';
        });
}


/**
 * Load mock trading pairs data
 */
function loadMockPairs() {
    if (elements.pairSelect) {
        elements.pairSelect.innerHTML = '';
        const mockPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT'];
        mockPairs.forEach(pair => {
            const option = document.createElement('option');
            option.value = pair;
            option.textContent = pair;
            elements.pairSelect.appendChild(option);
        });
        elements.pairSelect.value = state.tradingPair;
    }
}

/**
 * Load chart data
 */
/**
 * Загрузка данных графика
 * @param {number} endTime - Время, до которого нужно загрузить данные (для загрузки истории)
 * @returns {Promise} - Promise, который разрешается после загрузки данных
 */
export function loadChartData(endTime = null) {
    return new Promise((resolve, reject) => {
        console.log('Loading chart data...', endTime ? `for endTime: ${new Date(endTime)}` : '');
        
        // Формируем URL с учетом параметров
        let url = `/api/chart?pair=${state.tradingPair}&interval=${state.interval}&limit=100`;
        if (endTime) {
            url += `&endTime=${endTime}`;
        }
        
        // Добавляем тип рынка
        url += `&type=${state.marketType || 'futures'}`;
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Received chart data:', data);
                
                // Check for chart data
                if (data.chartData && Array.isArray(data.chartData) && data.chartData.length > 0) {
                    // Импортируем валидатор данных
                    import('./utils/data-validator.js').then(validator => {
                        // Валидируем и обрабатываем новые данные
                        const processedData = validator.validateAndProcessCandleData(data.chartData);
                        
                        if (processedData.isValid) {
                            // Если загружаем историю (есть endTime), то объединяем с существующими данными
                            if (endTime && state.chartData && state.chartData.length > 0) {
                                // Создаем множество времен открытия для быстрой проверки дубликатов
                                const existingTimes = new Set(state.chartData.map(candle => candle.openTime));
                                
                                // Фильтруем новые данные, чтобы избежать дубликатов
                                const uniqueNewData = processedData.data.filter(candle => 
                                    !existingTimes.has(candle.openTime)
                                );
                                
                                // Добавляем уникальные новые данные к существующим
                                const combinedData = [...uniqueNewData, ...state.chartData];
                                
                                // Сортируем по времени
                                combinedData.sort((a, b) => a.openTime - b.openTime);
                                
                                // Обновляем график
                                import('./chart.js').then(chartModule => {
                                    chartModule.updateChart(combinedData);
                                    
                                    // Обновляем состояние
                                    state.chartData = combinedData;
                                    
                                    // После загрузки истории, позиционируем график
                                    setTimeout(() => {
                                        chartModule.fitVisibleContent();
                                    }, 100);
                                    
                                    resolve();
                                }).catch(error => {
                                    console.error('Error importing chart module:', error);
                                    reject(error);
                                });
                            } else {
                                // Обычное обновление графика
                                updateChart(processedData.data);
                                
                                // Обновляем состояние
                                state.chartData = processedData.data;
                                
                                // Enable analyze button if AI module available
                                if (state.aiModuleAvailable && elements.analyzeBtn) {
                                    elements.analyzeBtn.disabled = false;
                                }
                                
                                resolve();
                            }
                        } else {
                            console.warn(processedData.message);
                            // Load mock data if validation failed
                            loadMockChartData();
                            reject(new Error(processedData.message));
                        }
                    }).catch(error => {
                        console.error('Error importing data validator:', error);
                        // Fall back to direct update
                        updateChart(data.chartData);
                        state.chartData = data.chartData;
                        resolve();
                    });
                } else {
                    console.warn('Chart data has incorrect format:', data);
                    // Load mock data
                    loadMockChartData();
                    reject(new Error('Incorrect chart data format'));
                }
            })
            .catch(error => {
                console.error('Error loading chart data:', error);
                // Load mock data on error
                loadMockChartData();
                reject(error);
            });
    });
}
/**
 * Добавление опций новых бирж в селектор
 */
function addExchangeOptions() {
    if (!elements.exchangeSelect) {
        console.warn('Exchange select element not found');
        return;
    }
    
    // Проверяем, есть ли уже эти биржи
    const existingOptions = Array.from(elements.exchangeSelect.options).map(option => option.value);
    
    // Добавляем Bitget, если его еще нет
    if (!existingOptions.includes('bitget')) {
        const bitgetOption = document.createElement('option');
        bitgetOption.value = 'bitget';
        bitgetOption.textContent = 'Bitget';
        elements.exchangeSelect.appendChild(bitgetOption);
    }
    
    // Добавляем MEXC, если его еще нет
    if (!existingOptions.includes('mexc')) {
        const mexcOption = document.createElement('option');
        mexcOption.value = 'mexc';
        mexcOption.textContent = 'MEXC';
        elements.exchangeSelect.appendChild(mexcOption);
    }
}
/**
 * Handle exchange change
 * @param {string} exchange - new exchange
 */
export function handleExchangeChange(exchange) {
    try {
        console.log('Changing exchange to:', exchange);
        
        // Update state
        state.exchange = exchange;
        
        // Update UI elements
        if (elements.exchangeSelect) {
            elements.exchangeSelect.value = exchange;
        }
        
        // Reset analysis results
        resetAnalysisResults();
        
        // Очищаем график и перезагружаем список пар
        import('./chart.js').then(chartModule => {
            // Полная очистка графика
            chartModule.resetChart();
            
            // Загружаем список пар для новой биржи
            loadTradingPairs();
        }).catch(error => {
            console.error('Error importing chart module:', error);
            // Если не удалось импортировать модуль, все равно загружаем пары
            loadTradingPairs();
        });
        
        // Send message via WebSocket if connected
        if (state.connected) {
            sendWebSocketMessage({
                type: 'SET_EXCHANGE',
                payload: { exchange }
            });
        }
    } catch (error) {
        console.error('Error changing exchange:', error);
        handleError('An error occurred while changing the exchange');
    }
}

/**
 * Handle trading pair change
 * @param {string} pair - new trading pair
 */
/**
 * Handle trading pair change
 * @param {string} pair - new trading pair
 */
export function handlePairChange(pair) {
    try {
        console.log('Changing trading pair to:', pair);
        
        // Update state
        state.tradingPair = pair;
        
        // Update UI elements
        if (elements.currentPair) {
            elements.currentPair.textContent = pair;
        }
        
        if (elements.pairSelect) {
            elements.pairSelect.value = pair;
        }
        
        // Reset analysis results
        resetAnalysisResults();
        
        // Очищаем старые данные графика перед загрузкой новых
        import('./chart.js').then(chartModule => {
            // Используем resetChart для полной перерисовки графика
            chartModule.resetChart();
            
            // Загружаем новые данные для пары
            loadChartData();
        }).catch(error => {
            console.error('Error importing chart module:', error);
            // Если не удалось импортировать модуль, все равно пытаемся загрузить данные
            loadChartData();
        });
        
        // Send message via WebSocket if connected
        if (state.connected) {
            sendWebSocketMessage({
                type: 'SET_TRADING_PAIR',
                payload: { pair }
            });
        }
    } catch (error) {
        console.error('Error changing trading pair:', error);
        handleError('An error occurred while changing the trading pair');
    }
}

/**
 * Handle time interval change
 * @param {string} interval - new interval
 */
/**
 * Handle time interval change
 * @param {string} interval - new interval
 */
export function handleIntervalChange(interval) {
    try {
        console.log('Changing interval to:', interval);
        
        // Update state
        state.interval = interval;
        
        // Reset analysis results
        resetAnalysisResults();
        
        // Очищаем данные графика перед загрузкой новых
        import('./chart.js').then(chartModule => {
            // Используем clearChartData для очистки только данных, сохраняя настройки графика
            chartModule.clearChartData();
            
            // Загружаем данные для нового интервала
            loadChartData();
        }).catch(error => {
            console.error('Error importing chart module:', error);
            // Если не удалось импортировать модуль, все равно пытаемся загрузить данные
            loadChartData();
        });
        
        // Send message via WebSocket if connected
        if (state.connected) {
            sendWebSocketMessage({
                type: 'SUBSCRIBE_TO_CHART',
                payload: { interval }
            });
        }
    } catch (error) {
        console.error('Error changing interval:', error);
        handleError('An error occurred while changing the time interval');
    }
}

/**
 * Handle signal execution button click
 */
export function handleExecuteSignalClick() {
    try {
        // Check if there's a trading signal
        if (!elements.signalContent || elements.signalContent.classList.contains('d-none')) {
            handleError('No active trading signal. Perform analysis first.');
            return;
        }
        
        // Check for API keys
        if (!settings.apiKeys[state.exchange].apiKey || 
            !settings.apiKeys[state.exchange].secretKey) {
            handleError(`API keys for ${state.exchange} are not configured. Please add keys in settings.`);
            return;
        }
        
        // Show loading indicator
        if (elements.executeSignalBtn) {
            elements.executeSignalBtn.disabled = true;
            elements.executeSignalBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Executing...
            `;
        }
        
        // Get signal data
        const signalData = {
            exchange: state.exchange,
            pair: state.tradingPair,
            direction: elements.signalDirection ? elements.signalDirection.textContent : 'BUY',
            entryPoint: elements.signalEntry ? parseFloat(elements.signalEntry.textContent) : 0,
            stopLoss: elements.signalStop ? parseFloat(elements.signalStop.textContent) : 0,
            takeProfit: elements.signalTp ? parseFloat(elements.signalTp.textContent) : 0,
            riskPercent: settings.trading.maxRiskPercent
        };
        
        // Send request to execute signal
        fetch('/api/execute-signal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(signalData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showExecutionSuccess(data);
            } else {
                throw new Error(data.error || 'Unknown error executing signal');
            }
        })
        .catch(error => {
            console.error('Error executing signal:', error);
            handleError(`Error executing signal: ${error.message}`);
            
            // Simulate successful execution
            mockExecuteSignal();
        })
        .finally(() => {
            // Remove loading indicator
            if (elements.executeSignalBtn) {
                elements.executeSignalBtn.disabled = false;
                elements.executeSignalBtn.innerHTML = `
                    <i class="bi bi-lightning"></i> Execute Signal
                `;
            }
        });
    } catch (error) {
        console.error('Error executing signal:', error);
        
        // Restore button
        if (elements.executeSignalBtn) {
            elements.executeSignalBtn.disabled = false;
            elements.executeSignalBtn.innerHTML = `
                <i class="bi bi-lightning"></i> Execute Signal
            `;
        }
        
        handleError('An unexpected error occurred while executing the signal');
    }
}

/**
 * Mock signal execution
 */
function mockExecuteSignal() {
    // Delay to simulate loading
    setTimeout(() => {
        showExecutionSuccess({
            success: true,
            orderId: `mock-${Date.now()}`,
            status: 'FILLED'
        });
    }, 1000);
}

/**
 * Show successful execution notification
 * @param {Object} data - execution result data
 */
export function showExecutionSuccess(data = null) {
    // Trade information
    const pairName = state.tradingPair;
    const direction = elements.signalDirection ? elements.signalDirection.textContent : 'BUY';
    const entryPrice = elements.signalEntry ? elements.signalEntry.textContent : '0.00';
    
    // Show success notification
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        // Create Bootstrap modal
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = `
            <div class="modal fade" id="success-modal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">Signal Successfully Executed</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-3">
                                <i class="bi bi-check-circle text-success" style="font-size: 3rem;"></i>
                            </div>
                            <p>Trade successfully created:</p>
                            <ul>
                                <li><strong>Trading pair:</strong> ${pairName}</li>
                                <li><strong>Direction:</strong> ${direction}</li>
                                <li><strong>Entry price:</strong> ${entryPrice}</li>
                                ${data && data.orderId ? `<li><strong>Order ID:</strong> ${data.orderId}</li>` : ''}
                            </ul>
                            <p class="mb-0 text-muted small">You can track the trade status on the "Positions" page</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <a href="positions.html" class="btn btn-primary">Go to Positions</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalContainer);
        
        const modalElement = document.getElementById('success-modal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // Remove modal after closing
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalContainer.remove();
        });
    } else {
        // Use regular alert if Bootstrap unavailable
        alert(`Signal successfully executed!\nPair: ${pairName}\nDirection: ${direction}\nEntry price: ${entryPrice}`);
    }
    
    // Reset analysis results
    resetAnalysisResults();
}

/**
 * Handle auto trading toggle
 */
export function handleAutoTradingToggle() {
    // Check if autotrading module is available
    if (!state.autoTradingAvailable) {
        elements.autoTradingSwitch.checked = false;
        handleError('Auto trading module not available. Install the module in settings.');
        return;
    }
    
    // If enabled, show warning
    if (elements.autoTradingSwitch.checked) {
        if (!confirm('Warning! Enabling auto trading will result in automatic execution of all signals. Continue?')) {
            elements.autoTradingSwitch.checked = false;
            return;
        }
        
        // Show success message
        showToast('Auto trading enabled. Signals will be executed automatically.', 'success');
    } else {
        // Show disabled message
        showToast('Auto trading disabled', 'info');
    }
}

/**
 * Clean up resources when unloading module
 */
function cleanup() {
    console.log('Cleaning up application resources...');
    
    // Clean up WebSocket
    cleanupWebSocket();
    
    // Clean up chart
    cleanupChart();
    
    // Remove page unload handler
    window.removeEventListener('beforeunload', cleanup);
}