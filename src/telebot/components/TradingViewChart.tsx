import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';
import { OHLC, ChartConfig } from '../types';
import { CHART_COLORS } from '../constants';

interface TradingViewChartProps {
  data: OHLC[];
  currentCandle: OHLC | null;
  config: ChartConfig;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({ data, currentCandle, config }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: CHART_COLORS.TEXT,
      },
      grid: {
        vertLines: { color: CHART_COLORS.GRID },
        horzLines: { color: CHART_COLORS.GRID },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: CHART_COLORS.GRID,
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.GRID,
        scaleMargins: {
            top: 0.1,
            bottom: 0.1,
        },
      },
      crosshair: {
        mode: 1,
      },
    });

    // v5 API: use addSeries with CandlestickSeries
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.UP_COLOR,
      downColor: CHART_COLORS.DOWN_COLOR,
      borderVisible: false,
      wickUpColor: CHART_COLORS.WICK_UP,
      wickDownColor: CHART_COLORS.WICK_DOWN,
      priceFormat: {
        type: 'price',
        precision: 5,
        minMove: 0.00001,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  // Update Data
  useEffect(() => {
    if (!candleSeriesRef.current || data.length === 0) return;

    const formattedData: CandlestickData<Time>[] = data.map(d => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close
    }));

    candleSeriesRef.current.setData(formattedData);
  }, [data]);

  // Update Current Candle (Real-time)
  useEffect(() => {
    if (!candleSeriesRef.current || !currentCandle) return;

    candleSeriesRef.current.update({
      time: currentCandle.time as Time,
      open: currentCandle.open,
      high: currentCandle.high,
      low: currentCandle.low,
      close: currentCandle.close
    });
  }, [currentCandle]);

  return (
    <div className="relative w-full h-full bg-[#131722]">
      {/* Professional Watermark Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden pt-12">
        <div className="transform -rotate-[15deg] select-none text-center flex flex-col items-center justify-center">
            <h1 className="text-4xl md:text-[5vw] font-black text-white opacity-[0.04] tracking-[0.2em] whitespace-nowrap leading-tight">
              GM
            </h1>
            <h1 className="text-4xl md:text-[5vw] font-black text-white opacity-[0.04] tracking-[0.2em] whitespace-nowrap leading-tight">
              TELEBOT
            </h1>
        </div>
      </div>

      <div ref={chartContainerRef} className="relative z-10 w-full h-full" />
    </div>
  );
};
