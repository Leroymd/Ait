// modules/copy-trading/base-connector.js

const axios = require('axios');
const crypto = require('crypto');

/**
 * Базовый класс для всех коннекторов копитрейдинга
 */
class BaseCopyTradingConnector {
  constructor(config = {}) {
    this.config = config;
    this.core = null;
    this.httpClient = null;
    this.name = 'Base Copy Trading Connector';
    this.initialized = false;
  }

  /**
   * Инициализация коннектора
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize(core) {
    this.core = core;
    this.initialized = true;
    return true;
  }

  /**
   * Получение списка ведущих трейдеров
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - Список трейдеров
   */
  async getTraders(options = {}) {
    throw new Error('Method getTraders() must be implemented by subclass');
  }

  /**
   * Получение активных позиций трейдера
   * @param {string} traderId - ID трейдера
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - Список позиций
   */
  async getTraderPositions(traderId, options = {}) {
    throw new Error('Method getTraderPositions() must be implemented by subclass');
  }

  /**
   * Получение истории сделок трейдера
   * @param {string} traderId - ID трейдера
   * @param {Object} options - Дополнительные параметры запроса
   * @returns {Promise<Array>} - История сделок
   */
  async getTraderHistory(traderId, options = {}) {
    throw new Error('Method getTraderHistory() must be implemented by subclass');
  }

  /**
   * Получение статистики трейдера
   * @param {string} traderId - ID трейдера
   * @returns {Promise<Object>} - Статистика трейдера
   */
  async getTraderStats(traderId) {
    throw new Error('Method getTraderStats() must be implemented by subclass');
  }

  /**
   * Преобразование данных позиций в стандартный формат сигналов
   * @param {Array} positions - Позиции трейдера
   * @param {Object} traderInfo - Информация о трейдере
   * @returns {Array} - Стандартизированные сигналы
   */
  convertToStandardSignals(positions, traderInfo = {}) {
    throw new Error('Method convertToStandardSignals() must be implemented by subclass');
  }

  /**
   * Логирование
   * @param {string} message - Сообщение для логирования
   */
  log(message) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('info', `[${this.name}] ${message}`);
    } else {
      console.log(`[${this.name}] ${message}`);
    }
  }

  /**
   * Логирование ошибок
   * @param {string} message - Сообщение об ошибке
   * @param {Error} error - Объект ошибки
   */
  logError(message, error) {
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('error', `[${this.name}] ${message}`, error);
    } else {
      console.error(`[${this.name}] ${message}`, error);
    }
  }
}

module.exports = BaseCopyTradingConnector;