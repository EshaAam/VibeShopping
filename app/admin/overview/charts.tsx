'use client';

import { useState, useEffect } from 'react';
import {
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { getSalesChartData } from '@/lib/actions/order.actions';

type TimeRange = 'daily' | 'monthly' | 'yearly';

interface SalesDataPoint {
  label: string;
  totalSales: number;
  orderCount: number;
}

interface ChartProps {
  data: {
    salesData: SalesDataPoint[];
  };
}

const Charts = ({ data: { salesData: initialData } }: ChartProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [salesData, setSalesData] = useState<SalesDataPoint[]>(initialData);
  const [loading, setLoading] = useState(false);

  // Fetch data when time range changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getSalesChartData(timeRange);
        setSalesData(data);
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [timeRange]);

  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom tooltip component
  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; dataKey: string; color: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className='bg-background border border-border rounded-lg shadow-lg p-3 min-w-[150px]'>
          <p className='text-xs font-medium text-foreground mb-2'>{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className='flex items-center gap-2 text-sm'>
              <div
                className='w-3 h-3 rounded-full'
                style={{ backgroundColor: entry.color }}
              />
              <span className='text-muted-foreground'>
                {entry.dataKey === 'totalSales' ? 'Sales:' : 'Orders:'}
              </span>
              <span className='font-semibold text-foreground'>
                {entry.dataKey === 'totalSales'
                  ? formatCurrency(entry.value)
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!salesData || salesData.length === 0) {
    return (
      <div className='space-y-4'>
        {/* Time Range Toggle */}
        <div className='flex justify-end'>
          <div className='inline-flex items-center rounded-lg bg-muted p-1 gap-1'>
            {(['daily', 'monthly', 'yearly'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'ghost'}
                size='sm'
                onClick={() => setTimeRange(range)}
                className='capitalize px-4'
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
        <div className='flex items-center justify-center h-[350px] text-muted-foreground'>
          {loading ? 'Loading...' : 'No sales data available'}
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {/* Time Range Toggle */}
      <div className='flex justify-end'>
        <div className='inline-flex items-center rounded-lg bg-muted p-1 gap-1'>
          {(['daily', 'monthly', 'yearly'] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setTimeRange(range)}
              className='capitalize px-4'
              disabled={loading}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className='relative'>
        {loading && (
          <div className='absolute inset-0 flex items-center justify-center bg-background/50 z-10'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
          </div>
        )}
        <ResponsiveContainer width='100%' height={350}>
          <ComposedChart
            data={salesData}
            margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='hsl(var(--border))'
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey='label'
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              dy={10}
            />
            <YAxis
              yAxisId='left'
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickFormatter={(value) => {
                if (value >= 1000) {
                  return `$${(value / 1000).toFixed(0)}k`;
                }
                return `$${value}`;
              }}
              dx={-5}
              width={55}
            />
            <YAxis
              yAxisId='right'
              orientation='right'
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              dx={5}
              width={40}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) =>
                value === 'totalSales' ? 'Total Sales' : 'Order Count'
              }
            />
            <Bar
              yAxisId='left'
              dataKey='totalSales'
              fill='#4A90D9'
              radius={[4, 4, 0, 0]}
              barSize={timeRange === 'yearly' ? 60 : timeRange === 'monthly' ? 30 : 20}
            />
            <Line
              yAxisId='right'
              type='monotone'
              dataKey='orderCount'
              stroke='#48BB78'
              strokeWidth={2.5}
              dot={{ fill: '#48BB78', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Charts;
