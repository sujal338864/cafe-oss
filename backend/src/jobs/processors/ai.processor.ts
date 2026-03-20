import { generateShopInsights } from '../../services/ai.service';

/**
 * Processor consuming AI jobs. Executes OpenAI connection offline without stalling backend dashboard APIs.
 */
export const aiInsightsProcessor = async (job: any) => {
  const { shopId } = job.data;
  console.log(`[Queue] Starting AI Insight generation for shop: ${shopId}`);
  return generateShopInsights(shopId);
};
