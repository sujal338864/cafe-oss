import { OpenAI } from 'openai';
import { logger } from '../lib/logger';
import { prisma } from '../common/prisma';
import { GrowthService } from './growth.service';

// Optional OpenAI/Groq Integration
const apiKey = process.env.OPENAI_API_KEY || '';

const isGroq = apiKey.startsWith('gsk_');

const openai = apiKey ? new OpenAI({ 
  apiKey,
  baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
}) : null;

// Determine model based on provider
const standardModel = isGroq ? 'llama-3.1-8b-instant' : 'gpt-4o-mini';
const advancedModel = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o';

export const MarketingService = {
  /**
   * Safe fallback for when OpenAI is not configured during dev/test.
   * Provides hardcoded smart suggestions.
   */
  getFallbackResponse: (type: string, _input: string) => {
    logger.warn(`[MARKETING] OpenAI API key missing. Using fallback response for ${type}`);
    switch (type) {
      case 'caption':
        return `🌟 Enjoy our latest special! Fresh and crafted just for you ☕\n\nDrop by today and taste the magic ✨\n\n#SpecialOffer #MustTry #CafeLife`;
      case 'poster':
        return `Weekend Special!\nBuy 1 Get 1 Free\nHurry, limited time only!`;
      case 'review':
        return `Hi there! Hope you loved your recent order from us. If you have a moment, we'd really appreciate a quick review on Google. It helps us grow! ⭐⭐⭐⭐⭐`;
      case 'reel':
        return `🎥 Reel Concept: Behind the scenes magic!\nShot 1: Close up of brewing.\nShot 2: Slow motion pour.\nAudio: Trending Lo-Fi beat.\nCaption: Making your favorite cup, just the way you like it.`;
      case 'campaign':
        return `🚀 Campaign: Weekend Rush\nOffer: 20% off all combos\nTarget: Families and Groups\nExecution: Send SMS on Saturday 11 AM.`;
      default:
        return 'Marketing magic generated successfully!';
    }
  },

  /**
   * Helper to build brand system context
   */
  _buildBrandContext: (brand: any) => {
    if (!brand) return '';
    return `You represent a ${brand.brandType.replace('_', ' ').toLowerCase()} with a ${brand.toneOfVoice.toLowerCase()} tone. Your target audience is ${brand.targetAudience || 'general customers'}.`;
  },

  /**
   * Generate an Instagram/Facebook caption based on product or offer.
   */
  generateCaption: async (prompt: string, language: string = 'English', brand: any = null) => {
    if (!openai) return MarketingService.getFallbackResponse('caption', prompt, language);
    const context = MarketingService._buildBrandContext(brand);

    try {
      const response = await openai.chat.completions.create({
        model: standardModel,
        messages: [
          { role: 'system', content: `You are an expert social media manager for a local shop. ${context} Write an engaging, short Instagram caption with emojis and 3-5 relevant hashtags. Call to Action is usually 'Order Now'. Respond in ${language}.` },
          { role: 'user', content: `Write a post about: ${prompt}` }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });
      return response.choices[0].message.content || MarketingService.getFallbackResponse('caption', prompt, language);
    } catch (err: any) {
      logger.error(`[MARKETING] OpenAI Error: ${err.message}`);
      return MarketingService.getFallbackResponse('caption', prompt, language);
    }
  },

  /**
   * Generate short poster text (Title + Subtitle).
   */
  generatePosterText: async (prompt: string, brand: any = null) => {
    if (!openai) return MarketingService.getFallbackResponse('poster', prompt);
    const context = MarketingService._buildBrandContext(brand);

    try {
      const response = await openai.chat.completions.create({
        model: standardModel,
        messages: [
          { role: 'system', content: `You are a graphic designer and copywriter. ${context} Generate bold, catchy text for a digital poster. Output exactly 3 lines: \nLine 1: Main Catchy Heading\nLine 2: Subheading/Offer Details\nLine 3: Call to Action. Do not add labels like 'Line 1:'.` },
          { role: 'user', content: `Poster about: ${prompt}` }
        ],
        max_tokens: 100,
        temperature: 0.8,
      });
      return response.choices[0].message.content || MarketingService.getFallbackResponse('poster', prompt);
    } catch (err: any) {
      logger.error(`[MARKETING] OpenAI Error: ${err.message}`);
      return MarketingService.getFallbackResponse('poster', prompt);
    }
  },

  /**
   * Generate a review request text message.
   */
  generateReviewRequest: async (tone: string = 'Polite', brand: any = null) => {
    if (!openai) return MarketingService.getFallbackResponse('review', tone);
    const context = MarketingService._buildBrandContext(brand);

    try {
      const response = await openai.chat.completions.create({
        model: standardModel,
        messages: [
          { role: 'system', content: `You are a customer relationship manager for a local shop. ${context} Write a concise, ${tone.toLowerCase()} WhatsApp or SMS message asking the customer to leave a Google review. Provide a placeholder for the link.` },
          { role: 'user', content: 'Generate a review request message.' }
        ],
        max_tokens: 100,
        temperature: 0.7,
      });
      return response.choices[0].message.content || MarketingService.getFallbackResponse('review', tone);
    } catch (err: any) {
      logger.error(`[MARKETING] OpenAI Error: ${err.message}`);
      return MarketingService.getFallbackResponse('review', tone);
    }
  },

  /**
   * Generate an Instagram/TikTok Reel script & shot list.
   */
  generateReelIdea: async (prompt: string, brand: any = null) => {
    if (!openai) return MarketingService.getFallbackResponse('reel', prompt);
    const context = MarketingService._buildBrandContext(brand);

    try {
      const response = await openai.chat.completions.create({
        model: advancedModel,
        messages: [
          { role: 'system', content: `You are an expert videographer and TikTok strategist. ${context} Generate a 15-30 second short-form video idea. Format the response clearly with: \n1. Hook (Text on Screen)\n2. Audio / Trending Sound Idea\n3. Shot List (Visuals)\n4. Caption idea.` },
          { role: 'user', content: `Generate a reel concept about: ${prompt}` }
        ],
        max_tokens: 350,
        temperature: 0.8,
      });
      return response.choices[0].message.content || MarketingService.getFallbackResponse('reel', prompt);
    } catch (err: any) {
      logger.error(`[MARKETING] OpenAI Error: ${err.message}`);
      return MarketingService.getFallbackResponse('reel', prompt);
    }
  },

  /**
   * The "Marketing Brain" — Generate a daily tactical marketing plan based on live data.
   */
  generateDailyIntel: async (shopId: string) => {
    const brand = await (prisma as any).brandProfile.findUnique({ where: { shopId } });
    const segments: any = await GrowthService.getSegmentCounts(shopId).catch(() => ({}));
    const kpis = await GrowthService.getGrowthKPIs(shopId).catch(() => null);

    const intelCacheKey = `ai_intel_cooldown:${shopId}`;
    
    // 1. Rate Limit: 12 Hours per generation to control costs
    try {
      const { redis } = await import('../lib/redis');
      const inCooldown = await redis.get(intelCacheKey);
      if (inCooldown && apiKey) {
        logger.info(`[MARKETING] AI Intel in cooldown for shop ${shopId}. Returning latest state.`);
        // Note: The route should fetch latest DB record if this happens
        return null; 
      }
      if (apiKey) await redis.setex(intelCacheKey, 43200, 'true'); // 12h
    } catch (e) { /* Redis skip */ }

    // Fast mock for when OpenAI is not configured
    if (!openai) {
      const topProd = kpis?.products?.topItems?.[0]?.name || 'your top products';
      return {
        text: `Today's Action Plan:\n1. 📸 Post a behind-the-scenes reel of ${topProd}.\n2. 💌 Target your ${segments?.VIP || 0} VIPs with an exclusive offer.\n3. 💸 Boost your combo meals or bundle slow items like ${kpis?.products?.lowItems?.[0]?.name || 'side snacks'}.`,
        keyFocus: kpis?.revenue?.growthPct && kpis.revenue.growthPct < 0 ? "Recovery Drive" : "Growth Surge",
        actionItems: ["Post Reel", "Email VIPs", "Bundle Items"]
      };
    }

    const context = MarketingService._buildBrandContext(brand);
    const topProducts = kpis?.products?.topItems?.map(i => `${i.name}`).join(', ') || 'General Menu';
    const lowProducts = kpis?.products?.lowItems?.map(i => `${i.name}`).join(', ') || 'New Items';
    const growthText = kpis?.revenue?.growthPct ? `${kpis.revenue.growthPct}% WoW` : 'Stable';
    
    try {
      const response = await openai.chat.completions.create({
        model: standardModel,
        messages: [
          { 
            role: 'system', 
            content: `You are the Chief Marketing Officer for a local cafe. ${context}
            You will receive current customer analytics. Provide a 3-step daily marketing plan to boost sales today.
            Format exactly as JSON:
            {
              "text": "Detailed 3 bullet point plan...",
              "keyFocus": "A 2-3 word focus (e.g., Weekend Rush)",
              "actionItems": ["Action 1", "Action 2", "Action 3"]
            }`
          },
          { 
            role: 'user', 
            content: `Analytics Insights:
            Revenue Trend: ${growthText}
            Best Sellers: ${topProducts}
            Slow Moving Items: ${lowProducts}
            Customer Segments: VIPs (${segments?.VIP || 0}), Inactive (${segments?.INACTIVE_30D || 0}), New (${segments?.NEW || 0})`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0.8,
      });

      const parsed = JSON.parse(response.choices[0].message.content || '{}');
      return {
        text: parsed.text || "Push a weekend combo and engage inactive customers.",
        keyFocus: parsed.keyFocus || "Growth",
        actionItems: parsed.actionItems || ["Post Content"]
      };

    } catch (err: any) {
      logger.error(`[MARKETING BRAIN] Error: ${err.message}`);
      return {
        text: "Could not generate AI plan today.",
        keyFocus: "Error",
        actionItems: []
      };
    }
  }
};
