// Bloomberg AI Terminal Dashboard Controller

// Global Application State
const state = {
  activeTicker: 'BBCA',
  newsArticles: [],
  activeArticleIndex: null,
  chartInstance: null,
  geminiApiKey: localStorage.getItem('API_GEMINI') || '',
  isAnalyzing: false,
  pingInterval: null
};

// Default stock base prices & trends to simulate realistic charts
const TICKER_DEFAULTS = {
  'BBCA': { name: 'Bank Central Asia Tbk.', price: 10250, volatility: 0.008 },
  'BBRI': { name: 'Bank Rakyat Indonesia Tbk.', price: 4820, volatility: 0.012 },
  'TLKM': { name: 'Telkom Indonesia Tbk.', price: 3690, volatility: 0.010 },
  'BMRI': { name: 'Bank Mandiri Tbk.', price: 6275, volatility: 0.011 },
  'ASII': { name: 'Astra International Tbk.', price: 4980, volatility: 0.013 },
  'GOTO': { name: 'GoTo Gojek Tokopedia Tbk.', price: 58, volatility: 0.035 },
  'BBNI': { name: 'Bank Negara Indonesia Tbk.', price: 4750, volatility: 0.012 },
  'UNVR': { name: 'Unilever Indonesia Tbk.', price: 2890, volatility: 0.015 }
};

// DOM Elements
const el = {
  tickerSearch: document.getElementById('tickerSearch'),
  searchBtn: document.getElementById('searchBtn'),
  newsLoader: document.getElementById('newsLoader'),
  newsList: document.getElementById('newsList'),
  newsEmpty: document.getElementById('newsEmpty'),
  newsCount: document.getElementById('newsCount'),
  chartTicker: document.getElementById('chartTicker'),
  readerContent: document.getElementById('readerContent'),
  aiLoader: document.getElementById('aiLoader'),
  aiResult: document.getElementById('aiResult'),
  aiEmpty: document.getElementById('aiEmpty'),
  analysisStatus: document.getElementById('analysisStatus'),
  terminalLogs: document.getElementById('terminalLogs'),
  sentimentBadge: document.getElementById('sentimentBadge'),
  sentimentScoreText: document.getElementById('sentimentScoreText'),
  sentimentNeedle: document.getElementById('sentimentNeedle'),
  confidenceValue: document.getElementById('confidenceValue'),
  executiveSummary: document.getElementById('executiveSummary'),
  catalystList: document.getElementById('catalystList'),
  priceDirection: document.getElementById('priceDirection'),
  priceTimeline: document.getElementById('priceTimeline'),
  priceRange: document.getElementById('priceRange'),
  directionExplanation: document.getElementById('directionExplanation'),
  directionCard: document.getElementById('directionCard'),
  timeDisplay: document.getElementById('timeDisplay'),
  pingValue: document.getElementById('pingValue'),
  aiKeyStatus: document.getElementById('aiKeyStatus'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsModal: document.getElementById('closeSettingsModal'),
  geminiApiKeyInput: document.getElementById('geminiApiKey'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  clearKeyBtn: document.getElementById('clearKeyBtn'),
  currentKeyStatus: document.getElementById('currentKeyStatus')
};

// 1. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateClock();
  startPingMonitor();
  checkApiKeyStatus();
  
  // Load default ticker BBCA on load
  runAnalytics('BBCA');
});

// Setup Clock
function updateClock() {
  const now = new Date();
  const formatNum = num => String(num).padStart(2, '0');
  el.timeDisplay.textContent = `${formatNum(now.getHours())}:${formatNum(now.getMinutes())}:${formatNum(now.getSeconds())}`;
  setTimeout(updateClock, 1000);
}

// Setup Latency Ping Monitor (simulated terminal effect + actual fetch ping)
function startPingMonitor() {
  const updatePing = async () => {
    const start = performance.now();
    try {
      // Just ping the news endpoint quickly with dummy request
      await fetch('/api/news?q=PING', { method: 'HEAD' });
      const duration = Math.round(performance.now() - start);
      el.pingValue.textContent = `${duration} ms`;
      el.pingValue.className = duration < 150 ? 'highlight-green' : 'highlight-red';
    } catch (e) {
      el.pingValue.textContent = 'OFFLINE';
      el.pingValue.className = 'highlight-red';
    }
  };
  updatePing();
  state.pingInterval = setInterval(updatePing, 10000);
}

