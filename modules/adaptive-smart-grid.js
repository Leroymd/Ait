// modules/adaptive-smart-grid.js
// Модуль Adaptive Smart Grid для автоматического размещения ордеров с адаптивными параметрами

const fs = require('fs').promises;
const path = require('path');

/**
 * Модуль Adaptive Smart Grid (ASG)
 * Реализует динамическую сетку ордеров с адаптивными параметрами на основе рыночных условий
 */
class AdaptiveSmartGrid {
  /**
   * Создает новый экземпляр модуля Adaptive Smart Grid
   * @param {Object} config - Конфигурация модуля
   */
  constructor(config) {
    // Метаданные модуля
    this.name = 'Adaptive Smart Grid';
    this.description = 'Динамическая сетка ордеров с адаптивными параметрами на основе рыночных условий';
    this.id = 'adaptive-smart-grid';
    
    // Конфигурация
    this.config = this._initConfig(config || {});
    
    // Состояние модуля
    this.core = null;
    this.isInitialized = false;
    
    // Активные сетки ордеров
    this.activeGrids = new Map();
    
    // История сеток
    this.gridHistory = [];
    
    // Директория для данных
    this.dataDir = path.join(process.cwd(), 'data');
    this.gridsFile = path.join(this.dataDir, 'asg_grids.json');
    this.historyFile = path.join(this.dataDir, 'asg_history.json');
    
    // Обработчики событий
    this.eventHandlers = {};
    
    // Таймеры для проверки состояний сеток
    this.checkInterval = null;
  }

  /**
   * Проверяет, сработал ли трейлинг-стоп
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если трейлинг-стоп сработал
   * @private
   */
  _isTrailingStopTriggered(grid, currentPrice) {
    if (grid.trailingStopValue === null) {
      return false;
    }
    
    if (grid.direction === 'BUY') {
      return currentPrice <= grid.trailingStopValue;
    } else { // SELL
      return currentPrice >= grid.trailingStopValue;
    }
  }

  /**
   * Проверяет, нужно ли произвести частичное закрытие по тейк-профиту
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если нужно частично закрыть
   * @private
   */
  _shouldTakePartialProfit(grid, currentPrice) {
    if (!grid.enablePartialTakeProfit || !grid.partialTakeProfitLevels.length) {
      return false;
    }
    
    // Определяем текущий уровень прибыли
    const openPositions = grid.positions.filter(p => p.status === 'OPEN');
    if (openPositions.length === 0) {
      return false;
    }
    
    // Рассчитываем среднюю цену входа
    const totalInvested = openPositions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0);
    const totalSize = openPositions.reduce((sum, pos) => sum + pos.size, 0);
    const avgEntryPrice = totalInvested / totalSize;
    
    // Рассчитываем текущий процент прибыли
    let profitPercent;
    if (grid.direction === 'BUY') {
      profitPercent = (currentPrice - avgEntryPrice) / avgEntryPrice * 100;
    } else { // SELL
      profitPercent = (avgEntryPrice - currentPrice) / avgEntryPrice * 100;
    }
    
    // Проверяем, достиг ли процент прибыли одного из уровней
    const targetLevel = grid.partialTakeProfitLevels.find(level => {
      // Проверяем, не был ли этот уровень уже исполнен
      if (grid.partialTakeProfitExecuted.includes(level)) {
        return false;
      }
      
      // Рассчитываем требуемый процент прибыли для этого уровня
      const requiredPercent = level * grid.params.takeProfitDistance / avgEntryPrice * 100;
      
      // Проверяем, достигнут ли требуемый процент
      return profitPercent >= requiredPercent;
    });
    
