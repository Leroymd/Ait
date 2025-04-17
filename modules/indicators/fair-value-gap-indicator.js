// modules/indicators/fair-value-gap.js
// Индикатор Fair Value Gap (FVG)

const IndicatorBase = require('./indicator-base');

class FairValueGap extends IndicatorBase {
  constructor(config) {
    super(config);
    this.name = 'Fair Value Gap (FVG)';
    this.description = 'Определяет области Fair Value Gap на графике';
    this.id = 'fair-value-gap';
    
    // Специфичные для FVG настройки
    this.config = {
      minGapSize: 0.1, // Минимальный размер гэпа в процентах
      maxAge: 50,  // Максимальный возраст FVG для отображения (в свечах)
      showFilled: false, // Показывать заполненные FVG
      fvgColors: {
        bullish: 'rgba(76, 175, 80, 0.2)', // Цвет бычьих FVG
        bearish: 'rgba(244, 67, 54, 0.2)', // Цвет медвежьих FVG
        bullishBorder: 'rgba(76, 175, 80, 1)',
        bearishBorder: 'rgba(244, 67, 54, 1)',
        filledAlpha: 0.1 // Прозрачность для заполненных FVG
      },
      ...config
    };
  }

  // Расчет индикатора FVG
  async calculate(chartData) {
    this.log(`Расчет индикатора для ${chartData.length} свечей`);
    
    if (chartData.length < 3) {
      this.log('Недостаточно данных для расчета');
      return null;
    }
    
    const fvgs = this.findFairValueGaps(chartData);
    
    // Кэшируем результаты
    return this.cacheCalculation({
      fvgs,
      timestamp: Date.now()
    });
  }

  // Поиск Fair Value Gaps
  findFairValueGaps(chartData) {
    const fvgs = [];
    
    for (let i = 1; i < chartData.length - 1; i++) {
      const prevCandle = chartData[i - 1];
      const currentCandle = chartData[i];
      const nextCandle = chartData[i + 1];
      
      // Бычий FVG (разрыв вверх)
      if (prevCandle.high < nextCandle.low) {
        const gapSize = (nextCandle.low - prevCandle.high) / prevCandle.high * 100;
        
        if (gapSize >= this.config.minGapSize) {
          fvgs.push({
            type: 'bullish',
            top: nextCandle.low,
            bottom: prevCandle.high,
            size: gapSize,
            candleIndex: i,
            startTime: currentCandle.openTime,
            isFilled: false,
            filledAt: null
          });
        }
      }
      
      // Медвежий FVG (разрыв вниз)
      if (prevCandle.low > nextCandle.high) {
        const gapSize = (prevCandle.low - nextCandle.high) / nextCandle.high * 100;
        
        if (gapSize >= this.config.minGapSize) {
          fvgs.push({
            type: 'bearish',
            top: prevCandle.low,
            bottom: nextCandle.high,
            size: gapSize,
            candleIndex: i,
            startTime: currentCandle.openTime,
            isFilled: false,
            filledAt: null
          });
        }
      }
    }
    
    // Проверяем, были ли FVG заполнены последующими свечами
    for (const fvg of fvgs) {
      for (let i = fvg.candleIndex + 2; i < chartData.length; i++) {
        const candle = chartData[i];
        
        if (fvg.type === 'bullish' && candle.low <= fvg.bottom) {
          fvg.isFilled = true;
          fvg.filledAt = candle.openTime;
          break;
        }
        
        if (fvg.type === 'bearish' && candle.high >= fvg.top) {
          fvg.isFilled = true;
          fvg.filledAt = candle.openTime;
          break;
        }
      }
      
      // Добавляем информацию о возрасте FVG
      fvg.age = chartData.length - 1 - fvg.candleIndex;
    }
    
    // Сортируем по размеру (от большего к меньшему)
    fvgs.sort((a, b) => b.size - a.size);
    
    // Применяем фильтры в соответствии с настройками
    let filteredFvgs = fvgs;
    
    // Фильтр по возрасту
    filteredFvgs = filteredFvgs.filter(fvg => fvg.age <= this.config.maxAge);
    
    // Фильтр на отображение заполненных FVG
    if (!this.config.showFilled) {
      filteredFvgs = filteredFvgs.filter(fvg => !fvg.isFilled);
    }
    
    return filteredFvgs;
  }

  // Получение данных для отрисовки индикатора
  getVisualData() {
    if (!this.lastCalculation) {
      return null;
    }
    
    const { fvgs } = this.lastCalculation;
    const colors = this.config.fvgColors;
    
    // Формируем данные для отображения на графике
    return {
      areas: fvgs.map(fvg => ({
        startTime: fvg.startTime,
        top: fvg.top,
        bottom: fvg.bottom,
        color: fvg.type === 'bullish' ? 
               (fvg.isFilled ? 
                this.adjustAlpha(colors.bullish, colors.filledAlpha) : 
                colors.bullish) : 
               (fvg.isFilled ? 
                this.adjustAlpha(colors.bearish, colors.filledAlpha) : 
                colors.bearish),
        borderColor: fvg.type === 'bullish' ? colors.bullishBorder : colors.bearishBorder,
        borderWidth: 1,
        tooltip: `${fvg.type === 'bullish' ? 'Bullish' : 'Bearish'} FVG (${fvg.size.toFixed(2)}%)${fvg.isFilled ? ' [Filled]' : ''}`
      }))
    };
  }
  
  // Вспомогательный метод для настройки прозрачности цвета
  adjustAlpha(rgbaColor, newAlpha) {
    // Парсим rgba строку
    const rgbaMatch = rgbaColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (rgbaMatch) {
      const [_, r, g, b] = rgbaMatch;
      return `rgba(${r}, ${g}, ${b}, ${newAlpha})`;
    }
    return rgbaColor;
  }
}

module.exports = FairValueGap;