'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

const Charts = ({
  data: { salesData },
}: {
  data: { salesData: { month: string; totalSales: number }[] };
}) => {
  console.log('Chart received salesData:', salesData);

  if (!salesData || salesData.length === 0) {
    return (
      <div className='flex items-center justify-center h-[350px] text-muted-foreground'>
        No sales data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width='100%' height={350}>
      <BarChart data={salesData}>
        <XAxis
          dataKey='month'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Bar
          dataKey='totalSales'
          fill='currentColor'
          radius={[4, 4, 0, 0]}
          className='fill-primary'
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default Charts;
