// modules/copy-trading/bybit-connector.js

const BaseCopyTradingConnector = require('./base-connector');
const crypto = require('crypto');
const axios = require('axios');
const qs = require('querystring');

/**
 * Коннектор для копитрейдинга Bybit
 */
class BybitCopyTradingConnector extends BaseCopyTradingConnector {
  constructor(config = {}) {
    super(config);
    this.name = 'Bybit Copy Trading';
    this.apiKey = config.apiKey || '';
    this.secretKey = config.secretKey || '';
    this.baseUrl = config.baseUrl || 'https://api.bybit.com';
  }

  /**
   * Инициализация коннектора
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize(core) {
    await super.initialize(core);
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Проверяем соединение
    try {
      await this.getServerTime();
      this.log('Успешно подключено к Bybit Copy Trading API');
      return true;
    } catch (error) {
      this.logError('Ошибка подключения к Bybit', error);
      return false;
    }
  }

  /**
   * Получение времени сервера
   * @returns {Promise<Object>} - Время сервера
   */
  async getServerTime() {
    try {
      const response = await this.httpClient.get('/v5/market/time');
      return response.data;
    } catch (error) {
      this.logError('Ошибка получения времени сервера', error);
      throw error;
    }
  }

  /**
   * Генерация подписи для запросов
   * @param {Object} params - Параметры запроса
   * @param {number} timestamp - Временная метка
   * @returns {string} - Подпись
   */
  generateSignature(params, timestamp) {
    const paramsString = Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], '');
    
    const signString = timestamp + this.apiKey + paramsString;
    return crypto.createHmac('sha256', this.secretKey).update(signString).digest('hex');
  }

  /**
   * Выполнение аутентифицированного запроса
   * @param {string} endpoint - Конечная точка API
   * @param {Object} params - Параметры запроса
   * @param {string} method - HTTP метод
   * @returns {Promise<Object>} - Ответ API
   */
  async authRequest(endpoint, params = {}, method = 'GET') {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(params, timestamp);
    
    const headers = {
      'X-BAPI-API-KEY': this.apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-SIGN': signature
    };
    
    try {
      let response;
      
      if (method === 'GET') {
        const query = qs.stringify(params);
        response = await this.httpClient.get(`${endpoint}?${query}`, { headers });
      } else if (method === 'POST') {
        response = await this.httpClient.post(endpoint, params, { headers });
      }
      
      return response.data;
    } catch (error) {
      this.logError(`Ошибка API запроса: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Получение списка ведущих трейдеров
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - Список трейдеров
   */
  async getTraders(options = {}) {
    const endpoint = '/v5/copy-trading/trading-list';
    
    try {
      // Параметры запроса
      const params = {
        limit: options.limit || 20,
        cursor: options.cursor || ''
      };
      
      // У Bybit нет публичного API для лидерборда, поэтому используем 
      // приватный API для получения списка трейдеров
      const response = await this.authRequest(endpoint, params);
      
      if (!response.result || !response.result.list) {
        throw new Error('Неверный формат ответа API');
      }
      
      // Преобразуем в стандартный формат
      return response.result.list.map(trader => ({
        traderId: trader.traderId,
        nickname: trader.nickname,
        winRate: parseFloat(trader.winRatio || 0) * 100,
        profitRate: parseFloat(trader.roi || 0) * 100,
        totalTrades: parseInt(trader.totalOrders || 0, 10),
        followersCount: parseInt(trader.followers || 0, 10),
        dailyROI: parseFloat(trader.dailyReturn || 0) * 100
      }));
    } catch (error) {
      this.logError('Ошибка получения списка трейдеров Bybit', error);
      throw error;
    }
  }

  /**
   * Получение активных позиций трейдера
   * @param {string} traderId - ID трейдера
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - Список позиций
   */
  async getTraderPositions(traderId, options = {}) {
    const endpoint = '/v5/copy-trading/position-list';
    
    try {
      // Параметры запроса
      const params = {
        traderId: traderId,
        symbol: options.symbol || '',
        limit: options.limit || 20,
        cursor: options.cursor || ''
      };
      
      const response = await this.authRequest(endpoint, params);
      
      if (!response.result || !response.result.list) {
        throw new Error('Неверный формат ответа API');
      }
      
      return response.result.list;
    } catch (error) {
      this.logError(`Ошибка получения позиций трейдера ${traderId}`, error);
      throw error;
    }
  }

  /**
   * Получение истории сделок трейдера
   * @param {string} traderId - ID трейдера
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - История сделок
   */
  async getTraderHistory(traderId, options = {}) {
    const endpoint = '/v5/copy-trading/order-history';
    
    try {
      // Параметры запроса
      const params = {
        traderId: traderId,
        symbol: options.symbol || '',
        orderId: options.orderId || '',
        limit: options.limit || 20,
        cursor: options.cursor || ''
      };
      
      const response = await this.authRequest(endpoint, params);
      
      if (!response.result || !response.result.list) {
        throw new Error('Неверный формат ответа API');
      }
      
      return response.result.list;
    } catch (error) {
      this.logError(`Ошибка получения истории трейдера ${traderId}`, error);
      throw error;
    }
  }

  /**
   * Получение статистики трейдера
   * @param {string} traderId - ID трейдера
   * @returns {Promise<Object>} - Статистика трейдера
   */
  async getTraderStats(traderId) {
    const endpoint = '/v5/copy-trading/trading-detail';
    
    try {
      const params = { traderId };
      
      const response = await this.authRequest(endpoint, params);
      
      if (!response.result) {
        throw new Error('Неверный формат ответа API');
      }
      
      const stats = response.result;
      
      return {
        traderId,
        winRate: parseFloat(stats.winRatio || 0) * 100,
        totalTrades: parseInt(stats.totalOrders || 0, 10),
        profitFactor: parseFloat(stats.profitRatio || 0),
        avgROI: parseFloat(stats.roi || 0) * 100,
        dailyProfit: parseFloat(stats.dailyReturn || 0) * 100,
        weeklyProfit: parseFloat(stats.weeklyReturn || 0) * 100,
        monthlyProfit: parseFloat(stats.monthlyReturn || 0) * 100,
        followersCount: parseInt(stats.followers || 0, 10)
      };
    } catch (error) {
      this.logError(`Ошибка получения статистики трейдера ${traderId}`, error);
      throw error;
    }
  }

  /**
   * Преобразование данных позиций в стандартный формат сигналов
   * @param {Array} positions - Позиции трейдера
   * @param {Object} traderInfo - Информация о трейдере
   * @returns {Array} - Стандартизированные сигналы
   */
  convertToStandardSignals(positions, traderInfo = {}) {
    return positions.map(position => {
      // Извлекаем нужные данные из позиции Bybit
      const {
        symbol,
        side,
        leverage,
        entryPrice,
        markPrice,
        takeProfit,
        stopLoss,
        unrealisedPnl,
        createdTime
      } = position;
      
      // Преобразуем в стандартный формат сигнала
      return {
        pair: symbol,
        baseAsset: symbol.replace(/USDT$|USD$/i, ''),
        quoteAsset: symbol.match(/USDT$|USD$/i)?.[0] || 'USDT',
        direction: side === 'Buy' ? 'BUY' : 'SELL',
        entryPoint: parseFloat(entryPrice),
        currentPrice: parseFloat(markPrice),
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        leverage: parseInt(leverage, 10),
        unrealizedProfit: parseFloat(unrealisedPnl || 0),
        timestamp: createdTime ? parseInt(createdTime) : Date.now(),
        source: 'bybit-copy-trading',
        exchange: 'bybit',
        traderId: traderInfo.traderId || null,
        traderName: traderInfo.nickname || traderInfo.traderId || 'Unknown',
        traderStats: {
          winRate: parseFloat(traderInfo.winRate || 0),
          totalTrades: parseInt(traderInfo.totalTrades || 0, 10),
          profitFactor: parseFloat(traderInfo.profitFactor || 0),
          avgROI: parseFloat(traderInfo.profitRate || 0)
        }
      };
    });
  }
}

module.exports = BybitCopyTradingConnector;