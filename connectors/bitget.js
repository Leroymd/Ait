// connectors/bitget.js - Коннектор к бирже Bitget

const axios = require('axios');
const crypto = require('crypto');

class BitgetConnector {
  constructor(apiConfig = {}) {
    this.apiKey = apiConfig.apiKey || '';
    this.secretKey = apiConfig.secretKey || '';
    this.passphrase = apiConfig.passphrase || ''; // Bitget требует passphrase
    this.baseUrl = 'https://api.bitget.com';
    this.wsBaseUrl = 'wss://ws.bitget.com/mix/v1/stream';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'ACCESS-KEY': this.apiKey
      }
    });
    this.wsConnections = {};
    this.isInitialized = false;
  }

  async initialize() {
    console.log('Инициализация коннектора Bitget...');
    try {
      // Проверяем API с запросом публичной информации
      await this.getExchangeInfo();
      this.isInitialized = true;
      console.log('Коннектор Bitget успешно инициализирован');
      return true;
    } catch (error) {
      console.error('Ошибка инициализации коннектора Bitget:', error.message);
      throw new Error(`Не удалось инициализировать коннектор Bitget: ${error.message}`);
    }
  }

  async getExchangeInfo() {
    try {
      const response = await this.httpClient.get('/api/spot/v1/public/products');
      return response.data;
    } catch (error) {
      console.error('Ошибка получения информации о бирже Bitget:', error.message);
      throw error;
    }
  }

  async getTradingPairs() {
    try {
      const response = await this.httpClient.get('/api/spot/v1/public/products');
      return response.data.data.map(symbol => ({
        symbol: symbol.symbolName,
        baseAsset: symbol.baseCoin,
        quoteAsset: symbol.quoteCoin,
        status: symbol.status === 'online' ? 'TRADING' : 'NOT_TRADING'
      }));
    } catch (error) {
      console.error('Ошибка получения списка торговых пар Bitget:', error.message);
      throw error;
    }
  }

  async getFuturesTradingPairs() {
    try {
      const response = await this.httpClient.get('/api/mix/v1/market/contracts', {
        params: { productType: 'umcbl' } // USDT-M фьючерсы
      });
      
      return response.data.data.map(symbol => ({
        symbol: symbol.symbolName,
        baseAsset: symbol.baseCoin,
        quoteAsset: 'USDT',
        status: symbol.status === 'normal' ? 'TRADING' : 'NOT_TRADING',
        contractType: symbol.symbolName.includes('_PERP') ? 'PERPETUAL' : 'DELIVERY'
      }));
    } catch (error) {
      console.error('Ошибка получения списка фьючерсных пар Bitget:', error.message);
      throw error;
    }
  }

  async getChartData(params) {
    const { symbol, interval, limit, endTime } = params;
    
    try {
      // Преобразуем интервал из формата Binance в формат Bitget
      const intervalMap = {
        '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
        '1h': '1h', '4h': '4h', '1d': '1day', '1w': '1week'
      };
      
      const bitgetInterval = intervalMap[interval] || '1h';
      
      let requestParams = {
        symbol,
        period: bitgetInterval,
        limit: limit
      };
      
      if (endTime) {
        requestParams.endTime = endTime;
      }
      
      // Используем разные эндпоинты в зависимости от типа рынка
      const isSpot = !symbol.includes('_PERP') && !symbol.includes('_USDT');
      const endpoint = isSpot 
        ? '/api/spot/v1/market/candles' 
        : '/api/mix/v1/market/candles';
      
      const response = await this.httpClient.get(endpoint, { params: requestParams });
      
      // Преобразуем формат данных в стандартный
      return response.data.data.map(candle => ({
        openTime: parseInt(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        closeTime: parseInt(candle[0]) + getIntervalMs(interval)
      }));
    } catch (error) {
      console.error(`Ошибка получения данных графика для пары ${symbol}:`, error.message);
      throw error;
    }
  }

  subscribeToKlineStream(symbol, interval, callback) {
    try {
      // Преобразуем интервал в формат Bitget
      const intervalMap = {
        '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
        '1h': '1h', '4h': '4h', '1d': '1day', '1w': '1week'
      };
      
      const bitgetInterval = intervalMap[interval] || '1h';
      
      // Определяем тип рынка (спот или фьючерсы)
      const isSpot = !symbol.includes('_PERP') && !symbol.includes('_USDT');
      const streamType = isSpot ? 'spot' : 'mix';
      
      // Формируем имя канала
      const channelName = `${streamType}_candle${bitgetInterval}`;
      const streamName = `${channelName}_${symbol}`;
      
      // Создаем WebSocket соединение
      const wsUrl = `${this.wsBaseUrl}`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`WebSocket соединение установлено для ${streamName}`);
        
        // Отправляем запрос на подписку
        ws.send(JSON.stringify({
          op: 'subscribe',
          args: [{
            instType: streamType,
            channel: channelName,
            instId: symbol
          }]
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Проверяем, содержит ли сообщение данные свечей
          if (data.data && data.data.length > 0) {
            const candle = data.data[0];
            
            // Преобразуем в стандартный формат
            const standardizedCandle = {
              openTime: parseInt(candle[0]),
              open: parseFloat(candle[1]),
              high: parseFloat(candle[2]),
              low: parseFloat(candle[3]),
              close: parseFloat(candle[4]),
              volume: parseFloat(candle[5]),
              closeTime: parseInt(candle[0]) + getIntervalMs(interval)
            };
            
            callback(standardizedCandle);
          }
        } catch (err) {
          console.error('Ошибка обработки сообщения WebSocket:', err);
        }
      };
      
      ws.onerror = (error) => {
        console.error(`WebSocket ошибка для ${streamName}:`, error);
      };
      
      ws.onclose = () => {
        console.log(`WebSocket соединение закрыто для ${streamName}`);
        delete this.wsConnections[streamName];
      };
      
      this.wsConnections[streamName] = ws;
      return streamName;
    } catch (error) {
      console.error('Ошибка подписки на поток данных:', error);
      return null;
    }
  }

  unsubscribeFromStream(streamName) {
    if (this.wsConnections[streamName]) {
      this.wsConnections[streamName].close();
      return true;
    }
    return false;
  }
}

// Вспомогательная функция для определения длительности интервала в миллисекундах
function getIntervalMs(interval) {
  const intervalMap = {
    '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
    '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000
  };
  
  return intervalMap[interval] || 3600000;
}

module.exports = BitgetConnector;