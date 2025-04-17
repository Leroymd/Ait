/**
 * Модуль расширенной аналитики результатов торговли
 * Отвечает за:
 * - Сбор и анализ статистики по торговым результатам
 * - Построение кривой капитала и анализ просадок
 * - Анализ производительности по торговым парам
 * - Анализ распределения результатов по времени
 * - Формирование рекомендаций для улучшения торговых результатов
 */

const fs = require('fs').promises;
const path = require('path');

class TradingAnalytics {
  constructor(config) {
    this.name = 'Trading Analytics';
    this.description = 'Модуль расширенной аналитики результатов торговли';
    this.config = config || {};
    this.core = null;
    
    // Пути к файлам данных
    this.dataDir = path.join(process.cwd(), 'data');
    this.tradeHistoryPath = path.join(this.dataDir, 'trade_history.json');
    this.tradingAnalyticsPath = path.join(this.dataDir, 'trading_analytics.json');
    this.dailyStatsPath = path.join(this.dataDir, 'daily_stats.json');
    
    // Данные аналитики
    this.tradeHistory = [];
    this.pairPerformance = {};
    this.timeDistribution = { hourly: Array(24).fill(null).map(() => ({ count: 0, totalProfit: 0, avgProfit: 0 })) };
    this.capitalCurve = [];
    this.recommendedPairs = [];
    this.recommendedTimeSlots = [];
    this.overallMetrics = {
      totalTrades: 0,
      winRate: 0,
      avgProfit: 0,
      totalProfit: 0,
      maxProfit: 0,
      maxLoss: 0,
      profitFactor: 0,
      avgDuration: 0,
      maxDrawdown: 0,
      sharpeRatio: 0
    };

    // Интервал обновления аналитики (в миллисекундах)
    this.updateInterval = this.config.updateInterval || 3600000; // По умолчанию 1 час
    this.updateTimer = null;
  }

