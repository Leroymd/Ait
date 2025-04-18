// modules/copy-trading/binance-connector.js

const BaseCopyTradingConnector = require('./base-connector');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Коннектор для копитрейдинга Binance
 */
class BinanceCopyTradingConnector extends BaseCopyTradingConnector {
  constructor(config = {}) {
    super(config);
    this.name = 'Binance Copy Trading';
    this.apiKey = config.apiKey || '';
    this.secretKey = config.secretKey || '';
    this.baseUrl = config.baseUrl || 'https://api.binance.com';
    this.futuresBaseUrl = config.futuresBaseUrl || 'https://fapi.binance.com';
    this.leaderboardApi = config.leaderboardApi || 'https://www.binance.com/bapi/futures/v1/public/future/leaderboard';
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
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': this.apiKey
      }
    });
    
    this.futuresClient = axios.create({
      baseURL: this.futuresBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': this.apiKey
      }
    });
    
    this.leaderboardClient = axios.create({
      baseURL: this.leaderboardApi,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Проверяем соединение
    try {
      await this.getServerTime();
      this.log('Успешно подключено к Binance Copy Trading API');
      return true;
    } catch (error) {
      this.logError('Ошибка подключения к Binance', error);
      return false;
    }
  }

  /**
   * Получение времени сервера
   * @returns {Promise<Object>} - Время сервера
   */
  async getServerTime() {
    try {
      const response = await this.httpClient.get('/api/v3/time');
      return response.data;
    } catch (error) {
      this.logError('Ошибка получения времени сервера', error);
      throw error;
    }
  }

  /**
   * Генерация подписи для запросов
   * @param {string} queryString - Строка запроса
   * @returns {string} - Подпись
   */
  generateSignature(queryString) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Выполнение аутентифицированного запроса
   * @param {string} endpoint - Конечная точка API
   * @param {Object} params - Параметры запроса
   * @param {string} method - HTTP метод
   * @param {boolean} isFutures - Использовать API фьючерсов
   * @returns {Promise<Object>} - Ответ API
   */
  async authRequest(endpoint, params = {}, method = 'GET', isFutures = false) {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };
    
    // Формируем строку запроса
    const queryString = Object.keys(queryParams)
      .map(key => `${key}=${queryParams[key]}`)
      .join('&');
    
    // Добавляем подпись
    const signature = this.generateSignature(queryString);
    const fullQueryString = `${queryString}&signature=${signature}`;
    
    try {
      const client = isFutures ? this.futuresClient : this.httpClient;
      const url = `${endpoint}?${fullQueryString}`;
      
      let response;
      if (method === 'GET') {
        response = await client.get(url);
      } else if (method === 'POST') {
        response = await client.post(endpoint, null, {
          params: {
            ...queryParams,
            signature
          }
        });
      } else if (method === 'DELETE') {
        response = await client.delete(url);
      }
      
      return response.data;
    } catch (error) {
      this.logError(`Ошибка API запроса: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Получение списка ведущих трейдеров (из лидерборда)
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - Список трейдеров
   */
  async getTraders(options = {}) {
    try {
      // Binance использует специальный API лидерборда для копитрейдинга
      const response = await this.leaderboardClient.post('/getLeaderboardRank', {
        periodType: options.periodType || 'WEEKLY',
        statisticsType: options.statisticsType || 'ROI',
        isShared: true,
        sortType: options.sortType || 1, // 1 - по убыванию, 2 - по возрастанию
        pageNum: options.pageNum || 1,
        pageSize: options.pageSize || 20
      });
      
      if (!response.data || !response.data.data || !response.data.data.rankList) {
        throw new Error('Неверный формат ответа API');
      }
      
      // Преобразуем данные в стандартный формат
      return response.data.data.rankList.map(trader => ({
        traderId: trader.encryptedUid,
        nickname: trader.nickName,
        winRate: trader.winRate,
        profitRate: trader.roi,
        totalTrades: trader.tradeCount,
        followersCount: trader.followerCount || 0,
        weeklyRank: trader.rank,
        weeklyROI: trader.value
      }));
    } catch (error) {
      this.logError('Ошибка получения списка трейдеров Binance', error);
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
    try {
      // У Binance нет прямого API для получения позиций других трейдеров
      // Вместо этого используется API лидерборда для получения открытых позиций
      const response = await this.leaderboardClient.post('/getPositionList', {
        encryptedUid: traderId,
        pageNum: options.pageNum || 1,
        pageSize: options.pageSize || 20
      });
      
      if (!response.data || !response.data.data || !response.data.data.positionList) {
        throw new Error('Неверный формат ответа API');
      }
      
      return response.data.data.positionList;
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
    try {
      // Используем API лидерборда для получения истории сделок
      const response = await this.leaderboardClient.post('/getTradeList', {
        encryptedUid: traderId,
        tradeType: options.tradeType || 'PERPETUAL',
        pageNum: options.pageNum || 1,
        pageSize: options.pageSize || 20
      });
      
      if (!response.data || !response.data.data || !response.data.data.tradeList) {
        throw new Error('Неверный формат ответа API');
      }
      
      return response.data.data.tradeList;
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
    try {
      // Используем API лидерборда для получения статистики трейдера
      const response = await this.leaderboardClient.post('/getUserDetail', {
        encryptedUid: traderId
      });
      
      if (!response.data || !response.data.data) {
        throw new Error('Неверный формат ответа API');
      }
      
      const statsData = response.data.data;
      
      return {
        traderId,
        winRate: parseFloat(statsData.winRate || 0),
        totalTrades: parseInt(statsData.totalTrades || 0, 10),
        profitFactor: parseFloat(statsData.profitFactor || 0),
        avgROI: parseFloat(statsData.roiRate || 0),
        dailyProfit: parseFloat(statsData.dailyReturn || 0),
        weeklyProfit: parseFloat(statsData.weeklyReturn || 0),
        monthlyProfit: parseFloat(statsData.monthlyReturn || 0),
        followersCount: parseInt(statsData.followerCount || 0, 10)
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
      // Извлекаем нужные данные из позиции Binance
      const {
        symbol,
        entryPrice,
        markPrice,
        leverage,
        pnl,
        amount,
        updateTime
      } = position;
      
      // Определение направления позиции
      const direction = amount > 0 ? 'BUY' : 'SELL';
      
      // Преобразуем в стандартный формат сигнала
      return {
        pair: symbol,
        baseAsset: symbol.replace(/USDT$|BUSD$/i, ''),
        quoteAsset: symbol.match(/USDT$|BUSD$/i)?.[0] || 'USDT',
        direction: direction,
        entryPoint: parseFloat(entryPrice),
        currentPrice: parseFloat(markPrice),
        stopLoss: null, // Binance не предоставляет SL/TP через API лидерборда
        takeProfit: null,
        leverage: parseInt(leverage, 10),
        unrealizedProfit: parseFloat(pnl || 0),
        timestamp: updateTime || Date.now(),
        source: 'binance-copy-trading',
        exchange: 'binance',
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

module.exports = BinanceCopyTradingConnector;