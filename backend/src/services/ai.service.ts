import { calculateDashboardStats } from './analytics.service';
import OpenAI from 'openai';
import { redis } from '../lib/redis';
import { CircuitBreaker } from '../common/circuitBreaker';

const breaker = new CircuitBreaker('openai', 3, 60); // 3 failures, cooldown 60s

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
});

/**
 * Aggregates dashboard data and queries OpenAI for action-oriented business advice.
 * Returns the markdown string and caches result in Redis for high-scale reads.
 */
export const generateShopInsights = async (shopId: string) => {
  try {
    const stats = await calculateDashboardStats(shopId);

    const prompt = `You are an expert SaaS retail AI consultant for a POS dashboard. 
Based on the following numbers for shop: ${shopId}, generate actionable insights and demand forecasts.

---
📊 **General Stats**:
- Total Revenue: Rs.${stats.totalRevenue.toLocaleString()}
- Total Orders: ${stats.totalOrders}
- Avg Order Value: Rs.${stats.avgOrderValue.toFixed(2)}
- Low Stock Items: ${stats.lowStockItems}
- Top Products: ${stats.topProducts.map(p => `${p.name} (Qty: ${p.quantity})`).join(', ')}

📅 **Monthly Sales (Last 6 Months)**:
${stats.monthlySales.map(m => `- ${m.month}: Rs.${m.revenue.toLocaleString()} (${m.orders} orders)`).join('\n')}

🗂️ **Category Breakdown**:
${stats.categoryBreakdown.map(c => `- ${c.name}: Rs.${c.revenue.toLocaleString()}`).join('\n')}
---

Please structure your response with these exact headers:
1. 📈 **Smart Insights**: Analyze month-over-month trends (growth or drops).
2. 💡 **Core Recommendations**: 2 Actionable tips (pricing bundles, stock re-orders, or upselling).
3. 🔮 **Demand Forecast**: 1 predictive sentence estimating next month's volume or peak items based on these numbers.

Respond strictly in readable GitHub-flavored Markdown. Keep it brief and high-impact.`;

    const response = await breaker.execute(
      () => openai.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
      }),
      async () => {
        return {
          choices: [{
            message: {
              content: "💡 **Insights momentarily unavailable.** Our AI advisor is cooling down due to high traffic hubs. Please check back shortly!"
            }
          }]
        } as any;
      }
    );

    const insight = response.choices[0]?.message?.content || 'Unable to generate advice right now.';
    
    const result = {
      insight,
      createdAt: new Date(),
    };

    // Cache in Redis for 24 hours
    await redis.set(`ai_insights:${shopId}`, JSON.stringify(result), 'EX', 86400);

    return result;
  } catch (error) {
    console.error('[AI Service] Error generating insights:', error);
    throw error;
  }
};