  async initialize(core) {
    this.core = core;
    console.log('Модуль аналитики торговли инициализирован');
    
    // Создаем директорию для данных, если она не существует
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.error('Ошибка создания директории данных:', error);
      }
    }
    
    // Загружаем данные при инициализации
    await this.loadData();
    
    // Запускаем таймер для регулярного обновления аналитики
    this.updateTimer = setInterval(() => this.updateAnalytics(), this.updateInterval);
    
    // Инициализируем начальный анализ
    await this.updateAnalytics();
    
    return true;
  }

  async cleanup() {
    // Останавливаем таймер обновления
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    // Сохраняем последние данные перед выгрузкой
    await this.saveData();
    
    console.log('Модуль аналитики торговли выгружен');
  }

  /**
   * Загрузка всех необходимых данных
   */
  async loadData() {
    try {
      // Загружаем историю торговли
      try {
        const tradeHistoryData = await fs.readFile(this.tradeHistoryPath, 'utf8');
        this.tradeHistory = JSON.parse(tradeHistoryData);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log('Файл истории торговли не найден, создаем новый');
          this.tradeHistory = [];
          await fs.writeFile(this.tradeHistoryPath, JSON.stringify(this.tradeHistory, null, 2));
        } else {
          throw error;
        }
      }
      
      // Загружаем аналитические данные, если они существуют
      try {
        const analyticsData = await fs.readFile(this.tradingAnalyticsPath, 'utf8');
        const analytics = JSON.parse(analyticsData);
        
        this.pairPerformance = analytics.pairPerformance || {};
        this.timeDistribution = analytics.timeDistribution || { 
          hourly: Array(24).fill(null).map(() => ({ count: 0, totalProfit: 0, avgProfit: 0 })) 
        };
        this.capitalCurve = analytics.capitalCurve || [];
        this.recommendedPairs = analytics.recommendedPairs || [];
        this.recommendedTimeSlots = analytics.recommendedTimeSlots || [];
        this.overallMetrics = analytics.overallMetrics || {
          totalTrades: 0,
          winRate: 0,
          avgProfit: 0,
          totalProfit: 0,
          maxProfit: 0,
          maxLoss: 0,
          profitFactor: 0,
          avgDuration: 0,
          maxDrawdown: 0,
          sharpeRatio: 0
        };
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log('Файл аналитических данных не найден, создаем новый');
          await this.saveData(); // Сохраняем пустые данные для создания файла
        } else {
          throw error;
        }
      }

      console.log('Данные аналитики успешно загружены');
    } catch (error) {
      console.error('Ошибка при загрузке данных аналитики:', error);
    }
  }

  /**
   * Сохранение всех данных
   */
  async saveData() {
    try {
      const analyticsData = {
        pairPerformance: this.pairPerformance,
        timeDistribution: this.timeDistribution,
        capitalCurve: this.capitalCurve,
        recommendedPairs: this.recommendedPairs,
        recommendedTimeSlots: this.recommendedTimeSlots,
        overallMetrics: this.overallMetrics
      };
      
      await fs.writeFile(this.tradingAnalyticsPath, JSON.stringify(analyticsData, null, 2));
      console.log('Данные аналитики успешно сохранены');
    } catch (error) {
      console.error('Ошибка при сохранении данных аналитики:', error);
    }
  }

  /**
   * Обновление всех аналитических данных
   */
  async updateAnalytics() {
    try {
      // Загружаем последнюю версию истории торговли
      try {
        const tradeHistoryData = await fs.readFile(this.tradeHistoryPath, 'utf8');
        this.tradeHistory = JSON.parse(tradeHistoryData);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Анализируем производительность по торговым парам
      this.analyzePairPerformance();
      
      // Анализируем распределение по времени
      this.analyzeTimeDistribution();
      
      // Строим кривую капитала
      this.buildCapitalCurve();
      
      // Вычисляем общие метрики
      this.calculateOverallMetrics();
      
      // Формируем рекомендации
      this.generateRecommendations();
      
      // Обновляем ежедневную статистику
      await this.updateDailyStats();
      
      // Сохраняем обновленные данные
      await this.saveData();
      
      console.log('Аналитика успешно обновлена');
      
      // Уведомляем ядро об обновлении аналитики
      if (this.core && typeof this.core.notifyAnalyticsUpdate === 'function') {
        this.core.notifyAnalyticsUpdate({
          timestamp: new Date().toISOString(),
          overallMetrics: this.overallMetrics,
          recommendedPairs: this.recommendedPairs,
          recommendedTimeSlots: this.recommendedTimeSlots
        });
      }
    } catch (error) {
      console.error('Ошибка при обновлении аналитики:', error);
    }
  }

  /**
   * Анализ производительности по торговым парам
   */
  analyzePairPerformance() {
    // Сбрасываем текущие данные о производительности пар
    this.pairPerformance = {};
    
    // Группируем сделки по торговым парам
    this.tradeHistory.forEach(trade => {
      // Пропускаем примеры, помеченные как isExample
      if (trade.isExample === true) {
        return;
      }
      
      const symbol = trade.symbol;
      
      if (!this.pairPerformance[symbol]) {
        this.pairPerformance[symbol] = {
          totalTrades: 0,
          winCount: 0,
          lossCount: 0,
          totalProfit: 0,
          totalLoss: 0,
          profits: [],
          losses: [],
          durations: []
        };
      }
      
      const pairData = this.pairPerformance[symbol];
      pairData.totalTrades += 1;
      
      const profit = trade.profit;
      if (profit >= 0) {
        pairData.winCount += 1;
        pairData.totalProfit += profit;
        pairData.profits.push(profit);
      } else {
        pairData.lossCount += 1;
        pairData.totalLoss += Math.abs(profit);
        pairData.losses.push(profit);
      }
      
      // Вычисляем длительность сделки
      const openTime = new Date(trade.openTime).getTime();
      const closeTime = new Date(trade.closeTime).getTime();
      const durationHours = (closeTime - openTime) / (1000 * 60 * 60);
      pairData.durations.push(durationHours);
    });
    
    // Вычисляем метрики для каждой пары
    Object.keys(this.pairPerformance).forEach(symbol => {
      const data = this.pairPerformance[symbol];
      const metrics = {
        totalTrades: data.totalTrades,
        winRate: data.totalTrades > 0 ? (data.winCount / data.totalTrades) * 100 : 0,
        avgProfit: data.totalTrades > 0 ? (data.totalProfit - data.totalLoss) / data.totalTrades : 0,
        totalProfit: data.totalProfit - data.totalLoss,
        maxProfit: data.profits.length > 0 ? Math.max(...data.profits) : 0,
        maxLoss: data.losses.length > 0 ? Math.min(...data.losses) : 0,
        profitFactor: data.totalLoss > 0 ? data.totalProfit / data.totalLoss : data.totalProfit > 0 ? Infinity : 0,
        avgDuration: data.durations.length > 0 ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length : 0
      };
      
      // Округляем числовые значения до 2 знаков после запятой
      metrics.winRate = parseFloat(metrics.winRate.toFixed(2));
      metrics.avgProfit = parseFloat(metrics.avgProfit.toFixed(2));
      metrics.totalProfit = parseFloat(metrics.totalProfit.toFixed(2));
      metrics.maxProfit = parseFloat(metrics.maxProfit.toFixed(2));
      metrics.maxLoss = parseFloat(metrics.maxLoss.toFixed(2));
      metrics.profitFactor = parseFloat(metrics.profitFactor.toFixed(2));
      metrics.avgDuration = parseFloat(metrics.avgDuration.toFixed(2));
      
      // Сохраняем только метрики, удаляя рабочие данные
      this.pairPerformance[symbol] = metrics;
    });
  }

  /**
   * Анализ распределения результатов по времени
   */
  analyzeTimeDistribution() {
    // Сбрасываем текущие данные о распределении по времени
    this.timeDistribution = {
      hourly: Array(24).fill(null).map(() => ({ count: 0, totalProfit: 0, avgProfit: 0 }))
    };
    
    // Анализируем распределение по часам
    this.tradeHistory.forEach(trade => {
      // Пропускаем примеры, помеченные как isExample
      if (trade.isExample === true) {
        return;
      }
      
      const openTime = new Date(trade.openTime);
      const hour = openTime.getUTCHours();
      
      this.timeDistribution.hourly[hour].count += 1;
      this.timeDistribution.hourly[hour].totalProfit += trade.profit;
    });
    
    // Вычисляем средний профит для каждого часа
    for (let i = 0; i < 24; i++) {
      const hourData = this.timeDistribution.hourly[i];
      if (hourData.count > 0) {
        hourData.avgProfit = parseFloat((hourData.totalProfit / hourData.count).toFixed(2));
      }
      hourData.totalProfit = parseFloat(hourData.totalProfit.toFixed(2));
    }
  }

  /**
   * Построение кривой капитала и анализ просадок
   */
  buildCapitalCurve() {
    // Отфильтровываем примеры
    const realTrades = this.tradeHistory.filter(trade => trade.isExample !== true);
    
    // Сортируем сделки по времени закрытия
    const sortedTrades = [...realTrades].sort((a, b) => {
      return new Date(a.closeTime).getTime() - new Date(b.closeTime).getTime();
    });
    
    // Строим кривую капитала
    let capital = this.config.initialCapital || 1000; // Начальный капитал
    let peak = capital;
    let maxDrawdown = 0;
    
    this.capitalCurve = [{
      timestamp: new Date(0).toISOString(), // Начальная точка
      capital,
      profit: 0,
      drawdown: 0
    }];
    
    sortedTrades.forEach(trade => {
      capital += trade.profit;
      
      // Обновляем пик капитала и вычисляем текущую просадку
      peak = Math.max(peak, capital);
      const drawdown = peak > 0 ? ((peak - capital) / peak) * 100 : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      
      this.capitalCurve.push({
        timestamp: trade.closeTime,
        capital: parseFloat(capital.toFixed(2)),
        profit: parseFloat(trade.profit.toFixed(2)),
        drawdown: parseFloat(drawdown.toFixed(2))
      });
    });
    
    // Сохраняем максимальную просадку в общих метриках
    this.overallMetrics.maxDrawdown = parseFloat(maxDrawdown.toFixed(2));
  }

  /**
   * Вычисление общих метрик торговли
   */
  calculateOverallMetrics() {
    // Отфильтровываем примеры
    const realTrades = this.tradeHistory.filter(trade => trade.isExample !== true);
    
    if (realTrades.length === 0) {
      this.overallMetrics = {
        totalTrades: 0,
        winRate: 0,
        avgProfit: 0,
        totalProfit: 0,
        maxProfit: 0,
        maxLoss: 0,
        profitFactor: 0,
        avgDuration: 0,
        maxDrawdown: this.overallMetrics.maxDrawdown || 0,
        sharpeRatio: 0
      };
      return;
    }
    
    // Подсчитываем общие метрики
    let winCount = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let profits = [];
    let losses = [];
    let durations = [];
    let dailyReturns = [];
    
    realTrades.forEach(trade => {
      if (trade.profit >= 0) {
        winCount += 1;
        totalProfit += trade.profit;
        profits.push(trade.profit);
      } else {
        totalLoss += Math.abs(trade.profit);
        losses.push(trade.profit);
      }
      
      // Вычисляем длительность сделки
      const openTime = new Date(trade.openTime).getTime();
      const closeTime = new Date(trade.closeTime).getTime();
      const durationHours = (closeTime - openTime) / (1000 * 60 * 60);
      durations.push(durationHours);
    });
    
    // Группируем торговлю по дням для расчета Sharpe Ratio
    const dailyProfits = {};
    realTrades.forEach(trade => {
      const day = new Date(trade.closeTime).toISOString().split('T')[0];
      if (!dailyProfits[day]) {
        dailyProfits[day] = 0;
      }
      dailyProfits[day] += trade.profit;
    });
    
    Object.values(dailyProfits).forEach(profit => {
      dailyReturns.push(profit);
    });
    
    // Вычисляем среднее и стандартное отклонение дневной доходности
    const avgDailyReturn = dailyReturns.length > 0 ? dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length : 0;
    const stdDevDailyReturn = dailyReturns.length > 0 ? Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length
    ) : 0;
    
    // Вычисляем Sharpe Ratio (предполагаем безрисковую ставку 0%)
    const sharpeRatio = stdDevDailyReturn > 0 ? avgDailyReturn / stdDevDailyReturn : 0;
    
    this.overallMetrics = {
      totalTrades: realTrades.length,
      winRate: parseFloat(((winCount / this.tradeHistory.length) * 100).toFixed(2)),
      avgProfit: parseFloat(realTrades.length > 0 ? ((totalProfit - totalLoss) / realTrades.length).toFixed(2) : "0"),
      totalProfit: parseFloat((totalProfit - totalLoss).toFixed(2)),
      maxProfit: parseFloat((profits.length > 0 ? Math.max(...profits) : 0).toFixed(2)),
      maxLoss: parseFloat((losses.length > 0 ? Math.min(...losses) : 0).toFixed(2)),
      profitFactor: parseFloat((totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999.99 : 0).toFixed(2)),
      avgDuration: parseFloat((durations.reduce((sum, d) => sum + d, 0) / durations.length).toFixed(2)),
      maxDrawdown: this.overallMetrics.maxDrawdown || 0,
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2))
    };
  }

  /**
   * Формирование рекомендаций для улучшения торговых результатов
   */
  generateRecommendations() {
    // Рекомендации по торговым парам
    this.recommendedPairs = [];
    
    const pairEntries = Object.entries(this.pairPerformance);
    if (pairEntries.length > 0) {
      // Сортируем пары по профит-фактору (от высокого к низкому)
      const sortedByProfitFactor = [...pairEntries].sort((a, b) => b[1].profitFactor - a[1].profitFactor);
      
      // Добавляем топ-3 пары с наилучшим профит-фактором (если есть минимум 5 сделок)
      sortedByProfitFactor
        .filter(([_, data]) => data.totalTrades >= 5)
        .slice(0, 3)
        .forEach(([symbol, data]) => {
          this.recommendedPairs.push({
            symbol,
            reason: `Высокий профит-фактор (${data.profitFactor}) с ${data.totalTrades} сделками`,
            performance: data
          });
        });
      
      // Добавляем топ-2 пары с наилучшим винрейтом (если есть минимум 5 сделок)
      const sortedByWinRate = [...pairEntries].sort((a, b) => b[1].winRate - a[1].winRate);
      
      sortedByWinRate
        .filter(([_, data]) => data.totalTrades >= 5)
        .filter(([symbol]) => !this.recommendedPairs.some(p => p.symbol === symbol)) // Исключаем уже добавленные
        .slice(0, 2)
        .forEach(([symbol, data]) => {
          this.recommendedPairs.push({
            symbol,
            reason: `Высокий винрейт (${data.winRate}%) с ${data.totalTrades} сделками`,
            performance: data
          });
        });
    }
    
    // Рекомендации по времени торговли
    this.recommendedTimeSlots = [];
    
    // Найдем часы с наилучшим средним профитом (минимум 3 сделки)
    const profitableHours = this.timeDistribution.hourly
      .map((data, hour) => ({ hour, ...data }))
      .filter(data => data.count >= 3 && data.avgProfit > 0)
      .sort((a, b) => b.avgProfit - a.avgProfit);
    
    profitableHours.slice(0, 5).forEach(data => {
      this.recommendedTimeSlots.push({
        startHour: data.hour,
        endHour: (data.hour + 1) % 24,
        avgProfit: data.avgProfit,
        tradeCount: data.count,
        reason: `Средний профит: ${data.avgProfit} (на основе ${data.count} сделок)`
      });
    });
  }

  /**
   * Обновление ежедневной статистики
   */
  async updateDailyStats() {
    try {
      let dailyStats = [];
      
      try {
        const dailyStatsData = await fs.readFile(this.dailyStatsPath, 'utf8');
        dailyStats = JSON.parse(dailyStatsData);
        
        // Отфильтровываем примеры из загруженных данных
        dailyStats = dailyStats.filter(stat => stat.isExample !== true);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Отфильтровываем примеры из истории сделок
      const realTrades = this.tradeHistory.filter(trade => trade.isExample !== true);
      
      // Группируем сделки по дням
      const dailyTrades = {};
      realTrades.forEach(trade => {
        const day = new Date(trade.closeTime).toISOString().split('T')[0];
        if (!dailyTrades[day]) {
          dailyTrades[day] = [];
        }
        dailyTrades[day].push(trade);
      });
      
      // Обновляем статистику по дням
      Object.entries(dailyTrades).forEach(([day, trades]) => {
        // Проверяем, существует ли уже статистика для этого дня
        const existingDayStats = dailyStats.find(s => s.date === day);
        
        if (!existingDayStats) {
          const winCount = trades.filter(t => t.profit >= 0).length;
          const lossCount = trades.filter(t => t.profit < 0).length;
          const totalProfit = trades.reduce((sum, t) => sum + (t.profit >= 0 ? t.profit : 0), 0);
          const totalLoss = trades.reduce((sum, t) => sum + (t.profit < 0 ? Math.abs(t.profit) : 0), 0);
          
          dailyStats.push({
            date: day,
            totalTrades: trades.length,
            winCount,
            lossCount,
            winRate: parseFloat(((winCount / trades.length) * 100).toFixed(2)),
            totalProfit: parseFloat((totalProfit - totalLoss).toFixed(2)),
            profitFactor: parseFloat((totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999.99 : 0).toFixed(2))
          });
        }
      });
      
      // Сортируем статистику по дате (от новых к старым)
      dailyStats.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Сохраняем обновленную статистику
      await fs.writeFile(this.dailyStatsPath, JSON.stringify(dailyStats, null, 2));
    } catch (error) {
      console.error('Ошибка при обновлении ежедневной статистики:', error);
    }
  }

  /**
   * Получение аналитических данных
   * @returns {Object} Объект с аналитическими данными
   */
  getAnalyticsData() {
    return {
      pairPerformance: this.pairPerformance,
      timeDistribution: this.timeDistribution,
      capitalCurve: this.capitalCurve,
      recommendedPairs: this.recommendedPairs,
      recommendedTimeSlots: this.recommendedTimeSlots,
      overallMetrics: this.overallMetrics
    };
  }

  /**
   * Возвращает данные о производительности конкретной торговой пары
   * @param {string} symbol - Символ торговой пары
   * @returns {Object|null} Данные о производительности пары или null, если данных нет
   */
  getPairPerformance(symbol) {
    return this.pairPerformance[symbol] || null;
  }

  /**
   * Возвращает рекомендации для улучшения торговых результатов
   * @returns {Object} Объект с рекомендациями
   */
  getRecommendations() {
    return {
      recommendedPairs: this.recommendedPairs,
      recommendedTimeSlots: this.recommendedTimeSlots
    };
  }

  /**
   * Возвращает данные кривой капитала
   * @returns {Array} Массив с данными кривой капитала
   */
  getCapitalCurve() {
    return this.capitalCurve;
  }

  /**
   * Возвращает общие метрики торговли
   * @returns {Object} Общие метрики торговли
   */
  getOverallMetrics() {
    return this.overallMetrics;
  }

  /**
   * Возвращает ежедневную статистику
   * @returns {Promise<Array>} Массив с ежедневной статистикой
   */
  async getDailyStats() {
    try {
      const dailyStatsData = await fs.readFile(this.dailyStatsPath, 'utf8');
      return JSON.parse(dailyStatsData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Экспорт аналитических данных в JSON
   * @param {string} filePath - Путь для сохранения файла
   * @returns {Promise<boolean>} Результат операции
   */
  async exportAnalytics(filePath) {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        analytics: this.getAnalyticsData(),
        dailyStats: await this.getDailyStats()
      };
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Ошибка при экспорте аналитических данных:', error);
      return false;
    }
  }
}

module.exports = TradingAnalytics;