    return targetLevel !== undefined;
  }

  /**
   * Выполняет частичное закрытие позиций по тейк-профиту
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {Promise<boolean>} - Результат операции
   * @private
   */
  async _executePartialTakeProfit(gridId, grid, currentPrice) {
    try {
      // Находим открытые позиции
      const openPositions = grid.positions.filter(p => p.status === 'OPEN');
      if (openPositions.length === 0) {
        return false;
      }
      
      // Рассчитываем среднюю цену входа
      const totalInvested = openPositions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0);
      const totalSize = openPositions.reduce((sum, pos) => sum + pos.size, 0);
      const avgEntryPrice = totalInvested / totalSize;
      
      // Рассчитываем текущий процент прибыли
      let profitPercent;
      if (grid.direction === 'BUY') {
        profitPercent = (currentPrice - avgEntryPrice) / avgEntryPrice * 100;
      } else { // SELL
        profitPercent = (avgEntryPrice - currentPrice) / avgEntryPrice * 100;
      }
      
      // Находим первый неисполненный уровень, который достигнут
      for (const level of grid.partialTakeProfitLevels) {
        // Пропускаем, если уровень уже исполнен
        if (grid.partialTakeProfitExecuted.includes(level)) {
          continue;
        }
        
        // Рассчитываем требуемый процент прибыли для этого уровня
        const requiredPercent = level * grid.params.takeProfitDistance / avgEntryPrice * 100;
        
        // Если уровень еще не достигнут, прерываем цикл
        if (profitPercent < requiredPercent) {
          break;
        }
        
        // Закрываем часть позиций, соответствующую этому уровню
        const positionsToClose = this._selectPositionsForPartialClose(grid, level);
        
        if (positionsToClose.length > 0) {
          // Закрываем выбранные позиции по текущей цене
          await this._closePositionsAtMarket(gridId, positionsToClose, currentPrice, `PARTIAL_TP_${level}`);
          
          // Добавляем уровень в список исполненных
          grid.partialTakeProfitExecuted.push(level);
          
          this.log(`Выполнено частичное закрытие для сетки ${gridId} на уровне ${level} (${profitPercent.toFixed(2)}%)`);
          
          // Оповещаем о частичном закрытии
          this._emitGridEvent('grid.partialTakeProfit', {
            gridId,
            level,
            profitPercent: profitPercent.toFixed(2),
            closedPositions: positionsToClose.length,
            price: currentPrice
          });
          
          // Обновляем сетку
          this.activeGrids.set(gridId, grid);
        }
      }
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при выполнении частичного закрытия для сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Выбирает позиции для частичного закрытия
   * @param {Object} grid - Объект сетки
   * @param {number} level - Уровень частичного закрытия (0-1)
   * @returns {Array} - Массив позиций для закрытия
   * @private
   */
  _selectPositionsForPartialClose(grid, level) {
    // Находим открытые позиции
    const openPositions = grid.positions.filter(p => p.status === 'OPEN');
    
    // Сортируем позиции от наименее выгодных к наиболее выгодным
    const sortedPositions = [...openPositions].sort((a, b) => {
      if (grid.direction === 'BUY') {
        return b.entryPrice - a.entryPrice; // Для покупок: от высоких к низким ценам
      } else {
        return a.entryPrice - b.entryPrice; // Для продаж: от низких к высоким ценам
      }
    });
    
    // Определяем количество позиций для закрытия
    const totalPositions = sortedPositions.length;
    const positionsToClose = Math.ceil(totalPositions * level);
    
    return sortedPositions.slice(0, positionsToClose);
  }

  /**
   * Закрывает позиции по рыночной цене
   * @param {string} gridId - Идентификатор сетки
   * @param {Array} positions - Массив позиций для закрытия
   * @param {number} price - Цена закрытия
   * @param {string} reason - Причина закрытия
   * @returns {Promise<boolean>} - Результат операции
   * @private
   */
  async _closePositionsAtMarket(gridId, positions, price, reason) {
    if (!this.activeGrids.has(gridId) || positions.length === 0) {
      return false;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Для каждой позиции создаем рыночный ордер на закрытие
      for (const position of positions) {
        if (position.status !== 'OPEN') {
          continue;
        }
        
        // Создаем рыночный ордер для закрытия позиции
        const orderResult = await exchange.createOrder(
          grid.pair,
          grid.direction === 'BUY' ? 'SELL' : 'BUY', // Противоположное направление
          'MARKET',
          position.size
        );
        
        // Обновляем позицию
        position.status = 'CLOSED';
        position.closeTime = Date.now();
        position.closePrice = price;
        position.closeOrderId = orderResult.orderId;
        position.closeReason = reason;
        
        // Рассчитываем прибыль/убыток
        const profit = grid.direction === 'BUY' ? 
          (price - position.entryPrice) * position.size : 
          (position.entryPrice - price) * position.size;
        
        position.profit = profit;
        
        // Обновляем статистику сетки
        grid.stats.totalProfit += profit;
        grid.stats.closedPositions++;
        
        // Отменяем другие ордера для этой позиции
        this._cancelOtherPositionOrders(gridId, position);
        
        this.log(`Закрыта позиция ${position.id} в сетке ${gridId} с прибылью ${profit}`);
      }
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при закрытии позиций для сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Проверяет необходимость исполнения отложенных ордеров
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {Promise<void>}
   * @private
   */
  async _checkPendingOrders(gridId, grid, currentPrice) {
    // Проверяем, есть ли активные ордера на вход
    const pendingEntryOrders = grid.entryOrders.filter(o => o.status === 'PENDING');
    
    // Если нет отложенных ордеров, выходим
    if (pendingEntryOrders.length === 0) {
      return;
    }
    
    // Проверяем, не пора ли разместить следующий ордер
    const lowestLevelActive = grid.entryOrders
      .filter(o => o.status === 'ACTIVE' || o.status === 'FILLED')
      .reduce((min, o) => Math.min(min, o.level), Infinity);
    
    // Если нет активных ордеров, размещаем первый
    if (lowestLevelActive === Infinity) {
      const nextOrder = pendingEntryOrders[0];
      await this._placeOrderOnExchange(gridId, nextOrder);
      return;
    }
    
    // Проверяем, достигла ли цена уровня для следующего ордера
    const nextLevel = lowestLevelActive + 1;
    const nextOrder = grid.entryOrders.find(o => o.level === nextLevel && o.status === 'PENDING');
    
    if (!nextOrder) {
      return;
    }
    
    // Проверяем, пересекла ли цена уровень ордера
    const isPriceCrossed = grid.direction === 'BUY' ? 
      currentPrice <= nextOrder.price * 1.01 : // Допуск 1%
      currentPrice >= nextOrder.price * 0.99;  // Допуск 1%
    
    if (isPriceCrossed) {
      await this._placeOrderOnExchange(gridId, nextOrder);
    }
  }

  /**
   * Проверяет, нужно ли закрыть сетку по тейк-профиту
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если нужно закрыть
   * @private
   */
  _shouldCloseGridByTakeProfit(grid, currentPrice) {
    // Если нет открытых позиций, не закрываем сетку
    const openPositions = grid.positions.filter(p => p.status === 'OPEN');
    if (openPositions.length === 0) {
      return false;
    }
    
    // Проверяем, достигли ли все позиции своих тейк-профитов
    const allPositionsClosed = grid.positions.every(p => p.status === 'CLOSED');
    
    // Если все позиции закрыты, закрываем сетку
    if (allPositionsClosed) {
      return true;
    }
    
    // Дополнительно проверяем, достигла ли сетка общего уровня тейк-профита
    const totalProfit = grid.stats.totalProfit;
    const totalInvested = grid.positions.reduce((sum, pos) => {
      if (pos.status === 'OPEN' || pos.status === 'CLOSED') {
        return sum + (pos.entryPrice * pos.size);
      }
      return sum;
    }, 0);
    
    // Если инвестировано мало или ничего, не закрываем сетку
    if (totalInvested < 0.0001) {
      return false;
    }
    
    // Рассчитываем процент прибыли
    const profitPercent = (totalProfit / totalInvested) * 100;
    
    // Проверяем, достигнут ли целевой процент прибыли
    return profitPercent >= this.config.targetProfitPercent;
  }

  /**
   * Корректирует параметры сетки в зависимости от рыночных условий
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {Promise<boolean>} - Результат операции
   * @private
   */
  async _adjustGridIfNeeded(gridId, grid, currentPrice) {
    // Пока сетка активна, не корректируем её параметры
    if (grid.status !== 'ACTIVE') {
      return false;
    }
    
    try {
      // Получаем актуальные данные для анализа
      const chartData = await this._getChartDataForAnalysis(grid.pair);
      
      // Рассчитываем новый ATR
      const currentATR = this._calculateATR(chartData, this.config.atrPeriod);
      
      // Если ATR изменился значительно, корректируем параметры сетки
      const atrChangeRatio = currentATR / grid.params.atr;
      
      if (atrChangeRatio < 0.7 || atrChangeRatio > 1.5) {
        this.log(`Значительное изменение волатильности для сетки ${gridId}: ATR ${grid.params.atr} -> ${currentATR}`);
        
        // Корректируем шаг сетки
        const newGridStep = currentATR * this.config.gridSpacingATRMultiplier;
        
        // Обновляем параметры сетки
        grid.params.atr = currentATR;
        grid.params.gridStep = newGridStep;
        
        // Для ордеров, которые еще не размещены, корректируем цены
        for (let i = 0; i < grid.entryOrders.length; i++) {
          const order = grid.entryOrders[i];
          
          if (order.status === 'PENDING') {
            // Пересчитываем цену ордера
            if (grid.direction === 'BUY') {
              order.price = grid.startPrice - (i * newGridStep);
            } else { // SELL
              order.price = grid.startPrice + (i * newGridStep);
            }
            
            // Обновляем соответствующие ордера тейк-профита и стоп-лосса
            const tpOrder = grid.takeProfitOrders.find(o => o.entryOrderId === order.id);
            const slOrder = grid.stopLossOrders.find(o => o.entryOrderId === order.id);
            
            if (tpOrder) {
              tpOrder.price = grid.direction === 'BUY' ? 
                order.price + (newGridStep * this.config.takeProfitFactor) : 
                order.price - (newGridStep * this.config.takeProfitFactor);
            }
            
            if (slOrder) {
              slOrder.price = grid.direction === 'BUY' ? 
                order.price - (newGridStep * this.config.stopLossFactor) : 
                order.price + (newGridStep * this.config.stopLossFactor);
            }
          }
        }
        
        // Корректируем дистанции для тейк-профита и стоп-лосса
        grid.params.takeProfitDistance = newGridStep * this.config.takeProfitFactor;
        grid.params.stopLossDistance = newGridStep * this.config.stopLossFactor;
        
        // Обновляем сетку
        grid.lastUpdateTime = Date.now();
        this.activeGrids.set(gridId, grid);
        
        this.log(`Параметры сетки ${gridId} скорректированы в соответствии с изменением волатильности`);
        
        // Оповещаем о корректировке сетки
        this._emitGridEvent('grid.adjusted', {
          gridId,
          oldATR: grid.params.atr,
          newATR: currentATR,
          oldGridStep: grid.params.gridStep,
          newGridStep
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.logError(`Ошибка при корректировке параметров сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Проверяет завершение сетки
   * @param {string} gridId - Идентификатор сетки
   * @private
   */
  _checkGridCompletion(gridId) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Проверяем, все ли позиции закрыты
    const allPositionsClosed = grid.positions.length > 0 && 
      grid.positions.every(p => p.status === 'CLOSED');
    
    // Проверяем, есть ли активные ордера
    const hasActiveOrders = grid.entryOrders.some(o => o.status === 'ACTIVE') || 
      grid.takeProfitOrders.some(o => o.status === 'ACTIVE') || 
      grid.stopLossOrders.some(o => o.status === 'ACTIVE');
    
    // Если все позиции закрыты и нет активных ордеров, закрываем сетку
    if (allPositionsClosed && !hasActiveOrders) {
      this.log(`Все позиции в сетке ${gridId} закрыты, завершаем сетку`);
      
      this.completeGrid(gridId, 'ALL_POSITIONS_CLOSED')
        .catch(error => this.logError(`Ошибка при завершении сетки ${gridId}`, error));
    }
  }

  /**
   * Завершает сетку
   * @param {string} gridId - Идентификатор сетки
   * @param {string} reason - Причина завершения
   * @returns {Promise<boolean>} - Результат операции
   */
  async completeGrid(gridId, reason) {
    if (!this.activeGrids.has(gridId)) {
      return false;
    }
    
    try {
      const grid = this.activeGrids.get(gridId);
      
      // Отменяем все активные ордера
      await this._cancelAllGridOrders(gridId);
      
      // Обновляем статус сетки
      grid.status = 'COMPLETED';
      grid.completedAt = Date.now();
      grid.completionReason = reason;
      
      // Сохраняем статистику
      grid.stats.finalProfit = grid.stats.totalProfit;
      grid.stats.duration = grid.completedAt - grid.createdAt;
      
      // Перемещаем сетку в историю
      this.gridHistory.push(grid);
      this.activeGrids.delete(gridId);
      
      // Сохраняем данные
      await this._saveData();
      
      this.log(`Сетка ${gridId} завершена: ${reason}. Итоговая прибыль: ${grid.stats.finalProfit}`);
      
      // Оповещаем о завершении сетки
      this._emitGridEvent('grid.completed', {
        gridId,
        reason,
        profit: grid.stats.finalProfit,
        duration: grid.stats.duration
      });
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при завершении сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Закрывает сетку
   * @param {string} gridId - Идентификатор сетки
   * @param {string} reason - Причина закрытия
   * @returns {Promise<boolean>} - Результат операции
   */
  async closeGrid(gridId, reason) {
    if (!this.activeGrids.has(gridId)) {
      return false;
    }
    
    try {
      const grid = this.activeGrids.get(gridId);
      
      // Закрываем все открытые позиции
      const openPositions = grid.positions.filter(p => p.status === 'OPEN');
      
      if (openPositions.length > 0) {
        // Получаем текущую цену
        const currentPrice = await this._getCurrentPrice(grid.pair);
        
        // Закрываем все открытые позиции по рыночной цене
        await this._closePositionsAtMarket(gridId, openPositions, currentPrice, reason);
      }
      
      // Завершаем сетку
      return await this.completeGrid(gridId, reason);
    } catch (error) {
      this.logError(`Ошибка при закрытии сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Отменяет все активные ордера сетки
   * @param {string} gridId - Идентификатор сетки
   * @returns {Promise<boolean>} - Результат операции
   * @private
   */
  async _cancelAllGridOrders(gridId) {
    if (!this.activeGrids.has(gridId)) {
      return false;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Собираем все активные ордера
      const activeOrders = [
        ...grid.entryOrders.filter(o => o.status === 'ACTIVE'),
        ...grid.takeProfitOrders.filter(o => o.status === 'ACTIVE'),
        ...grid.stopLossOrders.filter(o => o.status === 'ACTIVE')
      ];
      
      // Отменяем каждый ордер
      for (const order of activeOrders) {
        if (order.exchangeOrderId) {
          try {
            await exchange.cancelOrder(grid.pair, order.exchangeOrderId);
            order.status = 'CANCELED';
            order.updatedAt = Date.now();
          } catch (error) {
            this.logError(`Ошибка при отмене ордера ${order.id}`, error);
          }
        }
      }
      
      this.log(`Отменено ${activeOrders.length} активных ордеров для сетки ${gridId}`);
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при отмене ордеров сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Получение активных сеток
   * @returns {Array} - Массив активных сеток
   */
  getActiveGrids() {
    return Array.from(this.activeGrids.values());
  }

  /**
   * Получение истории сеток
   * @param {number} [limit=50] - Максимальное количество записей
   * @returns {Array} - Массив записей истории
   */
  getGridHistory(limit = 50) {
    // Возвращаем последние N записей, отсортированных по времени завершения
    return this.gridHistory
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  }

  /**
   * Получение детальной информации о сетке
   * @param {string} gridId - Идентификатор сетки
   * @returns {Object|null} - Информация о сетке или null, если сетка не найдена
   */
  getGridInfo(gridId) {
    // Проверяем активные сетки
    if (this.activeGrids.has(gridId)) {
      return this.activeGrids.get(gridId);
    }
    
    // Проверяем историю
    const historicalGrid = this.gridHistory.find(g => g.id === gridId);
    
    return historicalGrid || null;
  }

  /**
   * Генерирует событие сетки
   * @param {string} eventType - Тип события
   * @param {Object} data - Данные события
   * @private
   */
  _emitGridEvent(eventType, data) {
    if (!this.core) return;
    
    // Добавляем общие метаданные события
    const eventData = {
      ...data,
      timestamp: Date.now(),
      moduleId: this.id
    };
    
    // Публикуем событие через ядро
    this.core.emit(eventType, eventData);
  }

  /**
   * Регистрация API эндпоинтов
   * @param {Object} app - Экземпляр Express приложения
   */
  registerApiEndpoints(app) {
    if (!app) return;
    
    // Эндпоинт для создания новой сетки на основе сигнала
    app.post('/api/adaptive-grid/create', async (req, res) => {
      try {
        const { signal, options } = req.body;
        
        if (!signal) {
          return res.status(400).json({
            success: false,
            error: 'Необходимо предоставить торговый сигнал'
          });
        }
        
        const result = await this.createGridFromSignal(signal, options || {});
        
        res.json({
          success: true,
          grid: result
        });
      } catch (error) {
        this.logError('Ошибка при создании сетки через API', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения списка активных сеток
    app.get('/api/adaptive-grid/active', (req, res) => {
      try {
        const activeGrids = this.getActiveGrids().map(grid => ({
          id: grid.id,
          pair: grid.pair,
          direction: grid.direction,
          status: grid.status,
          startPrice: grid.startPrice,
          currentPrice: grid.currentPrice,
          createdAt: grid.createdAt,
          positions: grid.positions.filter(p => p.status === 'OPEN').length,
          totalProfit: grid.stats.totalProfit
        }));
        
        res.json({
          success: true,
          grids: activeGrids
        });
      } catch (error) {
        this.logError('Ошибка при получении списка активных сеток', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения истории сеток
    app.get('/api/adaptive-grid/history', (req, res) => {
      try {
        const limit = parseInt(req.query.limit || '50', 10);
        
        const gridHistory = this.getGridHistory(limit).map(grid => ({
          id: grid.id,
          pair: grid.pair,
          direction: grid.direction,
          status: grid.status,
          createdAt: grid.createdAt,
          completedAt: grid.completedAt,
          completionReason: grid.completionReason,
          finalProfit: grid.stats.finalProfit,
          duration: grid.stats.duration
        }));
        
        res.json({
          success: true,
          history: gridHistory
        });
      } catch (error) {
        this.logError('Ошибка при получении истории сеток', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для получения подробной информации о сетке
    app.get('/api/adaptive-grid/:id', (req, res) => {
      try {
        const gridId = req.params.id;
        const grid = this.getGridInfo(gridId);
        
        if (!grid) {
          return res.status(404).json({
            success: false,
            error: 'Сетка не найдена'
          });
        }
        
        res.json({
          success: true,
          grid
        });
      } catch (error) {
        this.logError(`Ошибка при получении информации о сетке ${req.params.id}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для закрытия сетки
    app.post('/api/adaptive-grid/:id/close', async (req, res) => {
      try {
        const gridId = req.params.id;
        const { reason } = req.body;
        
        const result = await this.closeGrid(gridId, reason || 'MANUAL_CLOSE');
        
        if (!result) {
          return res.status(404).json({
            success: false,
            error: 'Сетка не найдена или уже закрыта'
          });
        }
        
        res.json({
          success: true,
          message: `Сетка ${gridId} успешно закрыта`,
          reason: reason || 'MANUAL_CLOSE'
        });
      } catch (error) {
        this.logError(`Ошибка при закрытии сетки ${req.params.id}`, error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // Эндпоинт для обновления конфигурации модуля
    app.post('/api/adaptive-grid/config', (req, res) => {
      try {
        const newConfig = req.body;
        
        if (!newConfig || typeof newConfig !== 'object') {
          return res.status(400).json({
            success: false,
            error: 'Необходим объект конфигурации'
          });
        }
        
        // Обновляем конфигурацию
        this.config = { ...this.config, ...newConfig };
        
        // Сохраняем данные
        this._saveData()
          .catch(error => this.logError('Ошибка при сохранении данных', error));
        
        res.json({
          success: true,
          config: this.config
        });
      } catch (error) {
        this.logError('Ошибка при обновлении конфигурации', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
  }

  /**
   * Очистка ресурсов при выгрузке модуля
   */
  async cleanup() {
    this.log('Очистка ресурсов модуля Adaptive Smart Grid...');
    
    // Останавливаем интервал проверки
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Отписываемся от всех событий
    this._cleanupEventHandlers();
    
    // Сохраняем данные
    await this._saveData();
    
    // Очищаем данные
    this.activeGrids = new Map();
    this.isInitialized = false;
    
    this.log('Модуль Adaptive Smart Grid выгружен');
  }

  /**
   * Очистка обработчиков событий
   * @private
   */
  _cleanupEventHandlers() {
    if (!this.core) return;
    
    // Отписываемся от всех событий
    Object.entries(this.eventHandlers).forEach(([eventType, handlers]) => {
      handlers.forEach(handler => {
        this.core.off(eventType, handler);
      });
    });
    
    // Очищаем список обработчиков
    this.eventHandlers = {};
  }

  /**
   * Вспомогательный метод для логирования
   * @param {string} message - Сообщение для логирования
   */
  log(message) {
    // Если есть логгер в ядре, используем его
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('info', `[AdaptiveSmartGrid] ${message}`);
    } else {
      console.log(`[AdaptiveSmartGrid] ${message}`);
    }
  }

  /**
   * Вспомогательный метод для логирования ошибок
   * @param {string} message - Сообщение об ошибке
   * @param {Error} [error] - Объект ошибки
   */
  logError(message, error) {
    // Если есть логгер в ядре, используем его
    if (this.core && typeof this.core.logger === 'function') {
      this.core.logger('error', `[AdaptiveSmartGrid] ${message}`, error);
    } else {
      console.error(`[AdaptiveSmartGrid] ${message}`, error);
    }
  }
}

  /**
   * Инициализирует конфигурацию по умолчанию
   * @param {Object} config - Конфигурация из конструктора
   * @returns {Object} - Инициализированная конфигурация
   * @private
   */
  _initConfig(config) {
    return {
      // Параметры сетки
      maxGridSize: config.maxGridSize || 10, // Максимальное количество ордеров в сетке
      gridSpacingATRMultiplier: config.gridSpacingATRMultiplier || 0.5, // Множитель ATR для расстояния между ордерами
      defaultLotSize: config.defaultLotSize || 0.01, // Размер позиции по умолчанию
      scalingFactor: config.scalingFactor || 1.2, // Коэффициент увеличения размера позиции (если используется)
      
      // Параметры входа/выхода
      takeProfitFactor: config.takeProfitFactor || 1.5, // Множитель для вычисления тейк-профита
      stopLossFactor: config.stopLossFactor || 2.0, // Множитель для вычисления стоп-лосса
      trailingStopEnabled: config.trailingStopEnabled !== false, // Использовать ли трейлинг-стоп
      trailingStopActivationPercent: config.trailingStopActivationPercent || 0.5, // Активация трейлинг-стопа (% от TP)
      
      // Анализ рынка
      atrPeriod: config.atrPeriod || 14, // Период для расчета ATR
      emaFastPeriod: config.emaFastPeriod || 50, // Период для быстрой EMA
      emaSlowPeriod: config.emaSlowPeriod || 200, // Период для медленной EMA
      
      // Фильтры
      volumeThreshold: config.volumeThreshold || 1.5, // Порог объема для фильтрации (от среднего)
      minimumSignalConfidence: config.minimumSignalConfidence || 0.7, // Минимальная уверенность сигнала
      
      // Управление рисками
      maxRiskPerTrade: config.maxRiskPerTrade || 1.0, // Максимальный риск на сделку (% от баланса)
      maxDrawdownPercent: config.maxDrawdownPercent || 10.0, // Максимальная просадка, при которой сетка закрывается
      maxConcurrentGrids: config.maxConcurrentGrids || 3, // Максимальное количество одновременных сеток
      
      // Интервалы проверки и обновления
      statusCheckInterval: config.statusCheckInterval || 60000, // Интервал проверки статуса сеток (мс)
      
      // Расширенные настройки
      enablePartialTakeProfit: config.enablePartialTakeProfit !== false, // Включить частичное закрытие по TP
      partialTakeProfitLevels: config.partialTakeProfitLevels || [0.3, 0.5, 0.7], // Уровни для частичного закрытия
      dynamicPositionSizing: config.dynamicPositionSizing !== false, // Динамический размер позиции
      
      // Объединяем с дополнительными настройками
      ...config
    };
  }

  /**
   * Инициализация модуля
   * @param {Object} core - Ядро системы
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize(core) {
    try {
      this.log('Инициализация модуля Adaptive Smart Grid...');
      this.core = core;
      
      // Создаем директорию для данных, если она не существует
      await this._ensureDataDirectory();
      
      // Загружаем сохраненные данные
      await this._loadSavedData();
      
      // Регистрируем обработчики событий
      this._registerEventHandlers();
      
      // Запускаем интервал проверки статуса сеток
      this._startGridStatusChecking();
      
      this.isInitialized = true;
      this.log('Модуль Adaptive Smart Grid успешно инициализирован');
      
      return true;
    } catch (error) {
      this.logError('Ошибка инициализации модуля Adaptive Smart Grid', error);
      throw error;
    }
  }

  /**
   * Создает директорию для данных, если она не существует
   * @returns {Promise<void>}
   * @private
   */
  async _ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // Игнорируем ошибку, если директория уже существует
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Загружает сохраненные данные
   * @returns {Promise<void>}
   * @private
   */
  async _loadSavedData() {
    try {
      // Загружаем активные сетки
      try {
        const gridsData = await fs.readFile(this.gridsFile, 'utf8');
        const grids = JSON.parse(gridsData);
        
        // Восстанавливаем Map из массива
        this.activeGrids = new Map(Object.entries(grids));
        this.log(`Загружено ${this.activeGrids.size} активных сеток`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Файл не существует, используем пустую Map
        this.activeGrids = new Map();
      }
      
      // Загружаем историю сеток
      try {
        const historyData = await fs.readFile(this.historyFile, 'utf8');
        this.gridHistory = JSON.parse(historyData);
        this.log(`Загружено ${this.gridHistory.length} записей истории сеток`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // Файл не существует, используем пустой массив
        this.gridHistory = [];
      }
    } catch (error) {
      this.logError('Ошибка при загрузке сохраненных данных', error);
      // Инициализируем пустыми значениями при ошибке
      this.activeGrids = new Map();
      this.gridHistory = [];
    }
  }

  /**
   * Сохраняет текущие данные
   * @returns {Promise<void>}
   * @private
   */
  async _saveData() {
    try {
      // Преобразуем Map в объект для сохранения
      const gridsObject = Object.fromEntries(this.activeGrids);
      
      // Сохраняем активные сетки
      await fs.writeFile(this.gridsFile, JSON.stringify(gridsObject, null, 2));
      
      // Сохраняем историю сеток
      await fs.writeFile(this.historyFile, JSON.stringify(this.gridHistory, null, 2));
      
      this.log('Данные успешно сохранены');
    } catch (error) {
      this.logError('Ошибка при сохранении данных', error);
    }
  }

  /**
   * Регистрирует обработчики событий
   * @private
   */
  _registerEventHandlers() {
    if (!this.core) return;
    
    // Обработчик изменения торговой пары
    this._addEventHandler('tradingPair.changed', this._onTradingPairChanged.bind(this));
    
    // Обработчик новых торговых сигналов
    this._addEventHandler('trading-signal', this._onTradingSignal.bind(this));
    
    // Обработчик исполнения ордеров
    this._addEventHandler('order.executed', this._onOrderExecuted.bind(this));
    
    // Обработчик закрытия позиции
    this._addEventHandler('position.closed', this._onPositionClosed.bind(this));
  }

  /**
   * Добавляет обработчик события
   * @param {string} eventType - Тип события
   * @param {Function} handler - Функция-обработчик
   * @private
   */
  _addEventHandler(eventType, handler) {
    if (!this.core) return;
    
    // Сохраняем обработчик для возможности отписки
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    
    this.eventHandlers[eventType].push(handler);
    
    // Подписываемся на событие
    this.core.on(eventType, handler);
  }

  /**
   * Обработчик изменения торговой пары
   * @param {Object} data - Данные события
   * @private
   */
  _onTradingPairChanged(data) {
    this.log(`Изменение торговой пары на ${data.newPair}`);
    // Можно добавить логику для корректировки существующих сеток при изменении пары
  }

  /**
   * Обработчик новых торговых сигналов
   * @param {Object} data - Данные события
   * @private
   */
  _onTradingSignal(data) {
    const signal = data.signal;
    
    this.log(`Получен торговый сигнал: ${signal.direction} ${signal.pair} (уверенность: ${signal.confidence})`);
    
    // Проверяем, подходит ли сигнал для создания сетки
    if (this._isValidSignalForGrid(signal)) {
      // Создаем новую сетку на основе сигнала
      this.createGridFromSignal(signal)
        .then(result => {
          this.log(`Сетка создана: ${result.gridId}`);
        })
        .catch(error => {
          this.logError(`Ошибка при создании сетки: ${error.message}`, error);
        });
    } else {
      this.log('Сигнал не соответствует критериям для создания сетки');
    }
  }

  /**
   * Проверяет, подходит ли сигнал для создания сетки
   * @param {Object} signal - Торговый сигнал
   * @returns {boolean} - true, если сигнал подходит
   * @private
   */
  _isValidSignalForGrid(signal) {
    // Проверка уровня уверенности
    if (signal.confidence < this.config.minimumSignalConfidence) {
      return false;
    }
    
    // Проверка количества существующих сеток
    if (this.activeGrids.size >= this.config.maxConcurrentGrids) {
      return false;
    }
    
    // Проверка наличия сетки для этой пары
    for (const [, grid] of this.activeGrids) {
      if (grid.pair === signal.pair) {
        return false;
      }
    }
    
    // Дополнительные проверки (например, тренд, волатильность и т.д.)
    // ...
    
    return true;
  }

  /**
   * Обработчик исполнения ордеров
   * @param {Object} data - Данные события
   * @private
   */
  _onOrderExecuted(data) {
    const { orderId, gridId, status } = data;
    
    if (!gridId || !this.activeGrids.has(gridId)) {
      return;
    }
    
    this.log(`Ордер ${orderId} из сетки ${gridId} исполнен со статусом ${status}`);
    
    // Обновляем статус ордера в сетке
    this._updateOrderStatus(gridId, orderId, status, data);
  }

  /**
   * Обработчик закрытия позиции
   * @param {Object} data - Данные события
   * @private
   */
  _onPositionClosed(data) {
    const { positionId, gridId, profit } = data;
    
    if (!gridId || !this.activeGrids.has(gridId)) {
      return;
    }
    
    this.log(`Позиция ${positionId} из сетки ${gridId} закрыта с прибылью ${profit}`);
    
    // Обновляем информацию о позиции в сетке
    this._updatePositionStatus(gridId, positionId, 'CLOSED', data);
    
    // Проверяем, нужно ли закрыть всю сетку
    this._checkGridCompletion(gridId);
  }

  /**
   * Запускает периодическую проверку статуса сеток
   * @private
   */
  _startGridStatusChecking() {
    // Останавливаем предыдущий интервал, если он есть
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Запускаем первую проверку
    this._checkAllGridsStatus();
    
    // Запускаем интервал для регулярных проверок
    this.checkInterval = setInterval(
      () => this._checkAllGridsStatus(),
      this.config.statusCheckInterval
    );
    
    this.log(`Запущена проверка статуса сеток с интервалом ${this.config.statusCheckInterval}мс`);
  }

  /**
   * Проверяет статус всех активных сеток
   * @private
   */
  async _checkAllGridsStatus() {
    if (this.activeGrids.size === 0) {
      return;
    }
    
    this.log(`Проверка статуса ${this.activeGrids.size} активных сеток`);
    
    for (const [gridId, grid] of this.activeGrids) {
      try {
        await this._checkGridStatus(gridId, grid);
      } catch (error) {
        this.logError(`Ошибка при проверке статуса сетки ${gridId}`, error);
      }
    }
  }

  /**
   * Проверяет статус конкретной сетки
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @private
   */
  async _checkGridStatus(gridId, grid) {
    // Получаем текущую цену
    const currentPrice = await this._getCurrentPrice(grid.pair);
    
    // Обновляем текущую цену в сетке
    grid.currentPrice = currentPrice;
    grid.lastCheckTime = Date.now();
    
    // Проверяем необходимость закрытия сетки по стоп-лоссу
    if (this._shouldCloseGridByStopLoss(grid, currentPrice)) {
      this.log(`Сетка ${gridId} достигла стоп-лосса, закрываем`);
      await this.closeGrid(gridId, 'STOP_LOSS');
      return;
    }
    
    // Проверяем необходимость срабатывания трейлинг-стопа
    if (grid.trailingStopEnabled && this._shouldActivateTrailingStop(grid, currentPrice)) {
      this._updateTrailingStop(gridId, grid, currentPrice);
    }
    
    // Проверяем необходимость частичного закрытия по тейк-профиту
    if (grid.enablePartialTakeProfit && this._shouldTakePartialProfit(grid, currentPrice)) {
      await this._executePartialTakeProfit(gridId, grid, currentPrice);
    }
    
    // Проверяем необходимость исполнения отложенных ордеров
    await this._checkPendingOrders(gridId, grid, currentPrice);
    
    // Проверяем необходимость закрытия сетки по тейк-профиту
    if (this._shouldCloseGridByTakeProfit(grid, currentPrice)) {
      this.log(`Сетка ${gridId} достигла тейк-профита, закрываем`);
      await this.closeGrid(gridId, 'TAKE_PROFIT');
      return;
    }
    
    // Проверяем необходимость корректировки сетки на основе рыночных условий
    await this._adjustGridIfNeeded(gridId, grid, currentPrice);
    
    // Сохраняем обновленное состояние сетки
    this.activeGrids.set(gridId, grid);
    
    // Сохраняем данные в файл
    await this._saveData();
  }

  /**
   * Получает текущую цену для указанной пары
   * @param {string} pair - Торговая пара
   * @returns {Promise<number>} - Текущая цена
   * @private
   */
  async _getCurrentPrice(pair) {
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Получаем текущую цену
      const ticker = await exchange.getTicker(pair);
      
      return parseFloat(ticker.price);
    } catch (error) {
      this.logError(`Ошибка при получении текущей цены для ${pair}`, error);
      throw error;
    }
  }

  /**
   * Создает новую сетку ордеров на основе торгового сигнала
   * @param {Object} signal - Торговый сигнал
   * @param {Object} [options={}] - Дополнительные опции
   * @returns {Promise<Object>} - Информация о созданной сетке
   */
  async createGridFromSignal(signal, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Модуль не инициализирован');
    }
    
    this.log(`Создание сетки на основе сигнала: ${signal.direction} ${signal.pair}`);
    
    // Проверяем лимит на количество сеток
    if (this.activeGrids.size >= this.config.maxConcurrentGrids) {
      throw new Error('Превышен лимит на количество одновременных сеток');
    }
    
    // Генерируем уникальный ID для сетки
    const gridId = `grid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      // Получаем данные для расчета параметров сетки
      const chartData = await this._getChartDataForAnalysis(signal.pair);
      
      // Рассчитываем параметры сетки
      const gridParams = await this._calculateGridParameters(signal, chartData, options);
      
      // Создаем объект сетки
      const grid = {
        id: gridId,
        pair: signal.pair,
        direction: signal.direction,
        startPrice: signal.entryPoint,
        currentPrice: signal.entryPoint,
        entryOrders: [],
        positions: [],
        takeProfitOrders: [],
        stopLossOrders: [],
        status: 'CREATED',
        createdAt: Date.now(),
        lastUpdateTime: Date.now(),
        lastCheckTime: Date.now(),
        params: gridParams,
        signal: {
          id: signal.id || null,
          confidence: signal.confidence,
          timestamp: signal.timestamp,
          source: signal.source || 'unknown'
        },
        stats: {
          totalProfit: 0,
          filledOrders: 0,
          closedPositions: 0,
          maxDrawdown: 0,
          highestPrice: signal.entryPoint,
          lowestPrice: signal.entryPoint
        },
        // Параметры из конфигурации и опций
        trailingStopEnabled: options.trailingStopEnabled !== undefined ? 
          options.trailingStopEnabled : this.config.trailingStopEnabled,
        trailingStopValue: null,
        trailingStopActivationLevel: null,
        enablePartialTakeProfit: options.enablePartialTakeProfit !== undefined ? 
          options.enablePartialTakeProfit : this.config.enablePartialTakeProfit,
        partialTakeProfitLevels: options.partialTakeProfitLevels || this.config.partialTakeProfitLevels,
        partialTakeProfitExecuted: []
      };
      
      // Генерируем ордера для сетки
      const orders = this._generateGridOrders(grid);
      
      // Сохраняем ордера в сетке
      grid.entryOrders = orders.entryOrders;
      grid.takeProfitOrders = orders.takeProfitOrders;
      grid.stopLossOrders = orders.stopLossOrders;
      
      // Обновляем статус сетки
      grid.status = 'PENDING';
      
      // Сохраняем сетку
      this.activeGrids.set(gridId, grid);
      
      // Размещаем ордера на бирже
      await this._placeGridOrders(gridId, grid);
      
      // Обновляем статус сетки
      grid.status = 'ACTIVE';
      this.activeGrids.set(gridId, grid);
      
      // Сохраняем данные
      await this._saveData();
      
      // Оповещаем о создании сетки
      this._emitGridEvent('grid.created', { gridId, pair: signal.pair, direction: signal.direction });
      
      this.log(`Сетка ${gridId} создана и активирована`);
      
      return {
        success: true,
        gridId,
        pair: signal.pair,
        direction: signal.direction,
        entryOrders: grid.entryOrders.length,
        takeProfitOrders: grid.takeProfitOrders.length,
        stopLossOrders: grid.stopLossOrders.length
      };
    } catch (error) {
      this.logError(`Ошибка при создании сетки: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Получает данные графика для анализа
   * @param {string} pair - Торговая пара
   * @returns {Promise<Array>} - Данные графика
   * @private
   */
  async _getChartDataForAnalysis(pair) {
    try {
      return await this.core.getChartData({
        symbol: pair,
        interval: '1h', // Используем часовой таймфрейм для анализа
        limit: 200 // Запрашиваем достаточно данных для расчета индикаторов
      });
    } catch (error) {
      this.logError(`Ошибка при получении данных графика для ${pair}`, error);
      throw error;
    }
  }

  /**
   * Рассчитывает параметры сетки на основе рыночных данных
   * @param {Object} signal - Торговый сигнал
   * @param {Array} chartData - Данные графика
   * @param {Object} options - Дополнительные опции
   * @returns {Promise<Object>} - Параметры сетки
   * @private
   */
  async _calculateGridParameters(signal, chartData, options) {
    // Рассчитываем ATR (Average True Range)
    const atr = this._calculateATR(chartData, this.config.atrPeriod);
    
    // Рассчитываем EMA для определения тренда
    const emeFast = this._calculateEMA(chartData, this.config.emaFastPeriod);
    const emeSlow = this._calculateEMA(chartData, this.config.emaSlowPeriod);
    
    // Определяем тренд на основе EMA
    const trend = emeFast > emeSlow ? 'BULLISH' : (emeFast < emeSlow ? 'BEARISH' : 'NEUTRAL');
    
    // Рассчитываем размер шага сетки на основе ATR
    const gridStep = atr * this.config.gridSpacingATRMultiplier;
    
    // Рассчитываем количество уровней в сетке (с учетом направления и тренда)
    let gridLevels = options.gridLevels || this._determineOptimalGridLevels(signal, trend);
    
    // Ограничиваем максимальным значением из конфигурации
    gridLevels = Math.min(gridLevels, this.config.maxGridSize);
    
    // Рассчитываем размер позиции
    const positionSize = this._calculatePositionSize(signal, atr, options);
    
    // Рассчитываем целевые уровни для тейк-профита и стоп-лосса
    const takeProfitDistance = gridStep * this.config.takeProfitFactor;
    const stopLossDistance = gridStep * this.config.stopLossFactor;
    
    // Рассчитываем уровни активации трейлинг-стопа
    const trailingStopActivationLevel = signal.direction === 'BUY' ? 
      signal.entryPoint + (takeProfitDistance * this.config.trailingStopActivationPercent) : 
      signal.entryPoint - (takeProfitDistance * this.config.trailingStopActivationPercent);
    
    return {
      atr,
      trend,
      gridStep,
      gridLevels,
      positionSize,
      takeProfitDistance,
      stopLossDistance,
      trailingStopActivationLevel,
      // Дополнительная информация для принятия решений
      emaFast: emeFast,
      emaSlow: emeSlow,
      marketConditions: {
        isVolatile: atr > (this._calculateAverageATR(chartData, this.config.atrPeriod, 5) * 1.5),
        volumeRatio: this._calculateVolumeRatio(chartData, 5)
      }
    };
  }

  /**
   * Рассчитывает ATR (Average True Range)
   * @param {Array} chartData - Данные графика
   * @param {number} period - Период ATR
   * @returns {number} - Значение ATR
   * @private
   */
  _calculateATR(chartData, period) {
    if (!chartData || chartData.length < period + 1) {
      return 0;
    }
    
    const trueRanges = [];
    
    for (let i = 1; i < chartData.length; i++) {
      const high = chartData[i].high;
      const low = chartData[i].low;
      const prevClose = chartData[i - 1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }
    
    // Рассчитываем ATR как среднее значение за период
    const lastTrueRanges = trueRanges.slice(-period);
    return lastTrueRanges.reduce((sum, tr) => sum + tr, 0) / lastTrueRanges.length;
  }

  /**
   * Рассчитывает средний ATR за несколько периодов
   * @param {Array} chartData - Данные графика
   * @param {number} period - Период ATR
   * @param {number} avgPeriods - Количество периодов для усреднения
   * @returns {number} - Среднее значение ATR
   * @private
   */
  _calculateAverageATR(chartData, period, avgPeriods) {
    const atrs = [];
    
    for (let i = 0; i < avgPeriods; i++) {
      if (chartData.length < period + i + 1) break;
      
      const periodData = chartData.slice(0, chartData.length - i);
      atrs.push(this._calculateATR(periodData, period));
    }
    
    return atrs.reduce((sum, atr) => sum + atr, 0) / atrs.length;
  }

  /**
   * Рассчитывает EMA (Exponential Moving Average)
   * @param {Array} chartData - Данные графика
   * @param {number} period - Период EMA
   * @returns {number} - Значение EMA
   * @private
   */
  _calculateEMA(chartData, period) {
    if (!chartData || chartData.length < period) {
      return 0;
    }
    
    // Рассчитываем SMA для первого значения EMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += chartData[i].close;
    }
    let ema = sum / period;
    
    // Рассчитываем множитель
    const multiplier = 2 / (period + 1);
    
    // Рассчитываем EMA для остальных значений
    for (let i = period; i < chartData.length; i++) {
      ema = (chartData[i].close - ema) * multiplier + ema;
    }
    
    return ema;
  }

  /**
   * Рассчитывает отношение текущего объема к среднему
   * @param {Array} chartData - Данные графика
   * @param {number} periods - Количество периодов для усреднения
   * @returns {number} - Отношение объема
   * @private
   */
  _calculateVolumeRatio(chartData, periods) {
    if (!chartData || chartData.length < periods + 1) {
      return 1;
    }
    
    const currentVolume = chartData[chartData.length - 1].volume;
    
    let sumVolume = 0;
    for (let i = chartData.length - periods - 1; i < chartData.length - 1; i++) {
      sumVolume += chartData[i].volume;
    }
    
    const avgVolume = sumVolume / periods;
    
    return avgVolume > 0 ? currentVolume / avgVolume : 1;
  }

  /**
   * Определяет оптимальное количество уровней сетки
   * @param {Object} signal - Торговый сигнал
   * @param {string} trend - Текущий тренд
   * @returns {number} - Количество уровней
   * @private
   */
  _determineOptimalGridLevels(signal, trend) {
    // Базовое количество уровней
    let levels = 5;
    
    // Корректируем в зависимости от тренда и направления
    if (signal.direction === 'BUY') {
      if (trend === 'BULLISH') {
        levels = 7; // Больше уровней в направлении тренда
      } else if (trend === 'BEARISH') {
        levels = 3; // Меньше уровней против тренда
      }
    } else { // SELL
      if (trend === 'BEARISH') {
        levels = 7; // Больше уровней в направлении тренда
      } else if (trend === 'BULLISH') {
        levels = 3; // Меньше уровней против тренда
      }
    }
    
    // Корректируем в зависимости от уверенности сигнала
    if (signal.confidence > 0.9) {
      levels += 2; // Больше уровней при высокой уверенности
    } else if (signal.confidence < 0.75) {
      levels -= 1; // Меньше уровней при низкой уверенности
    }
    
    // Гарантируем, что количество уровней в разумных пределах
    return Math.max(2, Math.min(levels, 10));
  }

  /**
   * Рассчитывает размер позиции
   * @param {Object} signal - Торговый сигнал
   * @param {number} atr - Значение ATR
   * @param {Object} options - Дополнительные опции
   * @returns {number} - Размер позиции
   * @private
   */
  _calculatePositionSize(signal, atr, options) {
    // Используем заданный размер позиции, если он указан
    if (options.positionSize) {
      return options.positionSize;
    }
    
    // В противном случае расчет на основе риска
    try {
      // Получаем информацию о балансе
      const balance = this._getAccountBalance();
      
      // Рассчитываем риск на сделку
      const riskAmount = balance * (this.config.maxRiskPerTrade / 100);
      
      // Расчет размера позиции на основе стоп-лосса
      let stopLossDistance;
      if (signal.stopLoss) {
        // Если стоп-лосс указан в сигнале
        stopLossDistance = Math.abs(signal.entryPoint - signal.stopLoss);
      } else {
        // Иначе используем ATR для расчета стоп-лосса
        stopLossDistance = atr * this.config.stopLossFactor;
      }
      
      // Расчет размера позиции: рискуемая сумма / (цена входа * расстояние до стоп-лосса в %)
      const riskPerUnit = stopLossDistance / signal.entryPoint;
      let positionSize = riskAmount / (signal.entryPoint * riskPerUnit);
      
      // Округляем до требуемой точности
      positionSize = this._roundPositionSize(positionSize);
      
      return positionSize;
    } catch (error) {
      this.logError('Ошибка при расчете размера позиции', error);
      
      // Возвращаем размер по умолчанию при ошибке
      return this.config.defaultLotSize;
    }
  }

  /**
   * Получает информацию о балансе аккаунта
   * @returns {number} - Баланс аккаунта
   * @private
   */
  _getAccountBalance() {
    // В реальной реализации здесь будет запрос к бирже через коннектор
    // Для примера возвращаем фиксированное значение
    return 1000;
  }

  /**
   * Округляет размер позиции до требуемой точности
   * @param {number} size - Размер позиции
   * @returns {number} - Округленный размер позиции
   * @private
   */
  _roundPositionSize(size) {
    // Округление до 3 знаков после запятой
    return Math.floor(size * 1000) / 1000;
  }

  /**
   * Генерирует ордера для сетки
   * @param {Object} grid - Объект сетки
   * @returns {Object} - Ордера сетки (входные, тейк-профит, стоп-лосс)
   * @private
   */
  _generateGridOrders(grid) {
    const { direction, startPrice, params } = grid;
    const { gridStep, gridLevels, positionSize, takeProfitDistance, stopLossDistance } = params;
    
    const entryOrders = [];
    const takeProfitOrders = [];
    const stopLossOrders = [];
    
    // Генерируем ордера входа
    for (let i = 0; i < gridLevels; i++) {
      // Рассчитываем цену для текущего уровня
      let orderPrice;
      if (direction === 'BUY') {
        orderPrice = startPrice - (i * gridStep);
      } else { // SELL
        orderPrice = startPrice + (i * gridStep);
      }
      
      // Рассчитываем размер позиции с учетом увеличения для дальних уровней
      const orderSize = positionSize * (this.config.dynamicPositionSizing ? 
        Math.pow(this.config.scalingFactor, i) : 1);
      
      // Формируем ордер
      const order = {
        id: `${grid.id}_entry_${i}`,
        price: this._roundPrice(orderPrice),
        size: this._roundPositionSize(orderSize),
        type: 'LIMIT',
        status: 'PENDING',
        level: i,
        created: Date.now()
      };
      
      entryOrders.push(order);
      
      // Генерируем соответствующие ордера тейк-профита и стоп-лосса
      const takeProfitPrice = direction === 'BUY' ? 
        orderPrice + takeProfitDistance : 
        orderPrice - takeProfitDistance;
      
      const stopLossPrice = direction === 'BUY' ? 
        orderPrice - stopLossDistance : 
        orderPrice + stopLossDistance;
      
      takeProfitOrders.push({
        id: `${grid.id}_tp_${i}`,
        price: this._roundPrice(takeProfitPrice),
        size: this._roundPositionSize(orderSize),
        type: 'LIMIT',
        status: 'PENDING',
        level: i,
        entryOrderId: order.id,
        created: Date.now()
      });
      
      stopLossOrders.push({
        id: `${grid.id}_sl_${i}`,
        price: this._roundPrice(stopLossPrice),
        size: this._roundPositionSize(orderSize),
        type: 'STOP',
        status: 'PENDING',
        level: i,
        entryOrderId: order.id,
        created: Date.now()
      });
    }
    
    return {
      entryOrders,
      takeProfitOrders,
      stopLossOrders
    };
  }

  /**
   * Округляет цену до требуемой точности
   * @param {number} price - Цена
   * @returns {number} - Округленная цена
   * @private
   */
  _roundPrice(price) {
    // Округление до 2 знаков после запятой
    return Math.round(price * 100) / 100;
  }

  /**
   * Размещает ордера сетки на бирже
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @returns {Promise<boolean>} - Результат размещения ордеров
   * @private
   */
  async _placeGridOrders(gridId, grid) {
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Размещаем только первый ордер сетки, остальные - по мере исполнения
      const firstOrder = grid.entryOrders[0];
      
      // Проверяем, есть ли ордера
      if (!firstOrder) {
        this.logError(`Нет ордеров для размещения в сетке ${gridId}`);
        return false;
      }
      
      // Размещаем ордер на бирже
      const orderResult = await exchange.createOrder(
        grid.pair,
        grid.direction,
        firstOrder.type,
        firstOrder.size,
        firstOrder.price
      );
      
      // Обновляем информацию об ордере
      firstOrder.status = 'ACTIVE';
      firstOrder.exchangeOrderId = orderResult.orderId;
      
      this.log(`Размещен первый ордер сетки ${gridId}: ${firstOrder.id} (${firstOrder.price})`);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при размещении ордеров сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Обновляет статус ордера в сетке
   * @param {string} gridId - Идентификатор сетки
   * @param {string} orderId - Идентификатор ордера
   * @param {string} status - Новый статус
   * @param {Object} data - Дополнительные данные
   * @private
   */
  _updateOrderStatus(gridId, orderId, status, data) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Ищем ордер во всех списках
    let order = grid.entryOrders.find(o => o.id === orderId || o.exchangeOrderId === orderId);
    if (!order) {
      order = grid.takeProfitOrders.find(o => o.id === orderId || o.exchangeOrderId === orderId);
    }
    if (!order) {
      order = grid.stopLossOrders.find(o => o.id === orderId || o.exchangeOrderId === orderId);
    }
    
    if (!order) {
      this.logError(`Ордер ${orderId} не найден в сетке ${gridId}`);
      return;
    }
    
    // Обновляем статус ордера
    order.status = status;
    order.updatedAt = Date.now();
    
    // Добавляем дополнительные данные
    if (data.fillPrice) {
      order.fillPrice = data.fillPrice;
    }
    if (data.fillTime) {
      order.fillTime = data.fillTime;
    }
    
    // Если ордер исполнен, создаем позицию
    if (status === 'FILLED' && grid.entryOrders.includes(order)) {
      this._createPosition(gridId, order, data);
    }
    
    // Если исполнен ордер закрытия, обновляем соответствующую позицию
    if (status === 'FILLED' && 
        (grid.takeProfitOrders.includes(order) || grid.stopLossOrders.includes(order))) {
      this._updatePositionForClosedOrder(gridId, order, data);
    }
    
    // Обновляем сетку
    grid.lastUpdateTime = Date.now();
    this.activeGrids.set(gridId, grid);
    
    // Сохраняем данные
    this._saveData()
      .catch(error => this.logError('Ошибка при сохранении данных', error));
  }

  /**
   * Создает позицию на основе исполненного ордера
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} order - Исполненный ордер
   * @param {Object} data - Дополнительные данные
   * @private
   */
  _createPosition(gridId, order, data) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Создаем новую позицию
    const position = {
      id: `${gridId}_position_${order.level}`,
      entryOrderId: order.id,
      entryPrice: order.fillPrice || order.price,
      size: order.size,
      direction: grid.direction,
      status: 'OPEN',
      openTime: order.fillTime || Date.now(),
      level: order.level
    };
    
    // Добавляем позицию в список
    grid.positions.push(position);
    
    // Активируем соответствующие ордера тейк-профита и стоп-лосса
    this._activatePositionOrders(gridId, position);
    
    // Если это первый исполненный ордер, размещаем следующий в сетке
    const nextOrderLevel = order.level + 1;
    if (nextOrderLevel < grid.entryOrders.length) {
      const nextOrder = grid.entryOrders[nextOrderLevel];
      if (nextOrder.status === 'PENDING') {
        this._placeOrderOnExchange(gridId, nextOrder)
          .catch(error => this.logError(`Ошибка при размещении следующего ордера сетки ${gridId}`, error));
      }
    }
    
    // Обновляем статистику сетки
    grid.stats.filledOrders++;
    
    // Обновляем сетку
    grid.lastUpdateTime = Date.now();
    this.activeGrids.set(gridId, grid);
    
    this.log(`Создана новая позиция в сетке ${gridId}: ${position.id} (${position.entryPrice})`);
    
    // Оповещаем о создании позиции
    this._emitGridEvent('grid.position.opened', {
      gridId,
      positionId: position.id,
      level: position.level,
      price: position.entryPrice,
      size: position.size
    });
  }

  /**
   * Активирует ордера тейк-профита и стоп-лосса для позиции
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} position - Открытая позиция
   * @private
   */
  _activatePositionOrders(gridId, position) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Находим соответствующие ордера
    const tpOrder = grid.takeProfitOrders.find(o => o.entryOrderId === position.entryOrderId);
    const slOrder = grid.stopLossOrders.find(o => o.entryOrderId === position.entryOrderId);
    
    // Если ордера найдены, размещаем их на бирже
    if (tpOrder && tpOrder.status === 'PENDING') {
      this._placeOrderOnExchange(gridId, tpOrder, position.id)
        .catch(error => this.logError(`Ошибка при размещении TP ордера для позиции ${position.id}`, error));
    }
    
    if (slOrder && slOrder.status === 'PENDING') {
      this._placeOrderOnExchange(gridId, slOrder, position.id)
        .catch(error => this.logError(`Ошибка при размещении SL ордера для позиции ${position.id}`, error));
    }
  }

  /**
   * Размещает ордер на бирже
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} order - Ордер для размещения
   * @param {string} [positionId] - Идентификатор связанной позиции
   * @returns {Promise<boolean>} - Результат размещения ордера
   * @private
   */
  async _placeOrderOnExchange(gridId, order, positionId = null) {
    if (!this.activeGrids.has(gridId)) {
      return false;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Определяем направление ордера
      let orderDirection = grid.direction;
      
      // Для ордеров закрытия направление противоположное
      if (order.id.includes('_tp_') || order.id.includes('_sl_')) {
        orderDirection = grid.direction === 'BUY' ? 'SELL' : 'BUY';
      }
      
      // Размещаем ордер на бирже
      const orderResult = await exchange.createOrder(
        grid.pair,
        orderDirection,
        order.type,
        order.size,
        order.price
      );
      
      // Обновляем информацию об ордере
      order.status = 'ACTIVE';
      order.exchangeOrderId = orderResult.orderId;
      order.positionId = positionId;
      
      this.log(`Размещен ордер ${order.id} для сетки ${gridId}: ${order.price}`);
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при размещении ордера ${order.id} для сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Обновляет позицию после исполнения ордера закрытия
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} order - Исполненный ордер закрытия
   * @param {Object} data - Дополнительные данные
   * @private
   */
  _updatePositionForClosedOrder(gridId, order, data) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Находим связанную позицию
    const position = grid.positions.find(p => p.id === order.positionId);
    
    if (!position) {
      this.logError(`Позиция не найдена для ордера закрытия ${order.id} в сетке ${gridId}`);
      return;
    }
    
    // Обновляем позицию
    position.status = 'CLOSED';
    position.closeTime = order.fillTime || Date.now();
    position.closePrice = order.fillPrice || order.price;
    position.closeOrderId = order.id;
    position.closeReason = order.id.includes('_tp_') ? 'TAKE_PROFIT' : 'STOP_LOSS';
    
    // Рассчитываем прибыль/убыток
    const profit = position.direction === 'BUY' ? 
      (position.closePrice - position.entryPrice) * position.size : 
      (position.entryPrice - position.closePrice) * position.size;
    
    position.profit = profit;
    
    // Обновляем статистику сетки
    grid.stats.totalProfit += profit;
    grid.stats.closedPositions++;
    
    // Отменяем другие ордера для этой позиции
    this._cancelOtherPositionOrders(gridId, position);
    
    // Обновляем сетку
    grid.lastUpdateTime = Date.now();
    this.activeGrids.set(gridId, grid);
    
    this.log(`Закрыта позиция в сетке ${gridId}: ${position.id} с прибылью ${profit}`);
    
    // Оповещаем о закрытии позиции
    this._emitGridEvent('grid.position.closed', {
      gridId,
      positionId: position.id,
      level: position.level,
      entryPrice: position.entryPrice,
      closePrice: position.closePrice,
      profit,
      reason: position.closeReason
    });
  }

  /**
   * Отменяет другие ордера для закрытой позиции
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} position - Закрытая позиция
   * @private
   */
  _cancelOtherPositionOrders(gridId, position) {
    if (!this.activeGrids.has(gridId)) {
      return;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    // Находим активные ордера для этой позиции
    const tpOrder = grid.takeProfitOrders.find(o => 
      o.positionId === position.id && o.status === 'ACTIVE' && o.id !== position.closeOrderId);
    
    const slOrder = grid.stopLossOrders.find(o => 
      o.positionId === position.id && o.status === 'ACTIVE' && o.id !== position.closeOrderId);
    
    // Отменяем найденные ордера
    if (tpOrder) {
      this._cancelOrderOnExchange(gridId, tpOrder)
        .catch(error => this.logError(`Ошибка при отмене TP ордера ${tpOrder.id}`, error));
    }
    
    if (slOrder) {
      this._cancelOrderOnExchange(gridId, slOrder)
        .catch(error => this.logError(`Ошибка при отмене SL ордера ${slOrder.id}`, error));
    }
  }

  /**
   * Отменяет ордер на бирже
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} order - Ордер для отмены
   * @returns {Promise<boolean>} - Результат отмены ордера
   * @private
   */
  async _cancelOrderOnExchange(gridId, order) {
    if (!this.activeGrids.has(gridId) || !order.exchangeOrderId) {
      return false;
    }
    
    const grid = this.activeGrids.get(gridId);
    
    try {
      // Получаем активный коннектор к бирже
      const exchange = this.core.getActiveExchangeConnector();
      
      // Отменяем ордер на бирже
      await exchange.cancelOrder(grid.pair, order.exchangeOrderId);
      
      // Обновляем статус ордера
      order.status = 'CANCELED';
      order.updatedAt = Date.now();
      
      this.log(`Отменен ордер ${order.id} для сетки ${gridId}`);
      
      // Обновляем сетку
      grid.lastUpdateTime = Date.now();
      this.activeGrids.set(gridId, grid);
      
      return true;
    } catch (error) {
      this.logError(`Ошибка при отмене ордера ${order.id} для сетки ${gridId}`, error);
      return false;
    }
  }

  /**
   * Проверяет, нужно ли закрыть сетку по стоп-лоссу
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если нужно закрыть
   * @private
   */
  _shouldCloseGridByStopLoss(grid, currentPrice) {
    // Проверка на максимальную просадку
    const totalInvested = grid.entryOrders.reduce((sum, order) => {
      if (order.status === 'FILLED') {
        return sum + (order.fillPrice * order.size);
      }
      return sum;
    }, 0);
    
    // Если нет открытых позиций, не закрываем сетку
    if (totalInvested === 0) {
      return false;
    }
    
    // Текущая стоимость открытых позиций
    const currentValue = grid.positions.reduce((sum, position) => {
      if (position.status === 'OPEN') {
        return sum + (currentPrice * position.size);
      }
      return sum;
    }, 0);
    
    // Текущая прибыль/убыток
    const currentPL = grid.direction === 'BUY' ? 
      currentValue - totalInvested : 
      totalInvested - currentValue;
    
    // Процент просадки
    const drawdownPercent = (currentPL / totalInvested) * 100;
    
    // Обновляем максимальную просадку
    if (drawdownPercent < 0 && Math.abs(drawdownPercent) > Math.abs(grid.stats.maxDrawdown)) {
      grid.stats.maxDrawdown = drawdownPercent;
    }
    
    // Проверяем, не превышена ли максимальная просадка
    return drawdownPercent < 0 && Math.abs(drawdownPercent) >= this.config.maxDrawdownPercent;
  }

  /**
   * Проверяет, нужно ли активировать трейлинг-стоп
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @returns {boolean} - true, если нужно активировать
   * @private
   */
  _shouldActivateTrailingStop(grid, currentPrice) {
    if (!grid.trailingStopEnabled || grid.trailingStopValue !== null) {
      return false;
    }
    
    // Проверяем, достигла ли цена уровня активации трейлинг-стопа
    if (grid.direction === 'BUY') {
      return currentPrice >= grid.params.trailingStopActivationLevel;
    } else { // SELL
      return currentPrice <= grid.params.trailingStopActivationLevel;
    }
  }

  /**
   * Обновляет значение трейлинг-стопа
   * @param {string} gridId - Идентификатор сетки
   * @param {Object} grid - Объект сетки
   * @param {number} currentPrice - Текущая цена
   * @private
   */
  _updateTrailingStop(gridId, grid, currentPrice) {
    // Инициализируем трейлинг-стоп, если он еще не активирован
    if (grid.trailingStopValue === null) {
      const distance = grid.params.gridStep * (this.config.stopLossFactor / 2); // Половина обычного стоп-лосса
      
      grid.trailingStopValue = grid.direction === 'BUY' ? 
        currentPrice - distance : 
        currentPrice + distance;
      
      this.log(`Активирован трейлинг-стоп для сетки ${gridId}: ${grid.trailingStopValue}`);
      
      // Оповещаем об активации трейлинг-стопа
      this._emitGridEvent('grid.trailingStop.activated', {
        gridId,
        value: grid.trailingStopValue,
        activationPrice: currentPrice
      });
    } else {
      // Обновляем трейлинг-стоп, если текущая цена обеспечивает лучший уровень
      if (grid.direction === 'BUY' && (currentPrice - grid.params.gridStep) > grid.trailingStopValue) {
        // Для покупки: повышаем стоп, когда цена растет
        grid.trailingStopValue = currentPrice - grid.params.gridStep;
        
        this.log(`Обновлен трейлинг-стоп для сетки ${gridId}: ${grid.trailingStopValue}`);
        
        // Оповещаем об обновлении трейлинг-стопа
        this._emitGridEvent('grid.trailingStop.updated', {
          gridId,
          value: grid.trailingStopValue,
          currentPrice
        });
      } else if (grid.direction === 'SELL' && (currentPrice + grid.params.gridStep) < grid.trailingStopValue) {
        // Для продажи: понижаем стоп, когда цена падает
        grid.trailingStopValue = currentPrice + grid.params.gridStep;
        
        this.log(`Обновлен трейлинг-стоп для сетки ${gridId}: ${grid.trailingStopValue}`);
        
        // Оповещаем об обновлении трейлинг-стопа
        this._emitGridEvent('grid.trailingStop.updated', {
          gridId,
          value: grid.trailingStopValue,
          currentPrice
        });
      }
    }
    
    // Проверяем, не сработал ли трейлинг-стоп
    if (this._isTrailingStopTriggered(grid, currentPrice)) {
      this.log(`Сработал трейлинг-стоп для сетки ${gridId} при цене ${currentPrice}`);
      
      // Закрываем сетку по трейлинг-стопу
      this.closeGrid(gridId, 'TRAILING_STOP')
        .catch(error => this.logError(`Ошибка при закрытии сетки ${gridId} по трейлинг-стопу`, error));
    }
    
    // Обновляем сетку
    this.activeGrids.set(gridId, grid);
  }