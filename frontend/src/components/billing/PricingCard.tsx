
import React from 'react';
import { Check, Zap } from 'lucide-react';

interface PricingCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  onUpgrade: () => void;
  isCurrent?: boolean;
}

export function PricingCard({ name, price, description, features, isPopular, onUpgrade, isCurrent }: PricingCardProps) {
  return (
    <div className={`relative p-8 rounded-3xl border transition-all duration-300 ${
      isPopular 
        ? 'bg-slate-900 border-indigo-500 shadow-2xl scale-105 z-10' 
        : 'bg-white border-slate-200 hover:border-indigo-300'
    }`}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2">
          <Zap size={14} fill="white" /> MOST POPULAR
        </div>
      )}

      <div className="mb-8">
        <h3 className={`text-xl font-bold mb-2 ${isPopular ? 'text-white' : 'text-slate-900'}`}>{name}</h3>
        <p className={`text-sm ${isPopular ? 'text-slate-400' : 'text-slate-500'}`}>{description}</p>
      </div>

      <div className="mb-8">
        <span className={`text-4xl font-black ${isPopular ? 'text-white' : 'text-slate-900'}`}>{price}</span>
        <span className={`${isPopular ? 'text-slate-400' : 'text-slate-500'}`}>/month</span>
      </div>

      <button
        onClick={onUpgrade}
        disabled={isCurrent}
        className={`w-full py-4 rounded-2xl font-bold transition-all ${
          isCurrent 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : isPopular
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg'
              : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {isCurrent ? 'Current Plan' : `Upgrade to ${name}`}
      </button>

      <div className="mt-8 space-y-4">
        {features.map((feature, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`mt-1 p-0.5 rounded-full ${isPopular ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Check size={14} />
            </div>
            <span className={`text-sm ${isPopular ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
