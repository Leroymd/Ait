// modules/copy-trading/bitget-connector.js

const BaseCopyTradingConnector = require('./base-connector');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Коннектор для копитрейдинга Bitget
 */
class BitgetCopyTradingConnector extends BaseCopyTradingConnector {
  constructor(config = {}) {
    super(config);
    this.name = 'Bitget Copy Trading';
    this.apiKey = config.apiKey || '';
    this.secretKey = config.secretKey || '';
    this.passphrase = config.passphrase || '';
    this.baseUrl = config.baseUrl || 'https://api.bitget.com';
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
      this.log('Успешно подключено к Bitget Copy Trading API');
      return true;
    } catch (error) {
      this.logError('Ошибка подключения к Bitget', error);
      return false;
    }
  }

  /**
   * Получение времени сервера
   * @returns {Promise<Object>} - Время сервера
   */
  async getServerTime() {
    try {
      const response = await this.httpClient.get('/api/spot/v1/public/time');
      return response.data;
    } catch (error) {
      this.logError('Ошибка получения времени сервера', error);
      throw error;
    }
  }

  /**
   * Генерация подписи для запросов
   * @param {string} timestamp - Временная метка
   * @param {string} method - HTTP метод
   * @param {string} requestPath - Путь запроса
   * @param {string} body - Тело запроса (для POST)
   * @returns {string} - Подпись
   */
  generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method.toUpperCase() + requestPath + body;
    return crypto.createHmac('sha256', this.secretKey).update(message).digest('base64');
  }

  /**
   * Добавление заголовков аутентификации
   * @param {Object} options - Опции запроса
   * @param {string} method - HTTP метод
   * @param {string} endpoint - Конечная точка API
   * @param {Object|string} data - Данные запроса
   * @returns {Object} - Опции с заголовками аутентификации
   */
  addAuthHeaders(options, method, endpoint, data = '') {
    const timestamp = Date.now().toString();
    const body = typeof data === 'string' ? data : JSON.stringify(data || {});
    
    const signature = this.generateSignature(timestamp, method, endpoint, body);
    
    options.headers = {
      ...options.headers,
      'ACCESS-KEY': this.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': this.passphrase
    };
    
    return options;
  }

  /**
   * Выполнение аутентифицированного запроса
   * @param {string} method - HTTP метод
   * @param {string} endpoint - Конечная точка API
   * @param {Object} data - Данные запроса
   * @param {Object} params - Параметры запроса
   * @returns {Promise<Object>} - Ответ API
   */
  async authRequest(method, endpoint, data = null, params = null) {
    try {
      const options = {
        method,
        url: endpoint,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (params) {
        options.params = params;
      }
      
      if (data) {
        options.data = data;
      }
      
      const authOptions = this.addAuthHeaders(
        options, 
        method, 
        endpoint, 
        data
      );
      
      const response = await this.httpClient.request(authOptions);
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
    const endpoint = '/api/mix/v1/copytrading/traders';
    
    try {
      const response = await this.authRequest('GET', endpoint, null, options);
      
      if (!response.data) {
        throw new Error('Неверный формат ответа API');
      }
      
      return response.data;
    } catch (error) {
      this.logError('Ошибка получения списка трейдеров', error);
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
    const endpoint = `/api/mix/v1/copytrading/traders/${traderId}/positions`;
    
    try {
      const response = await this.authRequest('GET', endpoint, null, options);
      
      if (!response.data) {
        throw new Error('Неверный формат ответа API');
      }
      
      return response.data;
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
    const endpoint = `/api/mix/v1/copytrading/traders/${traderId}/history`;
    
    try {
      const response = await this.authRequest('GET', endpoint, null, options);
      
      if (!response.data) {
        throw new Error('Неверный формат ответа API');
      }
      
      return response.data;
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
    const endpoint = `/api/mix/v1/copytrading/traders/${traderId}/statistics`;
    
    try {
      const response = await this.authRequest('GET', endpoint);
      
      if (!response.data) {
        throw new Error('Неверный формат ответа API');
      }
      
      // Преобразуем статистику в стандартный формат
      const stats = response.data;
      
      return {
        traderId,
        winRate: parseFloat(stats.winRate || 0),
        totalTrades: parseInt(stats.totalTrades || 0, 10),
        profitFactor: parseFloat(stats.profitFactor || 0),
        avgROI: parseFloat(stats.roi || 0),
        dailyProfit: parseFloat(stats.dailyProfit || 0),
        weeklyProfit: parseFloat(stats.weeklyProfit || 0),
        monthlyProfit: parseFloat(stats.monthlyProfit || 0)
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
      // Извлекаем нужные данные из позиции Bitget
      const {
        symbol,
        positionSide, // LONG или SHORT
        entryPrice,
        markPrice,
        leverage,
        unrealizedPL
      } = position;

      // Определяем базовую и котировочную валюты из символа
      const symbolParts = symbol.split('_');
      const baseAsset = symbolParts[0] || '';
      const quoteAsset = symbolParts[1] || 'USDT';

      // Преобразуем в стандартный формат сигнала
      return {
        pair: symbol,
        baseAsset,
        quoteAsset,
        direction: positionSide === 'LONG' ? 'BUY' : 'SELL',
        entryPoint: parseFloat(entryPrice),
        currentPrice: parseFloat(markPrice),
        // SL и TP могут отсутствовать
        stopLoss: position.stopLoss ? parseFloat(position.stopLoss) : null,
        takeProfit: position.takeProfit ? parseFloat(position.takeProfit) : null,
        leverage: parseInt(leverage, 10),
        unrealizedProfit: parseFloat(unrealizedPL || 0),
        timestamp: Date.now(),
        source: 'bitget-copy-trading',
        exchange: 'bitget',
        traderId: traderInfo.traderId || null,
        traderName: traderInfo.nickname || traderInfo.traderId || 'Unknown',
        traderStats: {
          winRate: parseFloat(traderInfo.winRate || 0),
          totalTrades: parseInt(traderInfo.totalTrades || 0, 10),
          profitFactor: parseFloat(traderInfo.profitFactor || 0),
          avgROI: parseFloat(traderInfo.roi || 0)
        }
      };
    });
  }
}

module.exports = BitgetCopyTradingConnector;