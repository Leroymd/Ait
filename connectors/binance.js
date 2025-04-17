// connectors/binance.js - Коннектор к бирже Binance

const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');

class BinanceConnector {
  constructor(apiConfig = {}) {
    this.apiKey = apiConfig.apiKey || '';
    this.secretKey = apiConfig.secretKey || '';
    this.baseUrl = 'https://api.binance.com';
    this.wsBaseUrl = 'wss://stream.binance.com:9443/ws';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-MBX-APIKEY': this.apiKey
      }
    });
    this.wsConnections = {};
    this.isInitialized = false;
  }

  async initialize() {
    console.log('Инициализация коннектора Binance...');
    try {
      if (this.apiKey && this.secretKey) {
        await this.getAccountInfo();
      } else {
        await this.getExchangeInfo();
      }
      this.isInitialized = true;
      console.log('Коннектор Binance успешно инициализирован');
      return true;
    } catch (error) {
      console.error('Ошибка инициализации коннектора Binance:', error.message);
      throw new Error(`Не удалось инициализировать коннектор Binance: ${error.message}`);
    }
  }

  generateSignature(queryString) {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(queryString)
      .digest('hex');
  }

  async getAccountInfo() {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = this.generateSignature(queryString);
    try {
      const response = await this.httpClient.get(`/api/v3/account?${queryString}&signature=${signature}`);
      return response.data;
    } catch (error) {
      console.error('Ошибка получения информации об аккаунте:', error.message);
      throw error;
    }
  }

  async getExchangeInfo() {
    try {
      const response = await this.httpClient.get('/api/v3/exchangeInfo');
      return response.data;
    } catch (error) {
      console.error('Ошибка получения информации о бирже:', error.message);
      throw error;
    }
  }

 /**
 * Получение списка доступных торговых пар
 * @param {string} marketType - тип рынка ('spot' или 'futures')
 * @returns {Promise<Array>} - массив доступных торговых пар
 */
