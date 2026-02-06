import React, { useEffect, useRef, forwardRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time, LineData, CandlestickSeriesOptions, LineSeriesOptions } from 'lightweight-charts';
import { OHLC, ChartConfig } from '../types';
import { CHART_COLORS } from '../constants';

interface TradingViewChartProps {
  data: OHLC[];
  currentCandle: OHLC | null;
  config: ChartConfig;
}

export interface ChartRef {}

const calculateEMA = (data: OHLC[], count: number) => {
  if (data.length < count) return [];
  const result: LineData[] = [];
  let sum = 0;
  for (let i = 0; i < count; i++) sum += data[i].close;
  let prevEMA = sum / count;
  result.push({ time: data[count - 1].time as Time, value: prevEMA });
  const multiplier = 2 / (count + 1);
  for (let i = count; i < data.length; i++) {
    const close = data[i].close;
    const ema = (close - prevEMA) * multiplier + prevEMA;
    result.push({ time: data[i].time as Time, value: ema });
    prevEMA = ema;
  }
  return result;
};

export const TradingViewChart = forwardRef<ChartRef, TradingViewChartProps>(({ data, currentCandle }, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: CHART_COLORS.BACKGROUND }, textColor: CHART_COLORS.TEXT },
      grid: { vertLines: { color: CHART_COLORS.GRID }, horzLines: { color: CHART_COLORS.GRID } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: { timeVisible: true, secondsVisible: true, borderColor: '#2a2e39' },
      rightPriceScale: { borderColor: '#2a2e39', scaleMargins: { top: 0.1, bottom: 0.1 } },
      crosshair: { mode: 1, vertLine: { color: '#607d8b', width: 1, style: 3 }, horzLine: { color: '#607d8b', width: 1, style: 3 } },
    });

    const candleSeries = chart.addSeries({
      type: 'Candlestick',
      upColor: CHART_COLORS.UP_COLOR,
      downColor: CHART_COLORS.DOWN_COLOR,
      borderVisible: false,
      wickUpColor: CHART_COLORS.WICK_UP,
      wickDownColor: CHART_COLORS.WICK_DOWN,
      priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
    } as CandlestickSeriesOptions);

    const ema20 = chart.addSeries({ type: 'Line', color: '#29b6f6', lineWidth: 2, priceLineVisible: false, crosshairMarkerVisible: false } as LineSeriesOptions);
    const ema50 = chart.addSeries({ type: 'Line', color: '#ff9800', lineWidth: 2, priceLineVisible: false, crosshairMarkerVisible: false } as LineSeriesOptions);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries as ISeriesApi<"Candlestick">;
    ema20SeriesRef.current = ema20 as ISeriesApi<"Line">;
    ema50SeriesRef.current = ema50 as ISeriesApi<"Line">;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || data.length === 0) return;
    const formattedData: CandlestickData<Time>[] = data.map(d => ({ time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close }));
    candleSeriesRef.current.setData(formattedData);
    ema20SeriesRef.current?.setData(calculateEMA(data, 20));
    ema50SeriesRef.current?.setData(calculateEMA(data, 50));
  }, [data]);

  useEffect(() => {
    if (!candleSeriesRef.current || !currentCandle) return;
    candleSeriesRef.current.update({ time: currentCandle.time as Time, open: currentCandle.open, high: currentCandle.high, low: currentCandle.low, close: currentCandle.close });
  }, [currentCandle, data]);

  return <div ref={chartContainerRef} className="relative z-10 w-full h-full" />;
});
