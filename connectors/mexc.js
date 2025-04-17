// connectors/mexc.js - Коннектор к бирже MEXC

const axios = require('axios');
const crypto = require('crypto');

class MexcConnector {
  constructor(apiConfig = {}) {
    this.apiKey = apiConfig.apiKey || '';
    this.secretKey = apiConfig.secretKey || '';
    this.baseUrl = 'https://api.mexc.com';
    this.futuresBaseUrl = 'https://contract.mexc.com';
    this.wsBaseUrl = 'wss://wbs.mexc.com/ws';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-MEXC-APIKEY': this.apiKey
      }
    });
    this.futuresHttpClient = axios.create({
      baseURL: this.futuresBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-MEXC-APIKEY': this.apiKey
      }
    });
    this.wsConnections = {};
    this.isInitialized = false;
  }

  async initialize() {
    console.log('Инициализация коннектора MEXC...');
    try {
      // Проверяем API с запросом публичной информации
      await this.getExchangeInfo();
      this.isInitialized = true;
      console.log('Коннектор MEXC успешно инициализирован');
      return true;
    } catch (error) {
      console.error('Ошибка инициализации коннектора MEXC:', error.message);
      throw new Error(`Не удалось инициализировать коннектор MEXC: ${error.message}`);
    }
  }

  async getExchangeInfo() {
    try {
      const response = await this.httpClient.get('/api/v3/exchangeInfo');
      return response.data;
    } catch (error) {
      console.error('Ошибка получения информации о бирже MEXC:', error.message);
      throw error;
    }
  }

  async getTradingPairs() {
    try {
      const response = await this.httpClient.get('/api/v3/exchangeInfo');
      return response.data.symbols.map(symbol => ({
        symbol: symbol.symbol,
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        status: symbol.status
      }));
    } catch (error) {
      console.error('Ошибка получения списка торговых пар MEXC:', error.message);
      throw error;
    }
  }

  async getFuturesTradingPairs() {
    try {
      const response = await this.futuresHttpClient.get('/api/v1/contract/detail');
      
      return response.data.data.map(symbol => ({
        symbol: symbol.symbol,
        baseAsset: symbol.baseCoin,
        quoteAsset: symbol.quoteCoin,
        status: symbol.state === 1 ? 'TRADING' : 'NOT_TRADING',
        contractType: symbol.contractType === 0 ? 'PERPETUAL' : 'DELIVERY'
      }));
    } catch (error) {
      console.error('Ошибка получения списка фьючерсных пар MEXC:', error.message);
      throw error;
    }
  }

  async getChartData(params) {
    const { symbol, interval, limit, endTime } = params;
    
    try {
      // Определяем, на каком рынке находится пара (спот или фьючерсы)
      const isFutures = symbol.includes('_USDT') || symbol.includes('_USD');
      
      let endpoint, httpClient, requestParams;
      
      if (isFutures) {
        // Фьючерсный рынок
        httpClient = this.futuresHttpClient;
        endpoint = '/api/v1/contract/kline';
        
        // Преобразуем интервал из формата Binance в формат MEXC Futures
        const intervalMap = {
          '1m': '1', '5m': '5', '15m': '15', '30m': '30',
          '1h': '60', '4h': '240', '1d': '1D', '1w': '1W'
        };
        
        requestParams = {
          symbol,
          interval: intervalMap[interval] || '60',
          limit: limit
        };
        
        if (endTime) {
          requestParams.endTime = endTime;
        }
      } else {
        // Спотовый рынок
        httpClient = this.httpClient;
        endpoint = '/api/v3/klines';
        
        requestParams = {
          symbol,
          interval,
          limit
        };
        
        if (endTime) {
          requestParams.endTime = endTime;
        }
      }
      
      const response = await httpClient.get(endpoint, { params: requestParams });
      
      // Преобразуем данные в стандартный формат
      if (isFutures) {
        // Формат данных фьючерсного рынка
        return response.data.data.map(candle => ({
          openTime: candle.time,
          open: parseFloat(candle.open),
          high: parseFloat(candle.high),
          low: parseFloat(candle.low),
          close: parseFloat(candle.close),
          volume: parseFloat(candle.vol),
          closeTime: candle.time + getIntervalMs(interval)
        }));
      } else {
        // Формат данных спотового рынка
        return response.data.map(candle => ({
          openTime: candle[0],
          open: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          low: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
          closeTime: candle[6]
        }));
      }
    } catch (error) {
      console.error(`Ошибка получения данных графика для пары ${symbol}:`, error.message);
      throw error;
    }
  }

  subscribeToKlineStream(symbol, interval, callback) {
    try {
      // Определяем, на каком рынке находится пара (спот или фьючерсы)
      const isFutures = symbol.includes('_USDT') || symbol.includes('_USD');
      
      let streamName, wsUrl;
      
      if (isFutures) {
        // Фьючерсный рынок
        const intervalMap = {
          '1m': '1', '5m': '5', '15m': '15', '30m': '30',
          '1h': '60', '4h': '240', '1d': '1D', '1w': '1W'
        };
        
        const mexcInterval = intervalMap[interval] || '60';
        streamName = `kline_${symbol}_${mexcInterval}`;
        wsUrl = 'wss://contract.mexc.com/ws';
      } else {
        // Спотовый рынок
        streamName = `${symbol.toLowerCase()}@kline_${interval}`;
        wsUrl = this.wsBaseUrl;
      }
      
      // Создаем WebSocket соединение
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log(`WebSocket соединение установлено для ${streamName}`);
        
        // Отправляем запрос на подписку
        if (isFutures) {
          ws.send(JSON.stringify({
            method: 'kline.subscribe',
            params: [symbol, interval]
          }));
        } else {
          ws.send(JSON.stringify({
            method: 'SUBSCRIPTION',
            params: [streamName]
          }));
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Проверяем, содержит ли сообщение данные свечей
          if (isFutures && data.channel === 'kline' && data.data) {
            // Формат данных фьючерсного рынка
            const candle = data.data;
            
            const standardizedCandle = {
              openTime: candle.time,
              open: parseFloat(candle.open),
              high: parseFloat(candle.high),
              low: parseFloat(candle.low),
              close: parseFloat(candle.close),
              volume: parseFloat(candle.vol),
              closeTime: candle.time + getIntervalMs(interval)
            };
            
            callback(standardizedCandle);
          } else if (!isFutures && data.data && data.data.k) {
            // Формат данных спотового рынка
            const candle = data.data.k;
            
            const standardizedCandle = {
              openTime: candle.t,
              open: parseFloat(candle.o),
              high: parseFloat(candle.h),
              low: parseFloat(candle.l),
              close: parseFloat(candle.c),
              volume: parseFloat(candle.v),
              closeTime: candle.T
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

module.exports = MexcConnector;