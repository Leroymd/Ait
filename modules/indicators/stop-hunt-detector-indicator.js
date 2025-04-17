// modules/indicators/stop-hunt-detector.js
// Индикатор для обнаружения "охоты за стопами"

const IndicatorBase = require('./indicator-base');

class StopHuntDetector extends IndicatorBase {
  constructor(config) {
    super(config);
    this.name = 'Stop Hunt Detector';
    this.description = 'Определяет области потенциальной "охоты за стопами"';
    this.id = 'stop-hunt-detector';
    
    // Специфичные настройки
    this.config = {
      minWickRatio: 0.5, // Минимальное отношение фитиля к телу свечи
      recencyWeight: 3,  // Вес для недавних событий
      lookbackPeriod: 20, // Количество свечей для анализа
      minBodyToRangeRatio: 0.3, // Минимальное отношение тела к диапазону свечи
      stopHuntColors: {
        lower: 'rgba(255, 82, 82, 1)', // Цвет для охоты за стопами снизу
        upper: 'rgba(255, 152, 0, 1)'  // Цвет для охоты за стопами сверху
      },
      ...config
    };
  }

  // Расчет индикатора
  async calculate(chartData) {
    this.log(`Расчет индикатора для ${chartData.length} свечей`);
    
    if (chartData.length < 5) {
      this.log('Недостаточно данных для расчета');
      return null;
    }
    
    // Получаем только последние N свечей для анализа
    const recentData = chartData.slice(-this.config.lookbackPeriod);
    
    const stopHunts = this.findStopHunts(recentData);
    const analysisResult = this.analyzeStopHunts(stopHunts, recentData);
    
    // Кэшируем результаты
    return this.cacheCalculation({
      stopHunts,
      analysis: analysisResult,
      timestamp: Date.now()
    });
  }

  // Поиск потенциальных событий "охоты за стопами"
  findStopHunts(chartData) {
    const stopHunts = [];
    
    for (let i = 1; i < chartData.length; i++) {
      const candle = chartData[i];
      const body = Math.abs(candle.close - candle.open);
      const totalRange = candle.high - candle.low;
      
      if (body === 0) continue; // Пропускаем doji
      
      const bodyRatio = body / totalRange;
      
      // Если тело маленькое относительно диапазона
      if (bodyRatio < this.config.minBodyToRangeRatio) {
        // Нижний фитиль (потенциальная охота за стопами снизу)
        const lowerWick = Math.min(candle.open, candle.close) - candle.low;
        const lowerWickRatio = lowerWick / body;
        
        // Верхний фитиль (потенциальная охота за стопами сверху)
        const upperWick = candle.high - Math.max(candle.open, candle.close);
        const upperWickRatio = upperWick / body;
        
        // Проверяем длину фитилей
        if (lowerWickRatio > this.config.minWickRatio) {
          stopHunts.push({
            type: 'lower',
            candleIndex: i,
            time: candle.openTime,
            price: candle.low,
            wickRatio: lowerWickRatio,
            bodyRatio: bodyRatio,
            candle: {
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close
            }
          });
        }
        
        if (upperWickRatio > this.config.minWickRatio) {
          stopHunts.push({
            type: 'upper',
            candleIndex: i,
            time: candle.openTime,
            price: candle.high,
            wickRatio: upperWickRatio,
            bodyRatio: bodyRatio,
            candle: {
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close
            }
          });
        }
      }
    }
    
    return stopHunts;
  }
  
  // Анализ обнаруженных событий
  analyzeStopHunts(stopHunts, chartData) {
    if (stopHunts.length === 0) {
      return {
        detected: false,
        lowerHuntsCount: 0,
        upperHuntsCount: 0,
        recentStopHunt: null,
        recommendation: 'No stop hunts detected, market might be more predictable.'
      };
    }
    
    const lowerHunts = stopHunts.filter(hunt => hunt.type === 'lower');
    const upperHunts = stopHunts.filter(hunt => hunt.type === 'upper');
    
    // Определяем "недавние" события (последние N% свечей)
    const recentPeriod = Math.max(3, Math.floor(chartData.length * 0.15));
    const recentLowerHunts = lowerHunts.filter(hunt => 
      hunt.candleIndex >= chartData.length - recentPeriod
    );
    const recentUpperHunts = upperHunts.filter(hunt => 
      hunt.candleIndex >= chartData.length - recentPeriod
    );
    
    // Находим самое недавнее событие
    const recentStopHunt = stopHunts.length > 0 ? 
      stopHunts.reduce((latest, current) => 
        current.candleIndex > latest.candleIndex ? current : latest, 
        stopHunts[0]
      ) : null;
    
    // Формируем рекомендацию
    let recommendation = '';
    
    if (recentLowerHunts.length > 0) {
      recommendation = 'Recent lower stop hunts detected. Consider placing stop losses further away from obvious levels or using alternative risk management strategies.';
    } else if (recentUpperHunts.length > 0) {
      recommendation = 'Recent upper stop hunts detected. The market might be more volatile at resistance levels.';
    } else if (lowerHunts.length > upperHunts.length) {
      recommendation = 'Historical pattern shows more lower stop hunts than upper. Consider this when placing stop losses.';
    } else if (upperHunts.length > lowerHunts.length) {
      recommendation = 'Historical pattern shows more upper stop hunts than lower. Be cautious with resistance levels.';
    } else {
      recommendation = 'Both upper and lower stop hunts detected with similar frequency. Market shows balanced volatility.';
    }
    
    return {
      detected: stopHunts.length > 0,
      lowerHuntsCount: lowerHunts.length,
      upperHuntsCount: upperHunts.length,
      recentLowerHuntsCount: recentLowerHunts.length,
      recentUpperHuntsCount: recentUpperHunts.length,
      recentStopHunt,
      recommendation
    };
  }
  
  // Получение данных для отрисовки индикатора
  getVisualData() {
    if (!this.lastCalculation) {
      return null;
    }
    
    const { stopHunts, analysis } = this.lastCalculation;
    const colors = this.config.stopHuntColors;
    
    // Формируем данные для отображения на графике
    const result = {
      markers: stopHunts.map(hunt => ({
        time: hunt.time,
        price: hunt.price,
        marker: {
          type: 'arrowDown',
          position: hunt.type === 'lower' ? 'below' : 'above',
          color: hunt.type === 'lower' ? colors.lower : colors.upper,
          size: 1.2 + Math.min(hunt.wickRatio * 0.1, 0.8)
        },
        tooltip: `${hunt.type === 'lower' ? 'Lower' : 'Upper'} Stop Hunt (Ratio: ${hunt.wickRatio.toFixed(2)})`
      }))
    };
    
    // Добавляем последнее предупреждение, если оно есть
    if (analysis.recentStopHunt) {
      result.warning = {
        text: `Recent ${analysis.recentStopHunt.type} stop hunt detected!`,
        position: 'bottom',
        color: analysis.recentStopHunt.type === 'lower' ? colors.lower : colors.upper
      };
    }
    
    return result;
  }
}