// API Key Status Update
function checkApiKeyStatus() {
  if (state.geminiApiKey) {
    el.aiKeyStatus.textContent = 'LOCAL CLIENT KEY';
    el.aiKeyStatus.className = 'highlight-green';
    el.currentKeyStatus.textContent = 'Disimpan di Browser (Local Storage)';
    el.currentKeyStatus.className = 'status-desc';
    el.geminiApiKeyInput.value = state.geminiApiKey;
  } else {
    el.aiKeyStatus.textContent = 'USING SERVER KEY';
    el.aiKeyStatus.className = 'highlight-green';
    el.currentKeyStatus.textContent = 'Belum diset di browser (Menggunakan fallback .env server)';
    el.currentKeyStatus.className = 'status-desc unset';
    el.geminiApiKeyInput.value = '';
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Search actions
  el.searchBtn.addEventListener('click', () => {
    const q = el.tickerSearch.value.trim();
    if (q) runAnalytics(q);
  });

  el.tickerSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = el.tickerSearch.value.trim();
      if (q) runAnalytics(q);
    } else if (e.key === 'Escape') {
      el.tickerSearch.value = '';
    }
  });

  // Quick tickers
  document.querySelectorAll('.quick-ticker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ticker = btn.dataset.ticker;
      document.querySelectorAll('.quick-ticker-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      el.tickerSearch.value = ticker;
      runAnalytics(ticker);
    });
  });

  // Modal Settings
  el.settingsBtn.addEventListener('click', () => {
    el.settingsModal.style.display = 'flex';
  });

  el.closeSettingsModal.addEventListener('click', () => {
    el.settingsModal.style.display = 'none';
  });

  el.settingsModal.addEventListener('click', (e) => {
    if (e.target === el.settingsModal) {
      el.settingsModal.style.display = 'none';
    }
  });

  el.saveSettingsBtn.addEventListener('click', () => {
    const key = el.geminiApiKeyInput.value.trim();
    state.geminiApiKey = key;
    if (key) {
      localStorage.setItem('API_GEMINI', key);
    } else {
      localStorage.removeItem('API_GEMINI');
    }
    checkApiKeyStatus();
    el.settingsModal.style.display = 'none';
  });

  el.clearKeyBtn.addEventListener('click', () => {
    state.geminiApiKey = '';
    localStorage.removeItem('API_GEMINI');
    checkApiKeyStatus();
    el.settingsModal.style.display = 'none';
  });

  // Hotkeys (F8-F11) simulation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F8') {
      e.preventDefault();
      el.newsList.focus();
    } else if (e.key === 'F9') {
      e.preventDefault();
      // focus chart
    } else if (e.key === 'F10') {
      e.preventDefault();
      // focus reader
    }
  });
}

