
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Sparkles, Target, ArrowRight, Lightbulb } from 'lucide-react';

export function MarketingIntel() {
  const { data, isLoading } = useQuery({
    queryKey: ['marketing_intel'],
    queryFn: () => api.get('/api/growth/intel').then(r => r.data)
  });

  if (isLoading) return <div className="h-48 bg-slate-50 animate-pulse rounded-2xl" />;
  if (!data?.intel) return null;

  const { planText, keyFocus, actionItems } = data.intel;

  return (
    <div className="relative overflow-hidden bg-white border border-indigo-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Decorative Gradient Background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50 blur-2xl" />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-200">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Today's Action Plan</h3>
            <p className="text-xs text-slate-500">AI-generated from your recent sales</p>
          </div>
        </div>
        {keyFocus && (
          <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-full border border-indigo-100">
            Focus: {keyFocus}
          </div>
        )}
      </div>

      <div className="space-y-4 mb-6">
         <div className="flex gap-4 items-start bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="mt-1 text-amber-500 bg-amber-50 p-2 rounded-lg">
              <Lightbulb size={18} fill="currentColor" fillOpacity={0.2} />
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap italic">
              "{planText}"
            </p>
         </div>
      </div>

      {actionItems && Array.isArray(actionItems) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {actionItems.map((item: string, i: number) => (
            <div key={i} className="group flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-300 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-bold text-slate-400">0{i+1}</div>
                <span className="text-xs font-semibold text-slate-600 group-hover:text-indigo-600">{item}</span>
              </div>
              <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
