const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const run = async () => {
  const key = process.env.OPENAI_API_KEY;
  console.log(`[Diagnostic] OPENAI_API_KEY found: ${key ? `Yes (${key.substring(0, 7)}...)` : 'No'}`);
  
  if (!key || key === 'your_openai_api_key_here' || key.startsWith('your_')) {
    console.error(`[Diagnostic] Error: OpenAI API key is missing or is set to placeholder value.`);
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: key });

  try {
    console.log('[Diagnostic] Connecting to OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say hello in 1 word.' }],
    });
    console.log('[Diagnostic] OpenAI Response:', response.choices[0]?.message?.content);
  } catch (e) {
    console.error('[Diagnostic] OpenAI Connection Failed:', e.message);
  }
  process.exit(0);
};

run();