async getTradingPairs(marketType = 'futures') {
  try {
    let endpoint, dataField, symbolField;
    
    // Выбор подходящего API в зависимости от типа рынка
    if (marketType === 'futures') {
      // Для фьючерсов
      endpoint = '/fapi/v1/exchangeInfo';
      dataField = 'symbols';
      symbolField = 'symbol';
    } else {
      // Для спота
      endpoint = '/api/v3/exchangeInfo';
      dataField = 'symbols';
      symbolField = 'symbol';
    }
    
    // Адаптируем URL под нужный тип рынка
    const baseUrl = marketType === 'futures' ? 
      (this.config?.endpoints?.futures || 'https://fapi.binance.com') : 
      (this.config?.endpoints?.spot || 'https://api.binance.com');
      
    const client = axios.create({
      baseURL: baseUrl,
      headers: this.apiKey ? { 'X-MBX-APIKEY': this.apiKey } : {}
    });
    
    const response = await client.get(endpoint);
    
    if (!response.data || !response.data[dataField]) {
      throw new Error(`Неожиданный формат ответа API: поле ${dataField} отсутствует`);
    }
    
    // Фильтруем активные пары
    const pairs = response.data[dataField]
      .filter(symbol => symbol.status === 'TRADING')
      .map(symbol => ({
        symbol: symbol[symbolField],
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        market: marketType
      }));
    
    // Добавляем сортировку - сначала пары с USDT
    pairs.sort((a, b) => {
      // Пары с USDT в конце имеют приоритет
      const aHasUSDT = a.symbol.endsWith('USDT');
      const bHasUSDT = b.symbol.endsWith('USDT');
      
      if (aHasUSDT && !bHasUSDT) return -1;
      if (!aHasUSDT && bHasUSDT) return 1;
      
      // Алфавитная сортировка для остальных
      return a.symbol.localeCompare(b.symbol);
    });
    
    return pairs;
  } catch (error) {
    console.error('Ошибка получения списка торговых пар:', error.message);
    throw error;
  }
}

  async getOpenOrders(pair) {
    if (!pair) {
      return [];
    }
    
    try {
      const timestamp = Date.now();
      const queryString = `symbol=${pair}&timestamp=${timestamp}`;
      const signature = this.generateSignature(queryString);
      
      const response = await this.httpClient.get(
        `/api/v3/openOrders?${queryString}&signature=${signature}`
      );
      
      return response.data;
    } catch (error) {
      console.error(`Ошибка получения открытых ордеров для пары ${pair}:`, error.message);
      return [];
    }
  }


 async getChartData(params) {
  try {
    let symbol, interval, limit, endTime, marketType;

    if (typeof params === 'object') {
      ({ symbol, interval = '1h', limit = 100, endTime, marketType = 'spot' } = params);
    } else {
      symbol = params;
      interval = arguments[1] || '1h';
      limit = arguments[2] || 100;
      endTime = arguments[3] || null;
      marketType = arguments[4] || 'spot';
    }

    const requestParams = {
      symbol,
      interval,
      limit
    };

    if (endTime) {
      requestParams.endTime = endTime;
    }

    const isFutures = marketType === 'futures';
    const endpoint = isFutures ? '/fapi/v1/klines' : '/api/v3/klines';
    const baseUrl = isFutures ? 'https://fapi.binance.com' : 'https://api.binance.com';

    const response = await axios.get(`${baseUrl}${endpoint}`, {
      params: requestParams,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    });

    // Стандартизация данных в нужный формат
    return response.data.map(kline => ({
      openTime: kline[0],
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
      closeTime: kline[6]
    }));
  } catch (error) {
    console.error(`Ошибка получения данных графика для пары ${params.symbol || params}:`, error.message);
    throw error;
  }
}

  async cancelOrder(symbol, orderId) {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('Для отмены ордера необходимы ключи API');
    }
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
    const signature = this.generateSignature(queryString);
    try {
      const response = await this.httpClient.delete(`/api/v3/order?${queryString}&signature=${signature}`);
      return response.data;
    } catch (error) {
      console.error('Ошибка отмены ордера:', error.message);
      throw error;
    }
  }

  async getOpenOrders(symbol = null) {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('Для получения открытых ордеров необходимы ключи API');
    }
    const timestamp = Date.now();
    let queryString = `timestamp=${timestamp}`;
    if (symbol) queryString += `&symbol=${symbol}`;
    const signature = this.generateSignature(queryString);
    try {
      const response = await this.httpClient.get(`/api/v3/openOrders?${queryString}&signature=${signature}`);
      return response.data;
    } catch (error) {
      console.error('Ошибка получения открытых ордеров:', error.message);
      throw error;
    }
  }

  subscribeToKlineStream(symbol, interval, callback) {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsConnection = new WebSocket(`${this.wsBaseUrl}/${streamName}`);
    wsConnection.onopen = () => console.log(`WebSocket соединение установлено для ${streamName}`);
    
    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Преобразуем данные в стандартный формат
        if (data.k) {
          const kline = data.k;
          const standardizedData = {
            openTime: kline.t,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
            volume: parseFloat(kline.v),
            closeTime: kline.T
          };
          callback(standardizedData);
        }
      } catch (error) {
        console.error(`Ошибка обработки сообщения WebSocket:`, error);
      }
    };
    
    wsConnection.onerror = (error) => console.error(`WebSocket ошибка для ${streamName}:`, error);
    wsConnection.onclose = () => {
      console.log(`WebSocket соединение закрыто для ${streamName}`);
      delete this.wsConnections[streamName];
    };
    
    this.wsConnections[streamName] = wsConnection;
    return streamName;
  }

  unsubscribeFromStream(streamName) {
    if (this.wsConnections[streamName]) {
      this.wsConnections[streamName].close();
      return true;
    }
    return false;
  }

  // 🔧 Новый метод для получения цены
  async getTicker(symbol) {
    try {
      const response = await this.httpClient.get('/api/v3/ticker/price', {
        params: { symbol }
      });
      return {
        symbol: response.data.symbol,
        price: parseFloat(response.data.price)
      };
    } catch (error) {
      console.error('Ошибка получения цены тикера:', error.message);
      throw error;
    }
  }
}

module.exports = BinanceConnector;