// 2. CORE ACTION: RUN ANALYTICS
async function runAnalytics(query) {
  const ticker = query.toUpperCase();
  state.activeTicker = ticker;
  el.chartTicker.textContent = ticker;

  // Highlight active quick ticker if matching
  document.querySelectorAll('.quick-ticker-btn').forEach(btn => {
    if (btn.dataset.ticker === ticker) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Reset displays
  el.newsEmpty.style.display = 'none';
  el.newsLoader.style.display = 'flex';
  el.newsList.style.display = 'none';
  el.newsCount.textContent = '0 ARTICLES';
  
  el.readerContent.innerHTML = `
    <div class="reader-empty">
      <p>Memuat visualisasi chart & data artikel...</p>
    </div>
  `;

  // Start AI Loader panel setup
  el.aiEmpty.style.display = 'none';
  el.aiResult.style.display = 'none';
  el.aiLoader.style.display = 'flex';
  el.analysisStatus.textContent = 'LOADING NEWS...';
  el.terminalLogs.innerHTML = '';
  
  addTerminalLog('SYSTEM', `Initializing analytical sequence for security ID [${ticker}]`);
  addTerminalLog('SYSTEM', `Fetching news feed aggregates from Google News...`);

  // RENDER CHART
  renderChart(ticker);

  // FETCH NEWS
  try {
    const response = await fetch(`/api/news?q=${encodeURIComponent(ticker)}`);
    if (!response.ok) {
      throw new Error(`Server returned news error ${response.status}`);
    }
    const articles = await response.json();
    state.newsArticles = articles;

    if (articles.length === 0) {
      showEmptyState(`Tidak ada berita yang ditemukan untuk ticker ${ticker}.`);
      return;
    }

    addTerminalLog('SYSTEM', `Successfully indexed ${articles.length} news items from Google feeds.`);
    el.newsCount.textContent = `${articles.length} ARTICLES`;
    el.newsLoader.style.display = 'none';
    el.newsList.style.display = 'flex';
    
    // Render News items to Left Wire panel
    renderNewsWire();
    
    // Default select first article
    selectArticle(0);

    // KICK OFF GEMINI SENTIMENT ANALYSIS
    runAIAnalysis(ticker, articles);

  } catch (error) {
    console.error('Error fetching news:', error);
    showEmptyState(`Gagal mengambil berita: ${error.message}`);
  }
}

// Render News cards in News Wire column
function renderNewsWire() {
  el.newsList.innerHTML = '';
  state.newsArticles.forEach((art, index) => {
    const card = document.createElement('div');
    card.className = `news-card ${index === state.activeArticleIndex ? 'active' : ''}`;
    card.dataset.index = index;
    
    // Parse / format date
    const dateObj = new Date(art.pubDate);
    const dateFormatted = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const timeFormatted = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    card.innerHTML = `
      <div class="news-meta">
        <span class="news-source">${art.source}</span>
        <span class="news-time">${dateFormatted} ${timeFormatted}</span>
      </div>
      <div class="news-headline">${escapeHTML(art.title)}</div>
    `;

    card.addEventListener('click', () => {
      selectArticle(index);
    });

    el.newsList.appendChild(card);
  });
}

// Select an article to show in Center bottom panel
function selectArticle(index) {
  state.activeArticleIndex = index;
  
  // Highlight card in list
  document.querySelectorAll('.news-card').forEach((card, idx) => {
    if (idx === index) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  const art = state.newsArticles[index];
  if (!art) return;

  const dateObj = new Date(art.pubDate);
  const formattedDate = dateObj.toLocaleDateString('id-ID', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  el.readerContent.innerHTML = `
    <div class="reader-header">
      <h2 class="reader-title">${escapeHTML(art.title)}</h2>
      <div class="reader-meta">
        <span>SOURCE: <span class="reader-source">${art.source}</span></span>
        <span>PUBLISHED: <span>${formattedDate}</span></span>
      </div>
    </div>
    <div class="reader-body">
      ${art.description ? art.description : 'Tidak ada deskripsi tambahan. Silakan klik tombol di bawah untuk melihat artikel lengkap.'}
    </div>
    <a href="${art.link}" target="_blank" class="btn-open-link">
      <span>BUKA BERITA ASLI (ORIGINAL LINK)</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    </a>
  `;
}

// 3. GEMINI AI RUNNER
async function runAIAnalysis(ticker, articles) {
  state.isAnalyzing = true;
  el.analysisStatus.textContent = 'COMPILING DATA';
  
  // Setup simulated compile logs in terminal console
  addTerminalLog('GEMINI', `Establishing websocket conduit to LLM service node...`);
  await sleep(600);
  addTerminalLog('GEMINI', `Extracting token signatures for ${articles.length} indexing vectors...`);
  await sleep(500);
  addTerminalLog('GEMINI', `Evaluating fundamental sentiment weights (Model: gemini-3.5-flash)...`);
  await sleep(700);
  addTerminalLog('GEMINI', `Synthesizing consensus data streams. Executing analysis request...`);

  // Prepare headlines payload (Limit to top 10 articles to stay within prompt efficiency boundaries)
  const payloadArticles = articles.slice(0, 10).map(a => ({
    title: a.title,
    description: a.description || '',
    source: a.source,
    pubDate: a.pubDate
  }));

  try {
    const reqHeaders = {
      'Content-Type': 'application/json'
    };
    if (state.geminiApiKey) {
      reqHeaders['X-Gemini-API-Key'] = state.geminiApiKey;
    }

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify({
        ticker: ticker,
        articles: payloadArticles
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || `Server responded with status ${response.status}`);
    }

    const result = await response.json();
    
    addTerminalLog('SYSTEM', `AI compiler return code 200: Successfully parsed JSON analysis object.`);
    await sleep(400);

    // Display AI Results
    el.aiLoader.style.display = 'none';
    el.aiResult.style.display = 'flex';
    el.analysisStatus.textContent = 'ACTIVE ANALYTICS';
    
    // Update Sentiment Meter
    renderSentimentMeter(result.sentiment, result.score, result.confidence);
    
    // RENDER TEXT (with typing effect!)
    typeText(el.executiveSummary, result.summary);

    // Render Catalyst lists
    renderCatalystList(result.bulletPoints);

    // Update target parameters
    updateTargetPredictions(result);

  } catch (error) {
    console.error('Error in AI Analysis:', error);
    addTerminalLog('ERROR', `AI analysis pipeline failure: ${error.message}`);
    
    // If failure is API key related, let user know
    const isApiKeyIssue = error.message.toLowerCase().includes('api key') || error.message.toLowerCase().includes('key missing');
    
    el.aiLoader.style.display = 'none';
    el.aiResult.style.display = 'none';
    el.aiEmpty.style.display = 'flex';
    el.analysisStatus.textContent = 'COMPILER ERROR';
    
    if (isApiKeyIssue) {
      el.aiEmpty.innerHTML = `
        <div class="empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="highlight-red">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <p class="highlight-red" style="font-weight: bold; margin-bottom: 8px;">GEMINI API KEY TIDAK VALID / BELUM DISET</p>
          <p style="font-size: 11px; max-width: 250px; margin-bottom: 15px;">Dibutuhkan API Key gratis dari Google AI Studio untuk melakukan analisis.</p>
          <button class="btn btn-primary" onclick="document.getElementById('settingsBtn').click()">SET API KEY SEKARANG</button>
        </div>
      `;
    } else {
      el.aiEmpty.innerHTML = `
        <div class="empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="highlight-red">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <p class="highlight-red" style="font-weight: bold; margin-bottom: 8px;">GAGAL MENJALANKAN AI ANALISIS</p>
          <p style="font-size: 11px;">Error: ${error.message}</p>
        </div>
      `;
    }
  } finally {
    state.isAnalyzing = false;
  }
}

// 4. CHART RENDERING ENGINE
function renderChart(ticker) {
  // Generate Simulated Price Data based on ticker base configs
  const tickerConfig = TICKER_DEFAULTS[ticker] || { name: `${ticker} Stock`, price: 1000, volatility: 0.02 };
  const basePrice = tickerConfig.price;
  const vol = tickerConfig.volatility;

  // Let's generate a 30-day random walk
  const labels = [];
  const prices = [];
  const volumes = [];
  
  let currentPrice = basePrice;
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    labels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
    
    // Random walk with basic upward drift
    const drift = 0.0005; 
    const rand = (Math.random() - 0.48); // slightly bullish bias
    currentPrice = currentPrice * (1 + (rand * vol) + drift);
    
    prices.push(Math.round(currentPrice));
    volumes.push(Math.round(Math.random() * 5000000 + 1000000));
  }

  const ctx = document.getElementById('tickerChart').getContext('2d');
  
  // Destroy previous Chart instance if exists
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  // Create Glowing Gradient under line
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(0, 153, 255, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 153, 255, 0.00)');

  // Determine if stock finished up or down overall to adjust glows
  const isUp = prices[29] >= prices[0];
  const accentColor = isUp ? '#00e676' : '#0099ff'; // Green or Blue line
  const glowColor = isUp ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0, 153, 255, 0.2)';

  state.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Price (IDR)',
        data: prices,
        borderColor: accentColor,
        borderWidth: 2,
        pointBackgroundColor: accentColor,
        pointBorderColor: '#07090b',
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: true,
        backgroundColor: gradient,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#0f1318',
          titleFont: { family: 'JetBrains Mono', size: 10 },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          titleColor: '#8e9ca8',
          bodyColor: '#fff',
          borderColor: '#212932',
          borderWidth: 1,
          padding: 8,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return ` Rp ${context.parsed.y.toLocaleString('id-ID')}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#171d24',
            drawTicks: false
          },
          ticks: {
            color: '#8e9ca8',
            font: { family: 'JetBrains Mono', size: 8 },
            maxTicksLimit: 7
          }
        },
        y: {
          grid: {
            color: '#171d24',
            drawTicks: false
          },
          ticks: {
            color: '#8e9ca8',
            font: { family: 'JetBrains Mono', size: 8 },
            callback: function(value) {
              return `Rp ${value.toLocaleString('id-ID')}`;
            }
          }
        }
      }
    }
  });
}

// 5. HELPER DISPLAY RENDERING & TYPING EFFECTS
function renderSentimentMeter(sentiment, score, confidence) {
  el.sentimentBadge.textContent = sentiment.toUpperCase();
  el.sentimentBadge.className = `sentiment-indicator-badge ${sentiment.toUpperCase()}`;
  
  const displayScore = score > 0 ? `+${score}` : score;
  el.sentimentScoreText.textContent = `SCORE: ${displayScore}`;
  el.confidenceValue.textContent = `${confidence}% CONFIDENCE`;

  // Calculate needle placement (score goes -100 to +100)
  // maps to left percentage: 0% at -100, 50% at 0, 100% at +100
  const leftPct = ((score + 100) / 200) * 100;
  
  // Restrict bounds
  const cleanLeftPct = Math.max(0, Math.min(100, leftPct));
  el.sentimentNeedle.style.left = `calc(${cleanLeftPct}% - 4px)`;
}

// Typewriter Text display effect
function typeText(targetEl, text) {
  targetEl.textContent = '';
  targetEl.classList.add('typing-text');
  
  let i = 0;
  const speed = 15; // ms per character
  
  function type() {
    if (i < text.length) {
      targetEl.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    } else {
      targetEl.classList.remove('typing-text');
    }
  }
  type();
}

// Bullet catalysts rendering
function renderCatalystList(bullets) {
  el.catalystList.innerHTML = '';
  
  if (!bullets || bullets.length === 0) {
    el.catalystList.innerHTML = '<li class="catalyst-item">No catalysts determined.</li>';
    return;
  }

  bullets.forEach(bullet => {
    const isBullish = bullet.type.toLowerCase() === 'bullish';
    const li = document.createElement('li');
    li.className = `catalyst-item ${isBullish ? 'bullish-driver' : 'bearish-driver'}`;
    
    const icon = isBullish ? '+' : '-';
    li.innerHTML = `
      <span class="catalyst-icon">${icon}</span>
      <span class="catalyst-text">${escapeHTML(bullet.text)}</span>
    `;
    
    el.catalystList.appendChild(li);
  });
}

// Price directions target update
function updateTargetPredictions(result) {
  const dir = result.priceImpact.direction.toUpperCase();
  el.priceDirection.textContent = dir;
  
  // Set card classes for green/red/amber targets
  el.directionCard.className = 'target-card direction-card';
  if (dir === 'UP') {
    el.directionCard.classList.add('up');
  } else if (dir === 'DOWN') {
    el.directionCard.classList.add('down');
  } else {
    el.directionCard.classList.add('stable');
  }

  el.priceTimeline.textContent = result.priceImpact.timeline;
  
  const minRange = result.targetPriceRange.minChangePct;
  const maxRange = result.targetPriceRange.maxChangePct;
  
  const formatPct = val => val > 0 ? `+${val}%` : `${val}%`;
  el.priceRange.textContent = `${formatPct(minRange)} to ${formatPct(maxRange)}`;
  
  el.directionExplanation.textContent = result.priceImpact.explanation;
}

// Terminal log line printing
function addTerminalLog(source, message) {
  const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
  const logLine = document.createElement('div');
  logLine.className = 'log-line';
  
  let sourceClass = 'highlight-green';
  if (source === 'ERROR') sourceClass = 'highlight-red';
  if (source === 'GEMINI') sourceClass = 'purple-text';

  logLine.innerHTML = `[${time}] <span class="${sourceClass}">${source}</span>: ${message}`;
  el.terminalLogs.appendChild(logLine);
  
  // Scroll to bottom
  el.terminalLogs.scrollTop = el.terminalLogs.scrollHeight;
}

// Empty state setup on fetch failure
function showEmptyState(msg) {
  el.newsLoader.style.display = 'none';
  el.newsList.style.display = 'none';
  el.newsEmpty.style.display = 'flex';
  el.newsEmpty.querySelector('p').textContent = msg;

  el.aiLoader.style.display = 'none';
  el.aiResult.style.display = 'none';
  el.aiEmpty.style.display = 'flex';
  el.analysisStatus.textContent = 'STANDBY';
}

// Helper: Escape HTML
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
