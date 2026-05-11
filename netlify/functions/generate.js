// generate.js
exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { who, problem, solution } = body;
  if (!who || !problem || !solution) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: who, problem, solution' }) };
  }

  const prompt =
    'You are an expert lead magnet copywriter.\n\n' +
    'Create a complete written lead magnet for:\n' +
    'Audience: ' + who + '\n' +
    'Problem: ' + problem + '\n' +
    'Solution: ' + solution + '\n\n' +
    'Write the FULL lead magnet including:\n' +
    '- A compelling title (mark it with a single # at the start of the line)\n' +
    '- An opening hook paragraph\n' +
    '- 3 to 5 complete sections, each with a ## heading and full written content\n' +
    '- A strong call to action at the end\n\n' +
    'Format rules: use # for the main title, ## for section headings, ### for any sub-headings, ' +
    '--- on its own line for a visual divider, **text** for bold emphasis, and - for bullet list items.\n\n' +
    'Write it ready to publish. Warm, friendly tone. No jargon. Talk like you\'re explaining to a 5th grader.';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Claude API error' })
      };
    }

    const text = (data.content || []).map(b => b.text || '').join('');
    if (!text) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No content returned from Claude' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: text })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal server error' })
    };
  }
};
