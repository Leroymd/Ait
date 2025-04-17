// modules/indicators/order-block.js
// Индикатор Order Block (OB)

const IndicatorBase = require('./indicator-base');

class OrderBlock extends IndicatorBase {
  constructor(config) {
    super(config);
    this.name = 'Order Block (OB)';
    this.description = 'Определяет Order Blocks на графике';
    this.id = 'order-block';
    
    // Специфичные для OB настройки
    this.config = {
      minImpulseStrength: 1.5, // Минимальная сила импульса для определения OB
      maxBlocks: 5,  // Максимальное количество блоков для отображения
      displayFreshOnly: true, // Отображать только свежие (непротестированные) блоки
      obColors: {
        bullish: 'rgba(0, 200, 83, 0.2)',  // Цвет бычьих OB
        bearish: 'rgba(255, 82, 82, 0.2)',  // Цвет медвежьих OB
        bullishBorder: 'rgba(0, 200, 83, 1)',
        bearishBorder: 'rgba(255, 82, 82, 1)',
        testedAlpha: 0.1  // Прозрачность для протестированных OB
      },
      ...config
    };
  }

  // Расчет индикатора Order Block
  async calculate(chartData) {
    this.log(`Расчет индикатора для ${chartData.length} свечей`);
    
    if (chartData.length < 5) {
      this.log('Недостаточно данных для расчета');
      return null;
    }
    
    const orderBlocks = this.findOrderBlocks(chartData);
    
    // Кэшируем результаты
    return this.cacheCalculation({
      orderBlocks,
      timestamp: Date.now()
    });
  }

  // Поиск Order Blocks
  findOrderBlocks(chartData) {
    const orderBlocks = [];
    
    // Ищем потенциальные OB на основе свечей перед сильным движением
    for (let i = 2; i < chartData.length - 2; i++) {
      const currentCandle = chartData[i];
      const nextCandle = chartData[i + 1];
      const prevCandle = chartData[i - 1];
      const obCandle = chartData[i - 1];
      
      // Определяем силу движения
      const currentRange = Math.abs(currentCandle.high - currentCandle.low);
      const nextBodySize = Math.abs(nextCandle.close - nextCandle.open);
      
      // Проверяем силу движения (импульс)
      const isStrongMove = nextBodySize > (currentRange * this.config.minImpulseStrength);
      
      if (isStrongMove) {
        // Определяем направление движения
        const isBullish = nextCandle.close > nextCandle.open;
        
        // Создаем Order Block
        const orderBlock = {
          type: isBullish ? 'bullish' : 'bearish',
          top: isBullish ? obCandle.high : Math.max(obCandle.open, obCandle.close),
          bottom: isBullish ? Math.min(obCandle.open, obCandle.close) : obCandle.low,
          strength: nextBodySize / currentRange,
          candleIndex: i - 1,
          time: obCandle.openTime,
          isTested: false,
          testedAt: null
        };
        
        orderBlocks.push(orderBlock);
      }
    }
    
    // Проверяем, были ли Order Blocks протестированы
    for (const ob of orderBlocks) {
      for (let i = ob.candleIndex + 2; i < chartData.length; i++) {
        const candle = chartData[i];
        
        if (ob.type === 'bullish' && candle.low <= ob.top && candle.low >= ob.bottom) {
          ob.isTested = true;
          ob.testedAt = candle.openTime;
          break;
        }
        
        if (ob.type === 'bearish' && candle.high >= ob.bottom && candle.high <= ob.top) {
          ob.isTested = true;
          ob.testedAt = candle.openTime;
          break;
        }
      }
      
      // Добавляем информацию о возрасте Order Block
      ob.age = chartData.length - 1 - ob.candleIndex;
    }
    
    // Сортируем блоки по силе
    orderBlocks.sort((a, b) => b.strength - a.strength);
    
    // Применяем фильтры в соответствии с настройками
    let filteredBlocks = orderBlocks;
    
    // Фильтр на отображение только свежих (непротестированных) блоков
    if (this.config.displayFreshOnly) {
      filteredBlocks = filteredBlocks.filter(ob => !ob.isTested);
    }
    
    // Возвращаем только самые сильные блоки согласно настройке
    return filteredBlocks.slice(0, this.config.maxBlocks);
  }

  // Получение данных для отрисовки индикатора
  getVisualData() {
    if (!this.lastCalculation) {
      return null;
    }
    
    const { orderBlocks } = this.lastCalculation;
    const colors = this.config.obColors;
    
    // Формируем данные для отображения на графике
    return {
      boxes: orderBlocks.map(ob => ({
        time: ob.time,
        top: ob.top,
        bottom: ob.bottom,
        color: ob.type === 'bullish' ? 
               (ob.isTested ? 
                 this.adjustAlpha(colors.bullish, colors.testedAlpha) : 
                 colors.bullish) : 
               (ob.isTested ? 
                 this.adjustAlpha(colors.bearish, colors.testedAlpha) : 
                 colors.bearish),
        borderColor: ob.type === 'bullish' ? colors.bullishBorder : colors.bearishBorder,
        borderWidth: 1,
        tooltip: `${ob.type === 'bullish' ? 'Bullish' : 'Bearish'} OB (Strength: ${ob.strength.toFixed(2)})${ob.isTested ? ' [Tested]' : ''}`
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

module.exports = OrderBlock;