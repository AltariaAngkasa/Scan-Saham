const express = require('express');
const path = require('path');
const xml2js = require('xml2js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parser for body
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Parser options for xml2js
const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

// Route: Get Google News RSS feed for stock
app.get('/api/news', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Append 'saham' to focus the search on Indonesian stock news if it looks like a ticker
    const query = q.toUpperCase();
    const searchQuery = `${query} saham`;

    // Google News RSS URL
    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=id&gl=ID&ceid=ID:id`;

    const response = await fetch(googleNewsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch news from Google News RSS. Status: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Parse XML to JS object
    parser.parseString(xmlText, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to parse RSS XML', details: err.message });
      }

      const items = result?.rss?.channel?.item;
      if (!items) {
        return res.json([]);
      }

      // Convert single item to array if needed, then format
      const rawArticles = Array.isArray(items) ? items : [items];
      
      const articles = rawArticles.map(item => {
        // Extract source name
        let sourceName = 'Unknown';
        if (typeof item.source === 'string') {
          sourceName = item.source;
        } else if (item.source && item.source._) {
          sourceName = item.source._;
        }

        // Clean title (remove " - Source" from end of title if exists)
        let cleanTitle = item.title || '';
        if (cleanTitle && sourceName) {
          const suffixIndex = cleanTitle.lastIndexOf(` - ${sourceName}`);
          if (suffixIndex !== -1) {
            cleanTitle = cleanTitle.substring(0, suffixIndex);
          }
        }

        return {
          title: cleanTitle,
          link: item.link || '',
          pubDate: item.pubDate || '',
          source: sourceName,
          description: item.description || ''
        };
      });

      // Return top 15 news articles
      res.json(articles.slice(0, 15));
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Route: Proxies request to Gemini API
app.post('/api/analyze', async (req, res) => {
  try {
    const { ticker, articles } = req.body;
    
    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'Articles array is required and cannot be empty' });
    }

    // Retrieve Gemini API Key. Priorities: 
    // 1. Client header 'X-Gemini-API-Key'
    // 2. Server environmental variable 'API_GEMINI'
    const apiKey = req.headers['x-gemini-api-key'] || process.env.API_GEMINI;

    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Gemini API Key missing. Please provide it in the server .env or in the frontend Settings panel.' 
      });
    }

    // We will use Gemini 3.5 Flash which is supported in this environment and returns analysis in JSON.
    const model = 'gemini-3.5-flash';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Structure the articles text for prompt
    const articlesText = articles.map((art, idx) => {
      return `Article #${idx + 1}:
Title: ${art.title}
Source: ${art.source}
Date: ${art.pubDate}
Snippet: ${art.description}\n`;
    }).join('\n');

    // Structured prompt asking for JSON
    const prompt = `
You are a senior financial analyst at Bloomberg Intelligence, specializing in the Indonesian Stock Market (IDX).
Analyze the following news articles regarding the stock "${ticker.toUpperCase()}".
Produce a comprehensive fundamental analysis and sentiment outlook based solely on these news.

Articles to analyze:
${articlesText}

Your response must be a JSON object ONLY, matching this EXACT schema:
{
  "sentiment": "BULLISH" | "BEARISH" | "NEUTRAL",
  "score": -100 to 100 (where -100 is extremely bearish, 100 is extremely bullish, 0 is neutral),
  "confidence": 0 to 100 (percentage score of how confident you are in this sentiment based on data quality),
  "summary": "Provide a high-quality, professional executive summary of the overall market sentiment and fundamental news developments. Speak like a Bloomberg terminal analyst (concise, analytical, and professional). (approx 2-3 sentences)",
  "priceImpact": {
    "direction": "UP" | "DOWN" | "STABLE",
    "timeline": "Short-term (1-2 weeks) or Medium-term (1-3 months)",
    "explanation": "Provide a detailed justification for this price movement prediction based on the fundamentals described in the news. (approx 2 sentences)"
  },
  "bulletPoints": [
    {
      "type": "bullish" | "bearish",
      "text": "Specify a key positive/negative driver or fundamental catalyst identified in the news (e.g. profit growth, dividend announcement, regulatory hurdles, global market shifts). Provide 3-5 distinct items total."
    }
  ],
  "targetPriceRange": {
    "minChangePct": number, // Estimated percentage change minimum, e.g. -5.5
    "maxChangePct": number  // Estimated percentage change maximum, e.g. 10.0
  }
}

Do NOT wrap the JSON in markdown code blocks (\`\`\`json ... \`\`\`). Return ONLY the raw JSON string starting with { and ending with }. Ensure it is valid JSON. Speak in professional Indonesian language.
`;

    // Make the API call to Gemini
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Gemini API returned status ${geminiResponse.status}`);
    }

    const data = await geminiResponse.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Empty response received from Gemini API');
    }

    // Try parsing to verify it's valid JSON
    let parsedResult;
    try {
      // Remove any markdown wrappers if the model ignored instructions
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7);
      }
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      parsedResult = JSON.parse(cleanText.trim());
    } catch (e) {
      console.error('Error parsing Gemini JSON response:', responseText);
      return res.status(500).json({ 
        error: 'Failed to parse Gemini response as JSON', 
        rawText: responseText 
      });
    }

    res.json(parsedResult);
  } catch (error) {
    console.error('Error in /api/analyze:', error);
    res.status(500).json({ error: 'Failed to run AI analysis', details: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Bloomberg Stock Analysis Terminal Server is running!`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
