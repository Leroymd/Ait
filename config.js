/**
 * Улучшенный конфигурационный файл приложения
 * Содержит настройки по умолчанию для всех модулей
 */
require('dotenv').config(); 

module.exports = {
  // Общие настройки
  general: {
    theme: process.env.THEME || 'dark',
    language: process.env.LANGUAGE || 'ru',
    compactMode: process.env.COMPACT_MODE === 'true' || false,
    timezone: process.env.TIMEZONE || 'UTC',
    loggingLevel: process.env.LOGGING_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
    enableAutoUpdates: process.env.ENABLE_AUTO_UPDATES !== 'false',
    updateInterval: parseInt(process.env.UPDATE_INTERVAL || '30', 10), // секунды
    port: parseInt(process.env.PORT || '3000', 10),
    dataDirectory: process.env.DATA_DIRECTORY || './data',
    maxResponseSize: parseInt(process.env.MAX_RESPONSE_SIZE || '5242880', 10), // 5MB по умолчанию
    connectionTimeout: parseInt(process.env.CONNECTION_TIMEOUT || '30000', 10), // 30 секунд по умолчанию
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10)
  },
  
  // Настройки ядра
  core: {
    exchange: process.env.DEFAULT_EXCHANGE || 'binance',
    tradingPair: process.env.DEFAULT_TRADING_PAIR || 'BTCUSDT',
    defaultTimeframe: process.env.DEFAULT_TIMEFRAME || '1h',
    defaultHistoryLimit: parseInt(process.env.DEFAULT_HISTORY_LIMIT || '1000', 10)
  },
  
  // Настройки подключений к биржам
  connections: {
    binance: {
      apiKey: process.env.BINANCE_API_KEY || '',
      secretKey: process.env.BINANCE_SECRET_KEY || '',
      testnet: process.env.BINANCE_TESTNET === 'true' || false,
      endpoints: {
        spot: process.env.BINANCE_SPOT_API || 'https://api.binance.com',
        futures: process.env.BINANCE_FUTURES_API || 'https://fapi.binance.com'
      },
      requestTimeout: parseInt(process.env.BINANCE_REQUEST_TIMEOUT || '10000', 10), // 10 секунд
      recvWindow: parseInt(process.env.BINANCE_RECV_WINDOW || '5000', 10) // 5 секунд
    },
    bybit: {
      apiKey: process.env.BYBIT_API_KEY || '',
      secretKey: process.env.BYBIT_SECRET_KEY || '',
      testnet: process.env.BYBIT_TESTNET === 'true' || false,
      endpoints: {
        spot: process.env.BYBIT_SPOT_API || 'https://api.bybit.com',
        futures: process.env.BYBIT_FUTURES_API || 'https://api.bybit.com'
      },
      requestTimeout: parseInt(process.env.BYBIT_REQUEST_TIMEOUT || '10000', 10) // 10 секунд
    },
    bitget: {
      apiKey: process.env.BITGET_API_KEY || '',
      secretKey: process.env.BITGET_SECRET_KEY || '',
      passphrase: process.env.BITGET_PASSPHRASE || '',
      testnet: process.env.BITGET_TESTNET === 'true' || false,
      endpoints: {
        spot: process.env.BITGET_SPOT_API || 'https://api.bitget.com',
        futures: process.env.BITGET_FUTURES_API || 'https://api.bitget.com'
      },
      requestTimeout: parseInt(process.env.BITGET_REQUEST_TIMEOUT || '10000', 10) // 10 секунд
    },
    mexc: {
      apiKey: process.env.MEXC_API_KEY || '',
      secretKey: process.env.MEXC_SECRET_KEY || '',
      testnet: process.env.MEXC_TESTNET === 'true' || false,
      endpoints: {
        spot: process.env.MEXC_SPOT_API || 'https://api.mexc.com',
        futures: process.env.MEXC_FUTURES_API || 'https://contract.mexc.com'
      },
      requestTimeout: parseInt(process.env.MEXC_REQUEST_TIMEOUT || '10000', 10) // 10 секунд
    },
    claude: {
      apiKey: process.env.AI_API_KEY || '',
      endpoint: process.env.AI_API_ENDPOINT || 'https://api.aimlapi.com/v1/chat/completions',
      model: process.env.AI_MODEL || 'anthropic/claude-3.7-sonnet',
      requestTimeout: parseInt(process.env.AI_REQUEST_TIMEOUT || '60000', 10) // 60 секунд
    }
  },
  
  // Настройки торговли
  trading: {
    enableAutoTrading: process.env.ENABLE_AUTO_TRADING === 'true' || false,
    defaultExchange: process.env.DEFAULT_EXCHANGE || 'binance',
    requireConfirmation: process.env.REQUIRE_CONFIRMATION !== 'false',
    favoritePairs: (process.env.FAVORITE_PAIRS || 'BTCUSDT,ETHUSDT,SOLUSDT').split(','),
    onlyTradeFavorites: process.env.ONLY_TRADE_FAVORITES === 'true' || false,
    defaultTimeframe: process.env.DEFAULT_TIMEFRAME || '1h',
    orderType: process.env.DEFAULT_ORDER_TYPE || 'LIMIT',
    defaultLeverage: parseInt(process.env.DEFAULT_LEVERAGE || '1', 10),
    enableTrailingStop: process.env.ENABLE_TRAILING_STOP === 'true' || false,
    trailingStopPercent: parseFloat(process.env.TRAILING_STOP_PERCENT || '1.0'),
    enablePartialClose: process.env.ENABLE_PARTIAL_CLOSE === 'true' || false,
    partialClosePercent: (process.env.PARTIAL_CLOSE_PERCENT || '25,50,75').split(',').map(Number),
    simulationMode: process.env.SIMULATION_MODE === 'true' || false,
    orderUpdateInterval: parseInt(process.env.ORDER_UPDATE_INTERVAL || '5000', 10) // 5 секунд
  },
  
  // Настройки риск-менеджмента
  risk: {
    riskPerTrade: parseFloat(process.env.RISK_PER_TRADE || '1.0'),
    maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '10'),
    maxSimultaneousTrades: parseInt(process.env.MAX_SIMULTANEOUS_TRADES || '3', 10),
    defaultStopLoss: parseFloat(process.env.DEFAULT_STOP_LOSS || '2.0'),
    defaultTakeProfit: parseFloat(process.env.DEFAULT_TAKE_PROFIT || '4.0'),
    riskRewardRatio: parseFloat(process.env.RISK_REWARD_RATIO || '2.0'),
    enableCapitalBooster: process.env.ENABLE_CAPITAL_BOOSTER === 'true' || false,
    boosterThreshold: parseFloat(process.env.BOOSTER_THRESHOLD || '20'),
    boosterMultiplier: parseFloat(process.env.BOOSTER_MULTIPLIER || '1.5'),
    enableDrawdownProtection: process.env.ENABLE_DRAWDOWN_PROTECTION !== 'false',
    maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '15'),
    drawdownAction: process.env.DRAWDOWN_ACTION || 'reduce',
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '5.0'),
    maxWeeklyLoss: parseFloat(process.env.MAX_WEEKLY_LOSS || '10.0'),
    enableSessionLimits: process.env.ENABLE_SESSION_LIMITS === 'true' || false,
    tradingHours: process.env.TRADING_HOURS || '00:00-23:59', // формат 'HH:MM-HH:MM'
    tradingDays: (process.env.TRADING_DAYS || '1,2,3,4,5,6,0').split(',').map(Number) // 0 = воскресенье, 6 = суббота
  },
  
  // Настройки аналитики
  analytics: {
    updateInterval: parseInt(process.env.ANALYTICS_UPDATE_INTERVAL || '60', 10), // минуты
    enableBackgroundAnalytics: process.env.ENABLE_BACKGROUND_ANALYTICS !== 'false',
    enableAiAnalysis: process.env.ENABLE_AI_ANALYSIS !== 'false',
    aiAnalysisInterval: parseInt(process.env.AI_ANALYSIS_INTERVAL || '5', 10),
    includeVolumeInAnalysis: process.env.INCLUDE_VOLUME_IN_ANALYSIS !== 'false',
    includeIndicatorsInAnalysis: process.env.INCLUDE_INDICATORS_IN_ANALYSIS !== 'false',
    priorityIndicators: (process.env.PRIORITY_INDICATORS || 'market-structure-shift,fair-value-gap,order-block').split(','),
    enableAutoExport: process.env.ENABLE_AUTO_EXPORT === 'true' || false,
    exportInterval: parseInt(process.env.EXPORT_INTERVAL || '24', 10),
    exportFormat: process.env.EXPORT_FORMAT || 'json',
    initialCapital: parseFloat(process.env.INITIAL_CAPITAL || '1000'),
    minBacktestPeriod: parseInt(process.env.MIN_BACKTEST_PERIOD || '30', 10), // дни
    backtestTimeframe: process.env.BACKTEST_TIMEFRAME || '1h',
    maxOptimizationRuns: parseInt(process.env.MAX_OPTIMIZATION_RUNS || '100', 10)
  },
  
  // Настройки уведомлений
  notifications: {
    enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
    enableBrowserNotifications: process.env.ENABLE_BROWSER_NOTIFICATIONS !== 'false',
    enableSoundNotifications: process.env.ENABLE_SOUND_NOTIFICATIONS !== 'false',
    notifyOnSignal: process.env.NOTIFY_ON_SIGNAL !== 'false',
    notifyOnOrderExecution: process.env.NOTIFY_ON_ORDER_EXECUTION !== 'false',
    notifyOnPositionClose: process.env.NOTIFY_ON_POSITION_CLOSE !== 'false',
    notifyOnDrawdown: process.env.NOTIFY_ON_DRAWDOWN !== 'false',
    enableTelegramNotifications: process.env.ENABLE_TELEGRAM_NOTIFICATIONS === 'true' || false,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    enableEmailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true' || false,
    emailSender: process.env.EMAIL_SENDER || '',
    emailRecipient: process.env.EMAIL_RECIPIENT || '',
    smtpServer: process.env.SMTP_SERVER || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPassword: process.env.SMTP_PASSWORD || ''
  },
  
  // Настройки индикаторов
  indicators: {
    defaultIndicators: (process.env.DEFAULT_INDICATORS || 'market-structure-shift,fair-value-gap,order-block,stop-hunt-detector').split(','),
    customIndicatorsDir: process.env.CUSTOM_INDICATORS_DIR || './custom-indicators',
    enableCustomIndicators: process.env.ENABLE_CUSTOM_INDICATORS === 'true' || false,
    cacheResults: process.env.CACHE_INDICATOR_RESULTS !== 'false',
    cacheExpiry: parseInt(process.env.INDICATOR_CACHE_EXPIRY || '60', 10), // секунды
    
    // Настройки для индикатора Market Structure Shift
    'market-structure-shift': {
      lookbackPeriod: parseInt(process.env.MSS_LOOKBACK_PERIOD || '20', 10),
      minSwingStrength: parseFloat(process.env.MSS_MIN_SWING_STRENGTH || '0.5'),
      swingPointsLookback: parseInt(process.env.MSS_SWING_POINTS_LOOKBACK || '3', 10)
    },
    
    // Настройки для индикатора Fair Value Gap
    'fair-value-gap': {
      minGapSize: parseFloat(process.env.FVG_MIN_GAP_SIZE || '0.1'),
      maxAge: parseInt(process.env.FVG_MAX_AGE || '50', 10),
      showFilled: process.env.FVG_SHOW_FILLED === 'true' || false
    },
    
    // Настройки для индикатора Order Block
    'order-block': {
      minImpulseStrength: parseFloat(process.env.OB_MIN_IMPULSE_STRENGTH || '1.5'),
      maxBlocks: parseInt(process.env.OB_MAX_BLOCKS || '5', 10),
      displayFreshOnly: process.env.OB_DISPLAY_FRESH_ONLY !== 'false'
    },
    
    // Настройки для индикатора Stop Hunt Detector
    'stop-hunt-detector': {
      minWickRatio: parseFloat(process.env.SHD_MIN_WICK_RATIO || '0.5'),
      recencyWeight: parseFloat(process.env.SHD_RECENCY_WEIGHT || '3.0'),
      lookbackPeriod: parseInt(process.env.SHD_LOOKBACK_PERIOD || '20', 10),
      minBodyToRangeRatio: parseFloat(process.env.SHD_MIN_BODY_TO_RANGE_RATIO || '0.3')
    }
  },
  
  // Настройки AI анализатора
  aiAnalyzer: {
    endpoint: process.env.AI_API_ENDPOINT || 'https://api.aimlapi.com/v1/chat/completions',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'anthropic/claude-3.7-sonnet',
    
    // Настройки скриншотов
    screenshotWidth: parseInt(process.env.SCREENSHOT_WIDTH || '1280', 10),
    screenshotHeight: parseInt(process.env.SCREENSHOT_HEIGHT || '800', 10),
    screenshotQuality: parseInt(process.env.SCREENSHOT_QUALITY || '80', 10),
    
    // Настройки запросов
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    requestTimeout: parseInt(process.env.AI_REQUEST_TIMEOUT || '30000', 10),
    
    // Настройки анализа
    defaultPair: process.env.AI_DEFAULT_PAIR || 'BTCUSDT',
    includeIndicatorsInScreenshot: process.env.INCLUDE_INDICATORS_IN_SCREENSHOT !== 'false',
    indicatorsToInclude: (process.env.INDICATORS_TO_INCLUDE || 'market-structure-shift,fair-value-gap,order-block').split(','),
    minimumSignalConfidence: parseFloat(process.env.MINIMUM_SIGNAL_CONFIDENCE || '0.7'),
    
    // Настройки автоматического анализа
    enableAutomatedAnalysis: process.env.ENABLE_AUTOMATED_ANALYSIS === 'true' || false,
    automatedAnalysisInterval: process.env.AUTOMATED_ANALYSIS_INTERVAL || '1h',
    automatedAnalysisPairs: (process.env.AUTOMATED_ANALYSIS_PAIRS || 'BTCUSDT,ETHUSDT').split(','),
    automatedAnalysisStrategy: process.env.AUTOMATED_ANALYSIS_STRATEGY || 'Smart Money Concepts',
    automatedAnalysisAutoTrade: process.env.AUTOMATED_ANALYSIS_AUTO_TRADE === 'true' || false
  },
  
  // Настройки Adaptive Smart Grid
  adaptiveSmartGrid: {
    // Параметры сетки
    maxGridSize: parseInt(process.env.ASG_MAX_GRID_SIZE || '10', 10),
    gridSpacingATRMultiplier: parseFloat(process.env.ASG_GRID_SPACING_ATR_MULTIPLIER || '0.5'),
    defaultLotSize: parseFloat(process.env.ASG_DEFAULT_LOT_SIZE || '0.01'),
    scalingFactor: parseFloat(process.env.ASG_SCALING_FACTOR || '1.2'),
    
    // Параметры входа/выхода
    takeProfitFactor: parseFloat(process.env.ASG_TAKE_PROFIT_FACTOR || '1.5'),
    stopLossFactor: parseFloat(process.env.ASG_STOP_LOSS_FACTOR || '2.0'),
    trailingStopEnabled: process.env.ASG_TRAILING_STOP_ENABLED !== 'false',
    trailingStopActivationPercent: parseFloat(process.env.ASG_TRAILING_STOP_ACTIVATION_PERCENT || '0.5'),
    enablePartialTakeProfit: process.env.ASG_ENABLE_PARTIAL_TAKE_PROFIT !== 'false',
    partialTakeProfitLevels: (process.env.ASG_PARTIAL_TAKE_PROFIT_LEVELS || '0.3,0.5,0.7').split(',').map(Number),
    
    // Анализ рынка
    atrPeriod: parseInt(process.env.ASG_ATR_PERIOD || '14', 10),
    emaFastPeriod: parseInt(process.env.ASG_EMA_FAST_PERIOD || '50', 10),
    emaSlowPeriod: parseInt(process.env.ASG_EMA_SLOW_PERIOD || '200', 10),
    
    // Фильтры
    volumeThreshold: parseFloat(process.env.ASG_VOLUME_THRESHOLD || '1.5'),
    minimumSignalConfidence: parseFloat(process.env.ASG_MINIMUM_SIGNAL_CONFIDENCE || '0.7'),
    
    // Управление рисками
    maxRiskPerTrade: parseFloat(process.env.ASG_MAX_RISK_PER_TRADE || '1.0'),
    maxDrawdownPercent: parseFloat(process.env.ASG_MAX_DRAWDOWN_PERCENT || '10.0'),
    maxConcurrentGrids: parseInt(process.env.ASG_MAX_CONCURRENT_GRIDS || '3', 10),
    targetProfitPercent: parseFloat(process.env.ASG_TARGET_PROFIT_PERCENT || '5.0'),
    
    // Интервалы проверки и обновления
    statusCheckInterval: parseInt(process.env.ASG_STATUS_CHECK_INTERVAL || '60000', 10),
    
    // Расширенные настройки
    dynamicPositionSizing: process.env.ASG_DYNAMIC_POSITION_SIZING !== 'false',
    enableBacktesting: process.env.ASG_ENABLE_BACKTESTING === 'true' || false,
    backTestPeriod: parseInt(process.env.ASG_BACKTEST_PERIOD || '30', 10), // дни
    enableOptimization: process.env.ASG_ENABLE_OPTIMIZATION === 'true' || false
  },
  
  // Модули, которые должны быть загружены при старте приложения
  modules: [
    {
      id: 'indicators-manager',
      path: './modules/indicators-manager',
      enabled: true,
      priority: 1, // Высокий приоритет загрузки
      critical: true, // Критически важный модуль
      config: {} // Конфигурация из секции indicators
    },
    {
      id: 'chart-manager',
      path: './modules/chart-manager',
      enabled: true,
      priority: 2,
      critical: true,
      config: {
        theme: process.env.CHART_THEME || 'dark',
        defaultTimeframe: process.env.DEFAULT_TIMEFRAME || '1h',
        defaultHistoryLimit: parseInt(process.env.DEFAULT_HISTORY_LIMIT || '1000', 10),
        updateInterval: parseInt(process.env.CHART_UPDATE_INTERVAL || '1000', 10),
        showVolume: process.env.CHART_SHOW_VOLUME !== 'false',
        showGrid: process.env.CHART_SHOW_GRID !== 'false',
        allowDrawing: process.env.CHART_ALLOW_DRAWING !== 'false',
        dataDir: process.env.DATA_DIRECTORY || './data'
      }
    },
    {
      id: 'ai-analyzer',
      path: './modules/ai-analyzer',
      enabled: process.env.ENABLE_AI_ANALYZER !== 'false',
      priority: 3,
      critical: false,
      config: {} // Конфигурация из секции aiAnalyzer
    },
    {
      id: 'auto-trader',
      path: './modules/auto-trader',
      enabled: process.env.ENABLE_AUTO_TRADER === 'true' || false,
      priority: 4,
      critical: false,
      config: {
        signalConfirmationThreshold: parseFloat(process.env.SIGNAL_CONFIRMATION_THRESHOLD || '0.8'),
        minSignalQuality: parseFloat(process.env.MIN_SIGNAL_QUALITY || '0.7'),
        closePositionOnOppositeSignal: process.env.CLOSE_POSITION_ON_OPPOSITE_SIGNAL !== 'false',
        positionUpdateInterval: parseInt(process.env.POSITION_UPDATE_INTERVAL || '10000', 10),
        enablePartialClosing: process.env.ENABLE_PARTIAL_CLOSING === 'true' || false,
        partialClosingLevels: (process.env.PARTIAL_CLOSING_LEVELS || '25,50,75').split(',').map(Number),
        simulationMode: process.env.SIMULATION_MODE === 'true' || false
      }
    },
    {
      id: 'trading-analytics',
      path: './modules/trading-analytics',
      enabled: true,
      priority: 5,
      critical: false,
      config: {
        updateInterval: parseInt(process.env.ANALYTICS_UPDATE_INTERVAL || '3600000', 10),
        initialCapital: parseFloat(process.env.INITIAL_CAPITAL || '1000'),
        minTradesForAnalysis: parseInt(process.env.MIN_TRADES_FOR_ANALYSIS || '5', 10),
        performanceTimeframes: (process.env.PERFORMANCE_TIMEFRAMES || 'daily,weekly,monthly').split(','),
        enableAdvancedMetrics: process.env.ENABLE_ADVANCED_METRICS !== 'false',
        significantDrawdownThreshold: parseFloat(process.env.SIGNIFICANT_DRAWDOWN_THRESHOLD || '10')
      }
    },
    {
      id: 'adaptive-smart-grid',
      path: './modules/adaptive-smart-grid',
      enabled: process.env.ENABLE_ADAPTIVE_SMART_GRID === 'true' || false,
      priority: 6,
      critical: false,
      config: {} // Конфигурация из секции adaptiveSmartGrid
    }
  ]
};