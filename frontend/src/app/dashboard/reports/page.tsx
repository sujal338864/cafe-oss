'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useTheme } from '@/context/ThemeContext';
import SummaryCards from '@/components/analytics/SummaryCards';
import { RevenueTrendChart, TopProductsChart } from '@/components/analytics/ReportCharts';

export default function ReportsPage() {
  const { theme } = useTheme();
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report', reportType, selectedDate],
    queryFn: async () => {
      let url = '';
      if (reportType === 'daily') url = `/api/analytics/reports/daily?date=${selectedDate}`;
      else if (reportType === 'weekly') url = `/api/analytics/reports/weekly?endDate=${selectedDate}`;
      else url = `/api/analytics/reports/monthly?year=${selectedDate.split('-')[0]}&month=${parseInt(selectedDate.split('-')[1]) - 1}`;
      
      const res = await api.get(url);
      return res.data;
    }
  });

  const btnStyle = (active: boolean) => ({
    padding: '10px 20px', borderRadius: 14, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13,
    background: active ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : 'rgba(0,0,0,0.05)',
    color: active ? 'white' : theme.textMuted,
    boxShadow: active ? '0 8px 20px rgba(124, 58, 237, 0.25)' : 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: theme.text, margin: 0 }}>Business Reporting 📈</h1>
          <p style={{ fontSize: 14, color: theme.textFaint, marginTop: 6, fontWeight: 500 }}>Daily and Monthly performance ledger</p>
        </div>
        
        <div style={{ display: 'flex', gap: 8, background: theme.card, padding: 6, borderRadius: 18, border: `1px solid ${theme.border}` }}>
          {(['daily', 'weekly', 'monthly'] as const).map(t => (
            <button key={t} onClick={() => setReportType(t)} style={btnStyle(reportType === t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 32, alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '12px 20px', borderRadius: 16, width: 'fit-content' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1.5 }}>Select Period:</div>
        <input 
          type={reportType === 'monthly' ? 'month' : 'date'} 
          value={selectedDate} 
          onChange={e => setSelectedDate(e.target.value)}
          style={{ 
            background: theme.card, border: `1px solid ${theme.border}`, color: theme.text, 
            padding: '10px 16px', borderRadius: 12, outline: 'none', fontSize: 14, fontWeight: 700,
            cursor: 'pointer'
          }} 
        />
      </div>

      {isLoading ? (
        <div style={{ padding: 100, textAlign: 'center', color: theme.textFaint }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: `4px solid ${theme.border}`, borderTopColor: '#7c3aed', animation: 'spin 0.8s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite', margin: '0 auto 20px' }} />
          <div style={{ fontWeight: 700, letterSpacing: 0.5 }}>Aggregating Data...</div>
        </div>
      ) : data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Summary Section */}
          <SummaryCards data={reportType === 'daily' ? data : {
            revenue: data.totalRevenue,
            orders: data.totalOrders,
            expenses: data.totalExpenses,
            netProfit: data.netProfit
          }} type={reportType} />

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
            {reportType === 'weekly' && data.breakdown && (
              <RevenueTrendChart data={data.breakdown} />
            )}
            
            {(reportType === 'daily' || reportType === 'monthly') && data.topItems && (
              <TopProductsChart data={data.topItems} />
            )}
            
            {reportType === 'daily' && data.topItems && (
               <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 24, padding: 24 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: theme.text, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 2 }}>Order Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.topItems.map((item: any, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(0,0,0,0.02)', borderRadius: 14 }}>
                        <span style={{ fontWeight: 700, color: theme.text }}>{item.name}</span>
                        <span style={{ fontWeight: 800, color: theme.accent }}>₹{item.revenue.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
               </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: 60, background: theme.card, borderRadius: 24, textAlign: 'center', color: theme.textFaint, border: `2px dashed ${theme.border}` }}>
          ⚠️ Could not generate report. Please try another period.
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
