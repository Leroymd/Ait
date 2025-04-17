/**
 * Конфигурационный файл приложения
 * Содержит настройки по умолчанию для всех модулей
 */

module.exports = {
  // Общие настройки
  general: {
    theme: 'light',
    language: 'ru',
    compactMode: false,
    timezone: 'UTC',
    loggingLevel: 'info',
    enableAutoUpdates: true,
    updateInterval: 30, // секунды
    port: process.env.PORT || 3000,
    dataDirectory: './data'
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
      }
    },
    bybit: {
      apiKey: process.env.BYBIT_API_KEY || '',
      secretKey: process.env.BYBIT_SECRET_KEY || '',
      testnet: process.env.BYBIT_TESTNET === 'true' || false,
      endpoints: {
        spot: process.env.BYBIT_SPOT_API || 'https://api.bybit.com',
        futures: process.env.BYBIT_FUTURES_API || 'https://api.bybit.com'
      }
    },
    ai: {
      provider: process.env.AI_PROVIDER || 'openai',
      apiKey: process.env.AI_API_KEY || '',
      endpoint: process.env.AI_ENDPOINT || '',
      model: process.env.AI_MODEL || 'gpt-4'
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
    orderType: process.env.DEFAULT_ORDER_TYPE || 'MARKET',
    defaultLeverage: parseInt(process.env.DEFAULT_LEVERAGE || '1', 10),
    enableTrailingStop: process.env.ENABLE_TRAILING_STOP === 'true' || false,
    trailingStopPercent: parseFloat(process.env.TRAILING_STOP_PERCENT || '1.0')
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
    drawdownAction: process.env.DRAWDOWN_ACTION || 'reduce'
  },
  
  // Настройки аналитики
  analytics: {
    updateInterval: parseInt(process.env.ANALYTICS_UPDATE_INTERVAL || '60', 10), // минуты
    enableBackgroundAnalytics: process.env.ENABLE_BACKGROUND_ANALYTICS !== 'false',
    enableAiAnalysis: process.env.ENABLE_AI_ANALYSIS !== 'false',
    aiAnalysisInterval: parseInt(process.env.AI_ANALYSIS_INTERVAL || '5', 10),
    includeVolumeInAnalysis: process.env.INCLUDE_VOLUME_IN_ANALYSIS !== 'false',
    includeIndicatorsInAnalysis: process.env.INCLUDE_INDICATORS_IN_ANALYSIS !== 'false',
    priorityIndicators: (process.env.PRIORITY_INDICATORS || 'rsi,macd,ma').split(','),
    enableAutoExport: process.env.ENABLE_AUTO_EXPORT === 'true' || false,
    exportInterval: parseInt(process.env.EXPORT_INTERVAL || '24', 10),
    exportFormat: process.env.EXPORT_FORMAT || 'json',
    initialCapital: parseFloat(process.env.INITIAL_CAPITAL || '1000')
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
    telegramChatId: process.env.TELEGRAM_CHAT_ID || ''
  },
  
  // Модули, которые должны быть загружены при старте приложения
  modules: [
    {
      name: 'ai-analyzer',
      enabled: true,
      config: {
        // Специфические настройки для AI анализатора
        screenshotInterval: parseInt(process.env.SCREENSHOT_INTERVAL || '300', 10), // секунды
        screenshotQuality: parseInt(process.env.SCREENSHOT_QUALITY || '80', 10), // 1-100
        screenshotWidth: parseInt(process.env.SCREENSHOT_WIDTH || '1280', 10),
        screenshotHeight: parseInt(process.env.SCREENSHOT_HEIGHT || '720', 10),
        includeIndicatorsInScreenshot: process.env.INCLUDE_INDICATORS_IN_SCREENSHOT !== 'false',
        indicatorsToInclude: (process.env.INDICATORS_TO_INCLUDE || 'rsi,macd,volume').split(',')
      }
    },
    {
      name: 'auto-trader',
      enabled: process.env.ENABLE_AUTO_TRADER === 'true' || false,
      config: {
        // Специфические настройки для автотрейдера
        signalConfirmationThreshold: parseFloat(process.env.SIGNAL_CONFIRMATION_THRESHOLD || '0.8'),
        minSignalQuality: parseFloat(process.env.MIN_SIGNAL_QUALITY || '0.7'),
        closePositionOnOppositeSignal: process.env.CLOSE_POSITION_ON_OPPOSITE_SIGNAL !== 'false',
        positionUpdateInterval: parseInt(process.env.POSITION_UPDATE_INTERVAL || '10', 10), // секунды
        enablePartialClosing: process.env.ENABLE_PARTIAL_CLOSING === 'true' || false,
        partialClosingLevels: (process.env.PARTIAL_CLOSING_LEVELS || '25,50,75').split(',').map(Number)
      }
    },
    {
      name: 'trading-analytics',
      enabled: true,
      config: {
        // Специфические настройки для аналитики
        updateInterval: parseInt(process.env.ANALYTICS_UPDATE_INTERVAL || '3600000', 10), // миллисекунды
        initialCapital: parseFloat(process.env.INITIAL_CAPITAL || '1000'),
        minTradesForAnalysis: parseInt(process.env.MIN_TRADES_FOR_ANALYSIS || '5', 10),
        performanceTimeframes: (process.env.PERFORMANCE_TIMEFRAMES || 'daily,weekly,monthly').split(','),
        enableAdvancedMetrics: process.env.ENABLE_ADVANCED_METRICS !== 'false',
        significantDrawdownThreshold: parseFloat(process.env.SIGNIFICANT_DRAWDOWN_THRESHOLD || '10')
      }
    }
  ]
};
