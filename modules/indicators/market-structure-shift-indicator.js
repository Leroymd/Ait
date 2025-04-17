// modules/indicators/market-structure-shift.js
// Индикатор перелома структуры рынка (MSS)

const IndicatorBase = require('./indicator-base');

class MarketStructureShift extends IndicatorBase {
  constructor(config) {
    super(config);
    this.name = 'Перелом структуры рынка (MSS)';
    this.description = 'Определяет точки перелома рыночной структуры';
    this.id = 'market-structure-shift';
    
    // Специфичные для MSS настройки
    this.config = {
      lookbackPeriod: 20, // Количество свечей для анализа
      minSwingStrength: 0.5, // Минимальная сила точки разворота
      swingPointsLookback: 3, // Количество свечей для определения точки разворота
      mssColors: {
        bullish: 'rgba(0, 230, 118, 1)',
        bearish: 'rgba(255, 61, 0, 1)',
        swingHigh: 'rgba(66, 133, 244, 0.7)',
        swingLow: 'rgba(239, 83, 80, 0.7)'
      },
      ...config
    };
  }

  // Расчет индикатора MSS
  async calculate(chartData) {
    this.log(`Расчет индикатора для ${chartData.length} свечей`);
    
    if (chartData.length < this.config.lookbackPeriod) {
      this.log('Недостаточно данных для расчета');
      return null;
    }
    
    // Находим точки разворота (swing points)
    const swingPoints = this.findSwingPoints(chartData);
    
    // Определяем структуру рынка
    const marketStructure = this.analyzeMarketStructure(swingPoints, chartData);
    
    // Ищем перелом структуры
    const structureShifts = this.findStructureShifts(marketStructure);
    
    // Кэшируем результаты
    return this.cacheCalculation({
      swingPoints,
      marketStructure,
      structureShifts,
      timestamp: Date.now()
    });
  }

  // Поиск точек разворота
  findSwingPoints(chartData) {
    const highs = [];
    const lows = [];
    
    // Количество свечей для определения локального экстремума
    const lookback = this.config.swingPointsLookback;
    
    for (let i = lookback; i < chartData.length - lookback; i++) {
      // Проверка на локальный максимум
      let isHigh = true;
      for (let j = 1; j <= lookback; j++) {
        if (chartData[i].high <= chartData[i-j].high || chartData[i].high <= chartData[i+j].high) {
          isHigh = false;
          break;
        }
      }
      
      if (isHigh) {
        highs.push({
          index: i,
          price: chartData[i].high,
          time: chartData[i].openTime
        });
      }
      
      // Проверка на локальный минимум
      let isLow = true;
      for (let j = 1; j <= lookback; j++) {
        if (chartData[i].low >= chartData[i-j].low || chartData[i].low >= chartData[i+j].low) {
          isLow = false;
          break;
        }
      }
      
      if (isLow) {
        lows.push({
          index: i,
          price: chartData[i].low,
          time: chartData[i].openTime
        });
      }
    }
    
    return { highs, lows };
  }
  
  // Анализ структуры рынка
  analyzeMarketStructure(swingPoints, chartData) {
    const { highs, lows } = swingPoints;
    
    // Сортировка точек по времени
    const allPoints = [...highs.map(h => ({ ...h, type: 'high' })), 
                       ...lows.map(l => ({ ...l, type: 'low' }))];
    
    allPoints.sort((a, b) => a.index - b.index);
    
    // Определение структуры HH/HL/LH/LL
    const structure = [];
    
    let lastHigh = null;
    let lastLow = null;
    
    for (const point of allPoints) {
      if (point.type === 'high') {
        if (lastHigh !== null) {
          const structureType = point.price > lastHigh.price ? 'HH' : 'LH';
          structure.push({
            type: structureType,
            from: lastHigh,
            to: point,
            strength: Math.abs(point.price - lastHigh.price) / lastHigh.price
          });
        }
        lastHigh = point;
      } else { // low
        if (lastLow !== null) {
          const structureType = point.price < lastLow.price ? 'LL' : 'HL';
          structure.push({
            type: structureType,
            from: lastLow,
            to: point,
            strength: Math.abs(point.price - lastLow.price) / lastLow.price
          });
        }
        lastLow = point;
      }
    }
    
    return structure;
  }
  
  // Поиск переломов структуры
  findStructureShifts(marketStructure) {
    const shifts = [];
    
    if (marketStructure.length < 3) {
      return shifts;
    }
    
    // Ищем изменения в структуре
    for (let i = 1; i < marketStructure.length; i++) {
      const current = marketStructure[i];
      const previous = marketStructure[i-1];
      
      // Бычий перелом: смена LL на HL или LH на HH
      if ((previous.type === 'LL' && current.type === 'HL') ||
          (previous.type === 'LH' && current.type === 'HH')) {
        shifts.push({
          type: 'bullish',
          structure: current,
          previousStructure: previous,
          strength: current.strength,
          time: current.to.time,
          price: current.to.price,
          index: current.to.index
        });
      }
      
      // Медвежий перелом: смена HH на LH или HL на LL
      if ((previous.type === 'HH' && current.type === 'LH') ||
          (previous.type === 'HL' && current.type === 'LL')) {
        shifts.push({
          type: 'bearish',
          structure: current,
          previousStructure: previous,
          strength: current.strength,
          time: current.to.time,
          price: current.to.price,
          index: current.to.index
        });
      }
    }
    
    return shifts;
  }

  // Получение данных для отрисовки индикатора
  getVisualData() {
    if (!this.lastCalculation) {
      return null;
    }
    
    const { swingPoints, structureShifts } = this.lastCalculation;
    const colors = this.config.mssColors;
    
    // Формируем данные для отображения на графике
    return {
      swingHighs: swingPoints.highs.map(h => ({
        time: h.time,
        price: h.price,
        marker: {
          type: 'triangle',
          position: 'above',
          color: colors.swingHigh,
          size: 1.2
        },
        tooltip: 'Swing High'
      })),
      
      swingLows: swingPoints.lows.map(l => ({
        time: l.time,
        price: l.price,
        marker: {
          type: 'triangle',
          position: 'below',
          color: colors.swingLow,
          size: 1.2
        },
        tooltip: 'Swing Low'
      })),
      
      shifts: structureShifts.map(shift => ({
        time: shift.time,
        price: shift.price,
        marker: {
          type: 'circle',
          position: shift.type === 'bullish' ? 'below' : 'above',
          color: shift.type === 'bullish' ? colors.bullish : colors.bearish,
          size: 1.5
        },
        tooltip: `${shift.type === 'bullish' ? 'Bullish' : 'Bearish'} MSS (${shift.previousStructure.type} → ${shift.structure.type})`
      }))
    };
  }
}

module.exports = MarketStructureShift;