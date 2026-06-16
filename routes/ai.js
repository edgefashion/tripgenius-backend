// routes/ai.js — AI Trip Planning APIs

const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { Trip } = require('../models');

// Anthropic API call helper
async function callAnthropic(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Anthropic API error');
  }

  const data = await response.json();
  return data.content[0].text;
}

// ─────────────────────────────────────
// POST /api/ai/generate-trip — Main AI Trip Planner
// ─────────────────────────────────────
router.post('/generate-trip', optionalAuth, async (req, res) => {
  try {
    const { budget, people, days, mood } = req.body;

    if (!budget || !people || !days || !mood) {
      return res.status(400).json({ success: false, message: 'Budget, people, days, mood sab chahiye.' });
    }

    const prompt = `You are TripGenius AI — India's smartest budget travel advisor.

User Details:
- Total Budget: ₹${budget} for ${people} person(s) for ${days} days
- Per Person Budget: ₹${Math.round(budget / people)}
- Duration: ${days} days
- Travel Mood: ${mood}

Create a COMPLETE travel plan:

🏆 BEST DESTINATION
[Name the single best destination in India for this budget+mood. 2 powerful sentences why.]

💰 BUDGET BREAKDOWN (Total ₹${budget})
• Transport: ₹___
• Stay (₹___ × ${days} nights): ₹___
• Food (₹___ × ${days} days × ${people} people): ₹___
• Activities: ₹___
• Local rides: ₹___
• Emergency buffer: ₹___
• TOTAL: ₹___ (must be ≤ ₹${budget})

📊 SCORES
• Crowd Level: 🟢Low / 🟡Medium / 🔴High + reason
• Budget Score: X/10
• Vibe Match: X/10
• Best Season: [months]

📅 ${days}-DAY ITINERARY
Day 1 — [Theme]: [activities]
Day 2 — [Theme]: [activities]
${days > 2 ? `Day 3 — [Theme]: [activities]` : ''}
${days > 3 ? `Day 4+ — [brief summary]` : ''}

🍜 MUST-TRY LOCAL FOOD
• [Dish 1] — ₹___ — [where to find]
• [Dish 2] — ₹___
• [Dish 3] — ₹___

💡 MONEY-SAVING TIPS
• [Tip 1]
• [Tip 2]
• [Tip 3]

🌦️ SEASON ALERT
Best time: [months]
Avoid: [period — reason]

Be specific, practical, exciting. All prices realistic for India 2024.`;

    const aiResponse = await callAnthropic(prompt);

    // Save trip agar user logged in hai
    let savedTrip = null;
    if (req.user) {
      savedTrip = await Trip.create({
        user: req.user.id,
        destination: 'AI Recommended',
        budget: parseInt(budget),
        people: parseInt(people),
        days: parseInt(days),
        mood,
        aiPlan: aiResponse,
      });
    }

    res.json({
      success: true,
      plan: aiResponse,
      tripId: savedTrip?._id || null,
    });

  } catch (err) {
    console.error('AI Error:', err.message);
    res.status(500).json({ success: false, message: 'AI call fail hua: ' + err.message });
  }
});

// ─────────────────────────────────────
// POST /api/ai/recommend-destinations — Budget based suggestions
// ─────────────────────────────────────
router.post('/recommend-destinations', async (req, res) => {
  try {
    const { budget, people, days, mood } = req.body;

    const prompt = `Give me TOP 5 budget travel destinations in India for:
- Budget: ₹${budget} for ${people} people, ${days} days
- Mood: ${mood}

For each destination give ONLY this JSON format (no extra text):
{
  "destinations": [
    {
      "name": "City Name",
      "state": "State",
      "emoji": "🏖️",
      "reason": "One sentence why",
      "budgetFit": "Excellent/Good/Okay",
      "crowdLevel": "Low/Medium/High",
      "highlight": "Best thing about it"
    }
  ]
}`;

    const aiResponse = await callAnthropic(prompt);

    // JSON parse karo
    let parsed;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { destinations: [] };
    }

    res.json({ success: true, ...parsed });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────
// POST /api/ai/budget-optimize — Budget optimization tips
// ─────────────────────────────────────
router.post('/budget-optimize', protect, async (req, res) => {
  try {
    const { destination, budget, people, days } = req.body;

    const prompt = `Give 5 specific money-saving tips for traveling to ${destination}, India with ₹${budget} for ${people} people for ${days} days.
Format as JSON:
{
  "tips": [
    {"title": "Tip title", "saving": "₹XXX", "detail": "How to do it"}
  ],
  "totalPossibleSaving": "₹XXXX"
}
Only JSON, no extra text.`;

    const aiResponse = await callAnthropic(prompt);
    let parsed;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { tips: [], totalPossibleSaving: '₹0' };
    }

    res.json({ success: true, ...parsed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────
// POST /api/ai/crowd-predict — Crowd prediction for dates
// ─────────────────────────────────────
router.post('/crowd-predict', async (req, res) => {
  try {
    const { destination, month } = req.body;

    const prompt = `Predict crowd level for ${destination}, India in month: ${month}.
JSON only:
{
  "crowdLevel": "Low/Medium/High",
  "crowdScore": 0-100,
  "reason": "why",
  "priceImpact": "+XX% / -XX% / Normal",
  "recommendation": "Go / Avoid / Consider"
}`;

    const aiResponse = await callAnthropic(prompt);
    let parsed;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = { crowdLevel: 'Medium', crowdScore: 50 };
    }

    res.json({ success: true, destination, month, ...parsed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
