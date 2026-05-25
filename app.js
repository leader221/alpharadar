// AlphaRadar Stock Dashboard Application Logic

// ==========================================
// 1. STATE & CONSTANTS
// ==========================================
let currentTicker = 'QQQ';
let chartTimeframeDays = 90; // Default 3 months
let stockChart = null;

// Initial weights for the Buy Probability Algorithm
let weights = {
    ma: 40,    // SMA trend indicators
    tech: 25,  // RSI & Volume indicators
    news: 20,  // Sentiment of news
    fg: 15     // Market Fear & Greed Index
};

// Global Market Fear & Greed Index State
let marketFearGreed = 62; // Greed

// Mock Portfolio State
let portfolio = {
    cash: 100000.00,
    holdings: {
        QQQ: 0,
        SPY: 0,
        SCHD: 0,
        JEPQ: 0,
        HYNIX: 0,
        HYUNDAI: 0,
        SKT: 0,
        HANA: 0,
        GOOGL: 0,
        AMZN: 0
    }
};

const USDKRW = 1380; // KRW exchange rate for mock portfolio USD calculations

// Determine backend API host dynamically to support both file:/// and server connections
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

function formatMoney(value, currency) {
    if (currency === 'KRW') {
        return `₩${Math.round(value).toLocaleString()}`;
    }
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Static Metadata for each Asset
const tickerMetadata = {
    QQQ: {
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
        fullName: 'NASDAQ 100 Index ETF (QQQ)',
        dividendYield: '0.58%',
        isDividendETF: false,
        basePrice: 465.20,
        volatility: 0.012, // Daily volatility parameter
        currency: 'USD'
    },
    SPY: {
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF Trust',
        fullName: 'S&P 500 Index ETF (SPY)',
        dividendYield: '1.24%',
        isDividendETF: false,
        basePrice: 528.50,
        volatility: 0.008,
        currency: 'USD'
    },
    SCHD: {
        symbol: 'SCHD',
        name: 'Schwab U.S. Dividend Equity ETF',
        fullName: 'Schwab US Dividend Equity ETF (SCHD)',
        dividendYield: '3.42%',
        isDividendETF: true,
        basePrice: 79.80,
        volatility: 0.005,
        currency: 'USD'
    },
    JEPQ: {
        symbol: 'JEPQ',
        name: 'JPMorgan Nasdaq Premium Income ETF',
        fullName: 'JPMorgan Nasdaq Premium Income ETF (JEPQ)',
        dividendYield: '9.28%',
        isDividendETF: true,
        basePrice: 53.40,
        volatility: 0.007,
        currency: 'USD'
    },
    HYNIX: {
        symbol: '000660',
        name: 'SK Hynix',
        fullName: 'SK하이닉스 (000660)',
        dividendYield: '1.27%',
        isDividendETF: false,
        basePrice: 194100,
        volatility: 0.022,
        currency: 'KRW'
    },
    HYUNDAI: {
        symbol: '005380',
        name: 'Hyundai Motor',
        fullName: '현대자동차 (005380)',
        dividendYield: '5.40%',
        isDividendETF: false,
        basePrice: 258000,
        volatility: 0.015,
        currency: 'KRW'
    },
    SKT: {
        symbol: '017670',
        name: 'SK Telecom',
        fullName: 'SK텔레콤 (017670)',
        dividendYield: '6.20%',
        isDividendETF: false,
        basePrice: 52000,
        volatility: 0.009,
        currency: 'KRW'
    },
    HANA: {
        symbol: '086790',
        name: 'Hana Financial',
        fullName: '하나금융지주 (086790)',
        dividendYield: '5.80%',
        isDividendETF: false,
        basePrice: 61500,
        volatility: 0.014,
        currency: 'KRW'
    },
    GOOGL: {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        fullName: 'Alphabet Inc. Class A (GOOGL)',
        dividendYield: '0.45%',
        isDividendETF: false,
        basePrice: 172.50,
        volatility: 0.014,
        currency: 'USD'
    },
    AMZN: {
        symbol: 'AMZN',
        name: 'Amazon.com Inc.',
        fullName: 'Amazon.com Inc. (AMZN)',
        dividendYield: '0.00%',
        isDividendETF: false,
        basePrice: 181.20,
        volatility: 0.016,
        currency: 'USD'
    }
};

// Mock News Seed Data with Sentiments: 1 = Positive, 0 = Neutral, -1 = Negative
const newsSeed = {
    QQQ: [
        { title: "인공지능(AI) 반도체 수요 폭발, 나스닥 100 상승 랠리 견인", source: "Bloomberg", time: "10분 전", sentiment: 1 },
        { title: "연준 금리 인하 기대감 후퇴에 빅테크 성장주 단기 차익 실현 매물 출현", source: "WSJ", time: "1시간 전", sentiment: -1 },
        { title: "엔비디아 차세대 AI 칩 블랙웰 출하 개시 소식에 기술주 동반 랠리", source: "CNBC", time: "3시간 전", sentiment: 1 },
        { title: "나스닥 100 지수, 단기 과열권 진입 우려에도 기술적 지지선 견고", source: "Reuters", time: "5시간 전", sentiment: 0 },
        { title: "빅테크 실적 발표 관망세 속에 옵션 시장 거래량 급증", source: "Financial Times", time: "1일 전", sentiment: 0 }
    ],
    SPY: [
        { title: "S&P 500 사상 최고치 경신 눈앞... 경기 연착륙 시나리오 무게", source: "MarketWatch", time: "25분 전", sentiment: 1 },
        { title: "소비자물가지수(CPI) 예상치 부합하며 뉴욕 증시 안도 랠리", source: "Yahoo Finance", time: "2시간 전", sentiment: 1 },
        { title: "미국 제조업 지수 소폭 하락... 금리 인하 속도 조절 가능성 대두", source: "Bloomberg", time: "4시간 전", sentiment: 0 },
        { title: "지정학적 리스크 고조에 안전 자산 선호 심리 및 증시 변동성 확대", source: "CNBC", time: "1일 전", sentiment: -1 },
        { title: "기관 투자자들, S&P 500 ETF 매수 포지션 역대 최대 규모 기록", source: "Barrons", time: "1일 전", sentiment: 1 }
    ],
    SCHD: [
        { title: "배당 성장주 매력 부각... 안정적 현금 흐름 원하는 은퇴 자금 유입", source: "Dividend.com", time: "40분 전", sentiment: 1 },
        { title: "금리 고공행진 지속에도 SCHD 보유 종목들의 견고한 재무제표 돋보여", source: "Morningstar", time: "3시간 전", sentiment: 1 },
        { title: "배당 성장률 둔화 우려 속에 가치주 섹터로의 순환매 포착", source: "Reuters", time: "6시간 전", sentiment: 0 },
        { title: "SCHD, 단기 주가 정체 구간 진입... 장기 분할 매수 적기 분석", source: "Seeking Alpha", time: "1일 전", sentiment: 1 },
        { title: "배당 귀족 기업들의 2분기 배당금 증액 발표 잇따라", source: "WSJ", time: "2일 전", sentiment: 1 }
    ],
    JEPQ: [
        { title: "고배당 커버드콜 ETF 열풍... JEPQ 월 분배금 연환산 9.5% 상회", source: "Seeking Alpha", time: "15분 전", sentiment: 1 },
        { title: "나스닥 횡보 국면에서 최상의 성과... 커버드콜 옵션 프리미엄 상승", source: "Bloomberg", time: "2시간 전", sentiment: 1 },
        { title: "나스닥 급등 시 상승 제한 패널티... 투자자들의 기회 비용 분석", source: "CNBC", time: "5시간 전", sentiment: -1 },
        { title: "JEPQ 자산 규모 150억 달러 돌파... 월 배당 현금 흐름 수요 폭증", source: "Reuters", time: "1일 전", sentiment: 1 },
        { title: "옵션 내재 변동성 증가로 인한 JEPQ 분배금 추가 상승 예상", source: "FT", time: "1일 전", sentiment: 1 }
    ],
    HYNIX: [
        { title: "SK하이닉스, 5세대 HBM3E 세계 최초 양산 돌입... 엔비디아 공급 물량 증가", source: "한경비즈니스", time: "10분 전", sentiment: 1 },
        { title: "반도체 장비 반입 지연 우려에 SK하이닉스 단기 차익 실현 매물 출현", source: "매일경제", time: "1시간 전", sentiment: -1 },
        { title: "AI 반도체 수요 폭발로 D램 고정거래가 전월 대비 15% 이상 상승", source: "연합뉴스", time: "3시간 전", sentiment: 1 },
        { title: "외국인 투자자, SK하이닉스 7일 연속 순매수 행진... 시가총액 2위 공고화", source: "조선비즈", time: "5시간 전", sentiment: 1 },
        { title: "미국 테크 기업 실적 호조에 국내 반도체 가치 사슬 전반적인 온기 회복", source: "머니투데이", time: "1일 전", sentiment: 1 }
    ],
    HYUNDAI: [
        { title: "현대차, 주주환원 정책 대폭 강화 발표... 분기 배당 확대 계획", source: "동아일보", time: "12분 전", sentiment: 1 },
        { title: "제네시스 및 하이브리드 차종 글로벌 판매 호조 지속으로 2분기 사상 최대 실적 전망", source: "한국경제", time: "1시간 전", sentiment: 1 },
        { title: "북미 전기차 시장 경쟁 가열 속 현지 보조금 대응 전략 수정 착수", source: "머니투데이", time: "4시간 전", sentiment: 0 },
        { title: "글로벌 물류 및 해상 운송 비용 상승에 따른 이익률 소폭 하락 우려", source: "Reuters", time: "6시간 전", sentiment: -1 },
        { title: "인도 현지 법인 IPO 순항 소식에 현대차 주가 추가 모멘텀 획득", source: "조선비즈", time: "1일 전", sentiment: 1 }
    ],
    SKT: [
        { title: "SK텔레콤, AI 데이터센터 및 클라우드 신사업 부문 고성장세 지속", source: "디지털데일리", time: "20분 전", sentiment: 1 },
        { title: "5G 보급률 포화 속 규제 당국의 통신 요금 인하 압박 완만히 대응 중", source: "아이뉴스24", time: "2시간 전", sentiment: 0 },
        { title: "대표적인 고배당 방어주로서 증시 변동성 확대 장세에서 기관 매수세 유입", source: "매일경제", time: "5시간 전", sentiment: 1 },
        { title: "자사주 매입 및 소각 프로그램 검토 소식에 배당 메력 더해져", source: "한경비즈니스", time: "1일 전", sentiment: 1 },
        { title: "단기 가입자당평균매출(ARPU) 성장 정체 우려로 통신 사업 정체 리스크 제기", source: "파이낸셜뉴스", time: "2일 전", sentiment: -1 }
    ],
    HANA: [
        { title: "정부 밸류업 프로그램 최대 수혜주 부각... 하나금융지주 PBR 0.5배 저평가 매력", source: "한국경제", time: "8분 전", sentiment: 1 },
        { title: "홍콩 ELS 손실 충당금 선반영 완료, 하반기 영업이익 급반등 전망", source: "서울경제", time: "2시간 전", sentiment: 1 },
        { title: "금리 인하 기조 속 예대마진(NIM) 축소 방어를 위한 리스크 관리 집중", source: "연합뉴스", time: "4시간 전", sentiment: 0 },
        { title: "분기 균등 배당 도입 유력 소식에 배당 투자 유입 급증", source: "매일경제", time: "1일 전", sentiment: 1 },
        { title: "연체율 상승에 따른 대손충당금 적립액 가중 우려 상존", source: "조선비즈", time: "2일 전", sentiment: -1 }
    ],
    GOOGL: [
        { title: "구글 I/O에서 차세대 AI 모델 '제미나이 1.5 프로' 전격 발표, 검색 지배력 한층 강화", source: "TechCrunch", time: "15분 전", sentiment: 1 },
        { title: "유튜브 쇼츠 수익성 대폭 개선 및 클라우드 부문 흑자 규모 고속 성장", source: "Bloomberg", time: "1시간 전", sentiment: 1 },
        { title: "반독점 소송 리스크 장기화... 법원의 최종 판결 시점 조율 중", source: "WSJ", time: "3시간 전", sentiment: -1 },
        { title: "AI 검색 대체 우려 속 광고 시장 둔화 가능성 애널리스트 경고 발령", source: "CNBC", time: "5시간 전", sentiment: 0 },
        { title: "창사 이래 첫 분기 배당 도입 및 700억 달러 자사주 매입 발표 효과 지속", source: "MarketWatch", time: "1일 전", sentiment: 1 }
    ],
    AMZN: [
        { title: "아마존 웹 서비스(AWS) 분기 매출 성장률 재가속화... AI 워크로드 유입 집중", source: "TechCrunch", time: "30분 전", sentiment: 1 },
        { title: "물류망 효율화 및 인공지능 기반 비용 절감 정책으로 영업이익 서프라이즈 달성", source: "CNBC", time: "2시간 전", sentiment: 1 },
        { title: "FTC 독점 금지 소송 및 배송 파트너 노조 조직 확대 움직임 주시", source: "Bloomberg", time: "4시간 전", sentiment: 0 },
        { title: "소비 둔화로 인한 리테일 부문 성장 정체 리스크 상존", source: "WSJ", time: "1일 전", sentiment: -1 },
        { title: "글로벌 온라인 유통 네트워크 지배력 장악 및 유료 프라임 회원 역대 최다 경신", source: "FT", time: "2일 전", sentiment: 1 }
    ]
};

// Historical Price Data for each stock (Prepopulated)
const historicalData = {};

function initCustomTickers() {
    const saved = localStorage.getItem('alpharadar_custom_tickers');
    if (saved) {
        try {
            const customList = JSON.parse(saved);
            customList.forEach(meta => {
                const key = meta.symbol;
                tickerMetadata[key] = meta;
                if (portfolio.holdings[key] === undefined) {
                    portfolio.holdings[key] = 0;
                }
                injectTickerTab(key, meta);
                
                // Dynamic news seed fallback
                if (!newsSeed[key]) {
                    newsSeed[key] = [
                        { title: `${meta.name} 실시간 거래량 급증 분석 보고서 공개`, source: "Reuters", time: "10분 전", sentiment: 1 },
                        { title: `${meta.name} 기관 순매수 거래 대금 유입세 포착`, source: "Bloomberg", time: "1시간 전", sentiment: 1 },
                        { title: `${meta.name} 단기 돌파 매물대 진입... 변동성 유의`, source: "CNBC", time: "3시간 전", sentiment: 0 },
                        { title: `${meta.name} 거시경제 영향에 따른 섹터별 포지션 리밸런싱 우려`, source: "WSJ", time: "6시간 전", sentiment: -1 },
                        { title: `${meta.name} 2분기 경영 실적 관망에 따른 기관 숨고르기`, source: "MarketWatch", time: "1일 전", sentiment: 0 }
                    ];
                }
            });
        } catch (e) {
            console.warn('[AlphaRadar] Failed to parse custom tickers from localStorage:', e.message);
        }
    }
}

function injectTickerTab(key, meta) {
    const parentId = (meta.currency === 'KRW' || key.endsWith('.KS') || key.endsWith('.KQ')) ? 'ticker-group-kor' : 'ticker-group-usa';
    const parent = document.getElementById(parentId);
    if (!parent) return;
    
    // Check if tab already exists
    if (document.querySelector(`.nav-tab[data-ticker="${key}"]`)) return;
    
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.setAttribute('data-ticker', key);
    
    const displaySymbol = meta.symbol.replace('.KS', '').replace('.KQ', '');
    const badgeClass = key.toLowerCase().replace('.', '-');
    
    btn.innerHTML = `
        <span class="ticker-badge ${badgeClass}">${displaySymbol}</span>
        <div class="ticker-info">
            <span class="ticker-name">${meta.name}</span>
            <span class="ticker-price-mini" id="mini-price-${key}">${meta.currency === 'KRW' ? '₩0' : '$0.00'}</span>
        </div>
        <span class="ticker-change-mini" id="mini-change-${key}">+0.00%</span>
    `;
    
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        
        const btnNode = e.currentTarget;
        btnNode.classList.add('active');
        currentTicker = btnNode.getAttribute('data-ticker');
        updateDashboardUI();
    });
    
    parent.appendChild(btn);
}

// ==========================================
// 2. DATA GENERATION ENGINE
// ==========================================
async function initHistoricalData() {
    const today = new Date();
    const tickers = Object.keys(tickerMetadata);
    
    for (const ticker of tickers) {
        const meta = tickerMetadata[ticker];
        const yahooSymbol = meta.currency === 'KRW' ? `${meta.symbol}.KS` : meta.symbol;
        let loaded = false;
        
        try {
            // Try to fetch historical data from local proxy server
            const response = await fetch(`${API_BASE}/api/chart?symbol=${yahooSymbol}`);
            if (response.ok) {
                const json = await response.json();
                const chart = json.chart.result[0];
                const timestamps = chart.timestamp;
                const closes = chart.indicators.quote[0].close;
                const volumes = chart.indicators.quote[0].volume;
                
                if (timestamps && closes) {
                    const dataPoints = [];
                    for (let i = 0; i < timestamps.length; i++) {
                        if (closes[i] === null || closes[i] === undefined) continue;
                        
                        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                        const closeVal = meta.currency === 'KRW' ? Math.round(closes[i]) : parseFloat(closes[i].toFixed(2));
                        const volVal = (volumes && volumes[i]) || 0;
                        
                        dataPoints.push({
                            date: date,
                            close: closeVal,
                            volume: volVal
                        });
                    }
                    
                    if (dataPoints.length > 0) {
                        historicalData[ticker] = dataPoints;
                        meta.basePrice = dataPoints[dataPoints.length - 1].close;
                        loaded = true;
                        console.log(`[AlphaRadar] Successfully loaded actual historical data for ${ticker} (${dataPoints.length} points)`);
                    }
                }
            }
        } catch (e) {
            console.warn(`[AlphaRadar] Failed to fetch actual historical data for ${ticker}, using simulation fallback:`, e.message);
        }
        
        // Fallback to random walk simulation if API failed or server is offline
        if (!loaded) {
            const dataPoints = [];
            let price = meta.basePrice;
            let baseVol = 2500000;
            if (ticker === 'QQQ' || ticker === 'SPY') baseVol = 60000000;
            else if (ticker === 'GOOGL' || ticker === 'AMZN') baseVol = 25000000;
            else if (ticker === 'SKT' || ticker === 'HANA') baseVol = 800000;
            
            for (let i = 0; i <= 1825; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                
                const dayOfWeek = date.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) continue;
                
                const changePercent = (Math.random() - 0.485) * 2 * meta.volatility;
                const volumeChange = (Math.random() - 0.5) * 0.4;
                const volume = Math.floor(baseVol * (1 + volumeChange));
                
                dataPoints.push({
                    date: date.toISOString().split('T')[0],
                    close: meta.currency === 'KRW' ? Math.round(price) : parseFloat(price.toFixed(2)),
                    volume: volume
                });
                
                price = price / (1 + changePercent);
            }
            historicalData[ticker] = dataPoints.reverse();
        }
    }
    
    // Once historical data is loaded, trigger dashboard update
    updateDashboardUI();
}

// ==========================================
// 3. QUANTITATIVE ANALYSIS ALGORITHMS
// ==========================================

// Simple Moving Average (SMA) Calculation
function calculateSMA(data, period) {
    const smaValues = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            smaValues.push(null); // Not enough data points
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j].close;
            }
            smaValues.push(parseFloat((sum / period).toFixed(2)));
        }
    }
    return smaValues;
}

// Relative Strength Index (RSI 14) Calculation
function calculateRSI(prices, period = 14) {
    const rsiValues = Array(prices.length).fill(null);
    if (prices.length < period) return rsiValues;
    
    let gains = 0;
    let losses = 0;
    
    // First RSI calculation point
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues[period] = avgLoss === 0 ? 100 : parseFloat((100 - (100 / (1 + rs))).toFixed(2));
    
    // Smooth calculations for the rest
    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        let currentGain = diff > 0 ? diff : 0;
        let currentLoss = diff < 0 ? -diff : 0;
        
        avgGain = (avgGain * (period - 1) + currentGain) / period;
        avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
        
        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiValues[i] = avgLoss === 0 ? 100 : parseFloat((100 - (100 / (1 + rs))).toFixed(2));
    }
    return rsiValues;
}

// MACD (12, 26, 9) Calculation
function calculateMACD(prices) {
    const macdValues = Array(prices.length).fill(null);
    const signalValues = Array(prices.length).fill(null);
    
    if (prices.length < 26) return { macd: macdValues, signal: signalValues };

    // EMA helper function
    function calculateEMA(prices, period) {
        const ema = Array(prices.length).fill(null);
        const k = 2 / (period + 1);
        
        // Use SMA for seed point
        let sum = 0;
        for (let i = 0; i < period; i++) sum += prices[i];
        ema[period - 1] = sum / period;
        
        for (let i = period; i < prices.length; i++) {
            ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
        }
        return ema;
    }
    
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    
    const macdLine = [];
    for (let i = 0; i < prices.length; i++) {
        if (ema12[i] === null || ema26[i] === null) {
            macdLine.push(null);
        } else {
            macdLine.push(ema12[i] - ema26[i]);
        }
    }
    
    // Signal Line = EMA(MACD Line, 9)
    const k9 = 2 / (9 + 1);
    let startIdx = 25 + 9;
    
    if (macdLine.length > startIdx) {
        let sum = 0;
        let validPoints = 0;
        let firstSignalIdx = -1;
        
        for (let i = 0; i < macdLine.length; i++) {
            if (macdLine[i] !== null) {
                sum += macdLine[i];
                validPoints++;
                if (validPoints === 9) {
                    signalValues[i] = sum / 9;
                    firstSignalIdx = i;
                    break;
                }
            }
        }
        
        for (let i = firstSignalIdx + 1; i < macdLine.length; i++) {
            if (macdLine[i] !== null && signalValues[i - 1] !== null) {
                signalValues[i] = macdLine[i] * k9 + signalValues[i - 1] * (1 - k9);
            }
        }
    }
    
    return { macd: macdLine, signal: signalValues };
}

// Compute all Technical metrics for rendering
function analyzeTechnicals(ticker, idx = null) {
    const data = historicalData[ticker];
    const prices = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    const sma20 = calculateSMA(data, 20);
    const sma50 = calculateSMA(data, 50);
    const sma200 = calculateSMA(data, 200);
    const rsi = calculateRSI(prices, 14);
    const macdData = calculateMACD(prices);
    
    if (idx === null || idx < 0) {
        idx = prices.length - 1;
    }
    const currentPrice = prices[idx];
    
    // 1. SMA Trend Verdict
    let maVerdict = 'NEUTRAL';
    let maScore = 50;
    if (sma20[idx] && sma50[idx] && sma200[idx]) {
        const curSMA20 = sma20[idx];
        const curSMA50 = sma50[idx];
        const curSMA200 = sma200[idx];
        
        if (currentPrice > curSMA20 && curSMA20 > curSMA50 && curSMA50 > curSMA200) {
            maVerdict = 'STRONG BULLISH';
            maScore = 95;
        } else if (currentPrice > curSMA20 && curSMA20 > curSMA50) {
            maVerdict = 'BULLISH';
            maScore = 75;
        } else if (currentPrice < curSMA20 && curSMA20 < curSMA50 && curSMA50 < curSMA200) {
            maVerdict = 'STRONG BEARISH';
            maScore = 10;
        } else if (currentPrice < curSMA20 && curSMA20 < curSMA50) {
            maVerdict = 'BEARISH';
            maScore = 25;
        }
    }
    
    // 2. RSI Valuation Verdict
    const curRSI = rsi[idx] || 50;
    let rsiVerdict = 'NEUTRAL';
    let rsiScore = 50;
    if (curRSI >= 70) {
        rsiVerdict = 'OVERBOUGHT (매도 과열)';
        rsiScore = 20; // Bad for immediate buy
    } else if (curRSI > 60) {
        rsiVerdict = 'RISING MOMENTUM';
        rsiScore = 60;
    } else if (curRSI <= 30) {
        rsiVerdict = 'OVERSOLD (분할매수 기회)';
        rsiScore = 90; // Excellent for buying
    } else if (curRSI < 40) {
        rsiVerdict = 'UNDERVALUED';
        rsiScore = 75;
    }
    
    // 3. MACD Golden/Dead Cross Verdict
    let macdVerdict = 'NEUTRAL';
    let macdScore = 50;
    const macdVal = macdData.macd[idx];
    const sigVal = macdData.signal[idx];
    const prevMacdVal = macdData.macd[idx - 1];
    const prevSigVal = macdData.signal[idx - 1];
    
    if (macdVal !== null && sigVal !== null && prevMacdVal !== null && prevSigVal !== null) {
        if (prevMacdVal <= prevSigVal && macdVal > sigVal) {
            macdVerdict = 'GOLDEN CROSS (상승 전환)';
            macdScore = 90;
        } else if (prevMacdVal >= prevSigVal && macdVal < sigVal) {
            macdVerdict = 'DEAD CROSS (하락 전환)';
            macdScore = 15;
        } else if (macdVal > sigVal) {
            macdVerdict = 'BULLISH TREND';
            macdScore = 70;
        } else {
            macdVerdict = 'BEARISH TREND';
            macdScore = 30;
        }
    }
    
    // 4. Volume Trend
    let volVerdict = 'NORMAL';
    let volScore = 50;
    const last5DaysVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const last20DaysVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volRatio = last5DaysVol / last20DaysVol;
    
    if (volRatio > 1.25) {
        volVerdict = 'ACCELERATING (거래량 급증)';
        // If price is rising, volume acceleration is a strong buy. If price is falling, it might mean panic sell.
        const priceChange = prices[idx] - prices[idx - 5];
        if (priceChange > 0) {
            volScore = 85;
        } else {
            volScore = 40;
        }
    } else if (volRatio < 0.75) {
        volVerdict = 'DULL (거래 침체)';
        volScore = 45;
    }
    
    // News Sentiment Calculation
    const news = newsSeed[ticker];
    const totalSentiment = news.reduce((acc, item) => acc + item.sentiment, 0);
    const avgSentiment = totalSentiment / news.length; // Range [-1, 1]
    const newsScore = ((avgSentiment + 1) / 2) * 100; // Map [-1, 1] to [0, 100]
    
    // Fear and Greed Index Score mapping:
    // Extreme Fear is a buy signal (Warren Buffett rule) -> value 0-25 mapped to 85-70 score
    // Fear -> 70-55 score
    // Neutral -> 55-50 score
    // Greed -> 50-40 score
    // Extreme Greed is a sell warning -> value 75-100 mapped to 40-20 score
    let fgScore = 50;
    if (marketFearGreed < 25) {
        fgScore = 85 - (marketFearGreed * 0.6); // high buy rating during extreme fear
    } else if (marketFearGreed < 45) {
        fgScore = 70 - ((marketFearGreed - 25) * 0.75);
    } else if (marketFearGreed < 55) {
        fgScore = 55 - ((marketFearGreed - 45) * 0.5);
    } else if (marketFearGreed < 75) {
        fgScore = 50 - ((marketFearGreed - 55) * 0.5);
    } else {
        fgScore = 40 - ((marketFearGreed - 75) * 0.8);
    }
    
    return {
        ma: { verdict: maVerdict, score: maScore, valueText: `SMA 20/50/200 골든정렬 지표` },
        rsi: { verdict: rsiVerdict, score: rsiScore, valueText: `RSI(14): ${curRSI.toFixed(1)}` },
        macd: { verdict: macdVerdict, score: macdScore, valueText: `MACD Crossover 상태` },
        vol: { verdict: volVerdict, score: volScore, valueText: `거래량 비율: ${(volRatio * 100).toFixed(0)}%` },
        newsScore: newsScore,
        fgScore: fgScore
    };
}

// Compute the dynamic composite Buy Probability based on user-configured weights
function calculateBuyProbability(ticker, analysis) {
    // Normalization to ensure weights sum to exactly 100% in math
    const totalW = weights.ma + weights.tech + weights.news + weights.fg;
    if (totalW === 0) return 0;
    
    const normMa = weights.ma / totalW;
    const normTech = weights.tech / totalW;
    const normNews = weights.news / totalW;
    const normFg = weights.fg / totalW;
    
    // Decompose analysis scores
    const scoreMA = analysis.ma.score; // Weight: MA
    const scoreTech = (analysis.rsi.score + analysis.vol.score) / 2; // Weight: Tech
    const scoreNews = analysis.newsScore; // Weight: News
    const scoreFG = analysis.fgScore; // Weight: Fear & Greed
    
    const compositeScore = (scoreMA * normMa) + (scoreTech * normTech) + (scoreNews * normNews) + (scoreFG * normFg);
    return Math.min(Math.max(Math.round(compositeScore), 0), 100);
}

// ==========================================
// 4. CHART RENDERING IMPLEMENTATION
// ==========================================
function updateStockChart(ticker, days) {
    const data = historicalData[ticker].slice(-days);
    const labels = data.map(d => d.date);
    const prices = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    // Calculate SMAs for rendering
    const fullData = historicalData[ticker];
    const fullSma20 = calculateSMA(fullData, 20);
    const fullSma50 = calculateSMA(fullData, 50);
    const fullSma200 = calculateSMA(fullData, 200);
    
    const sma20 = fullSma20.slice(-days);
    const sma50 = fullSma50.slice(-days);
    const sma200 = fullSma200.slice(-days);
    
    const ctx = document.getElementById('mainStockChart').getContext('2d');
    
    if (stockChart) {
        stockChart.destroy();
    }
    
    // Create modern gradients for chart aesthetic
    const priceGradient = ctx.createLinearGradient(0, 0, 0, 300);
    priceGradient.addColorStop(0, 'rgba(0, 82, 255, 0.22)');
    priceGradient.addColorStop(1, 'rgba(0, 82, 255, 0.0)');
    
    // Colors depending on ticker type
    const badgeClass = tickerMetadata[ticker].symbol.toLowerCase();
    let themeColor = 'rgba(0, 82, 255, 1)';
    if (ticker === 'SPY') themeColor = 'rgba(255, 92, 0, 1)';
    if (ticker === 'SCHD') themeColor = 'rgba(16, 185, 129, 1)';
    if (ticker === 'JEPQ') themeColor = 'rgba(139, 92, 246, 1)';
    if (ticker === 'HYNIX') themeColor = 'rgba(230, 0, 18, 1)';
    if (ticker === 'HYUNDAI') themeColor = 'rgba(0, 44, 95, 1)';
    if (ticker === 'SKT') themeColor = 'rgba(255, 92, 0, 1)';
    if (ticker === 'HANA') themeColor = 'rgba(0, 135, 122, 1)';
    if (ticker === 'GOOGL') themeColor = 'rgba(66, 133, 244, 1)';
    if (ticker === 'AMZN') themeColor = 'rgba(255, 153, 0, 1)';
    
    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '종가 (Close Price)',
                    data: prices,
                    borderColor: themeColor,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: themeColor,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 1.5,
                    fill: true,
                    backgroundColor: priceGradient,
                    yAxisID: 'y'
                },
                {
                    label: 'SMA 20',
                    data: sma20,
                    borderColor: 'rgba(0, 172, 255, 0.75)',
                    borderWidth: 1.2,
                    pointRadius: 0,
                    borderDash: [2, 2],
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: 'SMA 50',
                    data: sma50,
                    borderColor: 'rgba(245, 158, 11, 0.75)',
                    borderWidth: 1.2,
                    pointRadius: 0,
                    borderDash: [4, 4],
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: 'SMA 200',
                    data: sma200,
                    borderColor: 'rgba(239, 68, 68, 0.75)',
                    borderWidth: 1.2,
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: '거래량 (Volume)',
                    type: 'bar',
                    data: volumes,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    hoverBackgroundColor: 'rgba(255, 255, 255, 0.25)',
                    yAxisID: 'yVolume',
                    barThickness: 'flex'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false // We use custom legends in HTML
                },
                tooltip: {
                    backgroundColor: 'rgba(11, 15, 25, 0.95)',
                    titleColor: 'rgba(255, 255, 255, 0.8)',
                    bodyColor: 'rgba(255, 255, 255, 0.9)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.dataset.type === 'bar') {
                                label += parseInt(context.raw).toLocaleString();
                            } else {
                                label += formatMoney(parseFloat(context.raw), tickerMetadata[ticker].currency);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                        drawTicks: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            family: 'JetBrains Mono',
                            size: 10
                        },
                        callback: function(value) {
                            const meta = tickerMetadata[ticker];
                            if (meta.currency === 'KRW') {
                                return '₩' + Math.round(value).toLocaleString();
                            }
                            return '$' + value.toFixed(1);
                        }
                    }
                },
                yVolume: {
                    type: 'linear',
                    display: false, // hide secondary y-axis labels
                    position: 'left',
                    grid: {
                        drawOnChartArea: false
                    },
                    max: Math.max(...volumes) * 3 // scale volume bars down at the bottom
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                        drawTicks: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            size: 9
                        },
                        maxTicksLimit: 8
                    }
                }
            }
        }
    });
}

// ==========================================
// 5. DOM BINDING & INTERACTIVITY RENDERER
// ==========================================
function updateDashboardUI() {
    const dataPoints = historicalData[currentTicker];
    if (!dataPoints || dataPoints.length === 0) {
        console.log(`[AlphaRadar] Waiting for historical data of ${currentTicker} to load...`);
        return;
    }
    const meta = tickerMetadata[currentTicker];
    const currentClose = dataPoints[dataPoints.length - 1].close;
    const prevClose = dataPoints[dataPoints.length - 2].close;
    const change = currentClose - prevClose;
    const changePct = (change / prevClose) * 100;
    
    // Update active tab styles
    document.querySelectorAll('.nav-tab').forEach(btn => {
        if (btn.getAttribute('data-ticker') === currentTicker) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update titles
    document.getElementById('current-ticker-full').innerText = meta.fullName;
    
    // Price Ribbon updates
    const currentPriceEl = document.getElementById('current-price');
    const oldPrice = parseFloat(currentPriceEl.innerText.replace(/[^0-9.]/g, ''));
    currentPriceEl.innerText = formatMoney(currentClose, meta.currency);
    
    // Visual flash animation on price tick change
    if (!isNaN(oldPrice) && oldPrice !== currentClose) {
        currentPriceEl.className = 'ribbon-value font-mono ' + (currentClose > oldPrice ? 'tick-up' : 'tick-down');
        setTimeout(() => {
            currentPriceEl.className = 'ribbon-value font-mono';
        }, 800);
    }
    
    // Change Percentage layout
    const changeEl = document.getElementById('current-change');
    let displayChangePct = changePct;
    if (meta.regularMarketChangePercent !== undefined) {
        displayChangePct = meta.regularMarketChangePercent;
    }
    changeEl.innerText = `${displayChangePct >= 0 ? '+' : ''}${displayChangePct.toFixed(2)}%`;
    changeEl.className = `ribbon-value font-mono ${displayChangePct >= 0 ? 'text-up' : 'text-down'}`;
    
    // Calculate stats for ribbon
    const pricesSlice = dataPoints.slice(-30).map(d => d.close);
    const priceHigh = meta.runtimeHigh || Math.max(...pricesSlice);
    const priceLow = meta.runtimeLow || Math.min(...pricesSlice);
    document.getElementById('price-high').innerText = formatMoney(priceHigh, meta.currency);
    document.getElementById('price-low').innerText = formatMoney(priceLow, meta.currency);
    document.getElementById('current-volume').innerText = dataPoints[dataPoints.length - 1].volume.toLocaleString();
    
    // Dividend display for SCHD / JEPQ
    const divInfoItem = document.getElementById('div-info-item');
    if (meta.isDividendETF) {
        divInfoItem.classList.remove('hidden');
        document.getElementById('div-yield').innerText = meta.dividendYield;
    } else {
        divInfoItem.classList.add('hidden');
    }
    
    // Render mini stats in sidebar
    Object.keys(tickerMetadata).forEach(t => {
        const miniData = historicalData[t];
        if (!miniData || miniData.length < 2) return;
        const miniClose = miniData[miniData.length - 1].close;
        const miniPrev = miniData[miniData.length - 2].close;
        const tMeta = tickerMetadata[t];
        const miniChangePct = tMeta.regularMarketChangePercent !== undefined 
            ? tMeta.regularMarketChangePercent 
            : ((miniClose - miniPrev) / miniPrev) * 100;
        
        document.getElementById(`mini-price-${t}`).innerText = formatMoney(miniClose, tickerMetadata[t].currency);
        
        const miniChangeEl = document.getElementById(`mini-change-${t}`);
        miniChangeEl.innerText = `${miniChangePct >= 0 ? '+' : ''}${miniChangePct.toFixed(2)}%`;
        miniChangeEl.className = `ticker-change-mini ${miniChangePct >= 0 ? 'text-up' : 'text-down'}`;
    });  
    // Analyze indicators
    const analysis = analyzeTechnicals(currentTicker);
    const buyProb = calculateBuyProbability(currentTicker, analysis);
    
    // Render Technical Indicator Signal Panels
    updateIndicatorPanel('ma', analysis.ma);
    updateIndicatorPanel('rsi', analysis.rsi);
    updateIndicatorPanel('macd', analysis.macd);
    updateIndicatorPanel('vol', analysis.vol);
    
    // Render Buy Probability gauge
    const ring = document.getElementById('buy-probability-ring');
    const percentEl = document.getElementById('buy-prob-percent');
    const verdictEl = document.getElementById('buy-prob-verdict');
    const reasoningEl = document.getElementById('buy-prob-reasoning');
    
    percentEl.innerText = `${buyProb}%`;
    
    // SVG radial dashoffset mapping: 0% -> 314.16, 100% -> 0
    const offset = 314.16 - (314.16 * buyProb) / 100;
    ring.style.strokeDashoffset = offset;
    
    // Change Ring color depending on recommendation score
    if (buyProb >= 75) {
        ring.style.stroke = 'var(--color-up)';
        verdictEl.innerText = '적극 매수 (Strong Buy)';
        verdictEl.className = 'action-label text-up';
        reasoningEl.innerText = `주요 이동평균선이 정배열 상태이며, 지표 조합 결과 ${buyProb}% 신뢰도로 강력한 상승 추세에 올라탔습니다. 분할 추가 매수가 추천됩니다.`;
    } else if (buyProb >= 55) {
        ring.style.stroke = 'var(--color-gold)';
        verdictEl.innerText = '비중 확대 (Buy / Acc)';
        verdictEl.className = 'action-label text-gold';
        reasoningEl.innerText = `기술적 정렬과 보조지표가 적합한 매수 국면을 지시하고 있습니다. 점진적 적립식 매수 진입이 유효합니다.`;
    } else if (buyProb >= 40) {
        ring.style.stroke = '#94a3b8';
        verdictEl.innerText = '관망 (Neutral / Hold)';
        verdictEl.className = 'action-label';
        reasoningEl.innerText = `지표들이 단기 보합 국면을 가리키고 있습니다. 뚜렷한 돌파 흐름이 나오기 전까지 비중 유지 및 대기가 유리합니다.`;
    } else {
        ring.style.stroke = 'var(--color-down)';
        verdictEl.innerText = '매수 보류 (Sell / Hold)';
        verdictEl.className = 'action-label text-down';
        reasoningEl.innerText = `단기 과열 또는 추세 하락 전환 신호가 우세합니다. 매수를 보류하고 하단 지지선 형성 여부를 확인하는 것이 적절합니다.`;
    }
    
    // Weights Total Verification
    const sumWeights = weights.ma + weights.tech + weights.news + weights.fg;
    const totalWeightsEl = document.getElementById('weights-total');
    totalWeightsEl.innerText = `${sumWeights}%`;
    if (sumWeights === 100) {
        totalWeightsEl.className = 'weights-total-value text-green';
    } else {
        totalWeightsEl.className = 'weights-total-value text-red';
    }
    
    // Update News Sentiment Summary Icon & Label
    const totalNewsSentiment = newsSeed[currentTicker].reduce((a, b) => a + b.sentiment, 0);
    const overallSentimentEl = document.getElementById('overall-news-sentiment');
    if (totalNewsSentiment > 0) {
        overallSentimentEl.innerHTML = '<i class="fa-solid fa-face-smile"></i> 긍정적';
        overallSentimentEl.className = 'sentiment-indicator';
        overallSentimentEl.style.background = 'var(--color-up-bg)';
        overallSentimentEl.style.color = 'var(--color-up)';
    } else if (totalNewsSentiment === 0) {
        overallSentimentEl.innerHTML = '<i class="fa-solid fa-face-meh"></i> 중립';
        overallSentimentEl.className = 'sentiment-indicator';
        overallSentimentEl.style.background = 'hsla(224, 40%, 20%, 0.8)';
        overallSentimentEl.style.color = 'var(--text-muted)';
    } else {
        overallSentimentEl.innerHTML = '<i class="fa-solid fa-face-frown"></i> 부정적';
        overallSentimentEl.className = 'sentiment-indicator';
        overallSentimentEl.style.background = 'var(--color-down-bg)';
        overallSentimentEl.style.color = 'var(--color-down)';
    }
    
    // Render dynamic news list for selected asset
    const newsFeedContainer = document.getElementById('news-feed-container');
    newsFeedContainer.innerHTML = '';
    newsSeed[currentTicker].forEach(news => {
        let sentClass = 'neu';
        let sentText = '중립';
        if (news.sentiment === 1) { sentClass = 'pos'; sentText = '긍정'; }
        if (news.sentiment === -1) { sentClass = 'neg'; sentText = '부정'; }
        
        const newsItem = document.createElement('div');
        newsItem.className = `news-item ${sentClass}`;
        newsItem.innerHTML = `
            <div class="news-title">${news.title}</div>
            <div class="news-meta">
                <span class="news-source">${news.source} • ${news.time}</span>
                <span class="news-sentiment-tag ${sentClass}">${sentText}</span>
            </div>
        `;
        newsFeedContainer.appendChild(newsItem);
    });
    
    // Render Portfolio stats
    updatePortfolioUI();
    
    // Render Agent Volume Breakdown
    updateAgentVolumeBreakdown(currentTicker);
    
    // Redraw Stock Chart
    updateStockChart(currentTicker, chartTimeframeDays);
}

function updateIndicatorPanel(id, metric) {
    const parent = document.getElementById(`ind-${id}`);
    const badge = document.getElementById(`badge-${id}`);
    const bar = document.getElementById(`bar-${id}`);
    
    badge.innerText = metric.verdict;
    
    // styling depending on verdict
    let styleClass = 'neutral';
    if (metric.verdict.includes('BULLISH') || metric.verdict.includes('GOLDEN') || metric.verdict.includes('RISING') || metric.verdict.includes('ACCELERATING') || metric.verdict.includes('OVERSOLD') || metric.verdict.includes('UNDERVALUED')) {
        styleClass = 'bullish';
    } else if (metric.verdict.includes('BEARISH') || metric.verdict.includes('DEAD') || metric.verdict.includes('OVERBOUGHT')) {
        styleClass = 'bearish';
    }
    
    badge.className = `ind-badge ${styleClass}`;
    
    // set inner progress indicator bar width
    bar.style.width = `${metric.score}%`;
    bar.className = `ind-bar-fill ${styleClass}`;
}

// Global Fear & Greed Index update UI
function updateFearGreedUI() {
    document.getElementById('fg-index-value').innerText = marketFearGreed;
    const bar = document.getElementById('fg-gauge-bar');
    const marker = document.getElementById('fg-gauge-marker');
    const statusText = document.getElementById('fg-index-status');
    
    bar.style.width = `${marketFearGreed}%`;
    marker.style.left = `${marketFearGreed}%`;
    
    if (marketFearGreed < 25) {
        statusText.innerText = '극도 공포 (Extreme Fear)';
        statusText.className = 'fg-status extreme-fear';
    } else if (marketFearGreed < 45) {
        statusText.innerText = '공포 (Fear)';
        statusText.className = 'fg-status fear';
    } else if (marketFearGreed < 55) {
        statusText.innerText = '중립 (Neutral)';
        statusText.className = 'fg-status neutral';
    } else if (marketFearGreed < 75) {
        statusText.innerText = '탐욕 (Greed)';
        statusText.className = 'fg-status greed';
    } else {
        statusText.innerText = '극도 탐욕 (Extreme Greed)';
        statusText.className = 'fg-status extreme-greed';
    }
}

// Portfolio Simulation Logic
function updatePortfolioUI() {
    document.getElementById('portfolio-cash').innerText = `$${portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    let holdingsValue = 0;
    const holdingsListContainer = document.getElementById('portfolio-holdings-list');
    holdingsListContainer.innerHTML = '';
    
    Object.keys(portfolio.holdings).forEach(ticker => {
        const shares = portfolio.holdings[ticker];
        if (shares > 0) {
            const currentClose = historicalData[ticker][historicalData[ticker].length - 1].close;
            const value = shares * currentClose;
            const meta = tickerMetadata[ticker];
            let valueInUSD = value;
            if (meta.currency === 'KRW') {
                valueInUSD = value / USDKRW;
            }
            holdingsValue += valueInUSD;
            
            const row = document.createElement('div');
            row.className = 'holding-item';
            row.innerHTML = `
                <div class="holding-left">
                    <span class="holding-symbol text-white">${ticker}</span>
                    <span class="holding-shares">${shares}주</span>
                </div>
                <span class="holding-value text-white">${formatMoney(value, meta.currency)}</span>
            `;
            holdingsListContainer.appendChild(row);
        }
    });
    
    if (holdingsValue === 0) {
        holdingsListContainer.innerHTML = '<span class="stat-label text-dark" style="font-size: 11px; text-align: center; display: block; width: 100%;">보유 자산 없음</span>';
    }
    
    const totalValue = portfolio.cash + holdingsValue;
    document.getElementById('portfolio-holding-val').innerText = `$${holdingsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('portfolio-total').innerText = `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Show Toast Notifications
function showToast(message) {
    const toast = document.getElementById('toast-notification');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// State container for agent net volumes (Individual, Institutional, Foreign)
const agentFlowData = {};

function initAgentFlowData() {
    Object.keys(tickerMetadata).forEach(ticker => {
        const meta = tickerMetadata[ticker];
        // Generate baseline net volume values:
        // Domestic: in units of 100M KRW (0.1 Billion Won)
        // Overseas: in units of 100K USD (0.1 Million USD)
        const baseValue = meta.currency === 'KRW' ? 150.0 : 12.0;
        
        agentFlowData[ticker] = {
            individual: (Math.random() - 0.52) * 2 * baseValue, // slight negative bias for retail
            institutional: (Math.random() - 0.45) * 2 * baseValue, // positive inst bias
            foreign: (Math.random() - 0.42) * 2.5 * baseValue // positive foreign bias
        };
    });
}

function updateAgentVolumeBreakdown(ticker) {
    const meta = tickerMetadata[ticker];
    const flow = agentFlowData[ticker];
    if (!flow) return;
    
    const isKRW = meta.currency === 'KRW';
    
    function formatNetFlow(val) {
        const sign = val >= 0 ? '+' : '';
        if (isKRW) {
            return `${sign}${val.toFixed(1)} 십억원`;
        } else {
            return `${sign}${val.toFixed(1)} 백만달러`;
        }
    }
    
    const indNameEl = document.querySelector('.agent-row:nth-child(1) .agent-name');
    const instNameEl = document.querySelector('.agent-row:nth-child(2) .agent-name');
    const forNameEl = document.querySelector('.agent-row:nth-child(3) .agent-name');
    
    if (isKRW) {
        indNameEl.innerHTML = '<i class="fa-solid fa-user"></i> 개인 투자자';
        instNameEl.innerHTML = '<i class="fa-solid fa-building-columns"></i> 기관 투자자';
        forNameEl.innerHTML = '<i class="fa-solid fa-earth-americas"></i> 외국인 투자자';
    } else {
        indNameEl.innerHTML = '<i class="fa-solid fa-user"></i> 개인 (Retail)';
        instNameEl.innerHTML = '<i class="fa-solid fa-building-columns"></i> 기관 (Institutions)';
        forNameEl.innerHTML = '<i class="fa-solid fa-briefcase"></i> 내부자 (Insiders)';
    }
    
    const agents = ['individual', 'institutional', 'foreign'];
    agents.forEach((agent) => {
        const val = flow[agent];
        const valEl = document.getElementById(`agent-val-${agent}`);
        const verdictEl = document.getElementById(`agent-verdict-${agent}`);
        const barFillEl = document.getElementById(`agent-bar-${agent}`);
        
        if (!valEl || !verdictEl || !barFillEl) return;
        
        valEl.innerText = formatNetFlow(val);
        valEl.className = `agent-val font-mono ${val >= 0 ? 'text-up' : 'text-down'}`;
        
        verdictEl.innerText = val >= 0 ? '순매수' : '순매도';
        verdictEl.className = `agent-verdict ${val >= 0 ? 'buy' : 'sell'}`;
        
        const maxLimit = isKRW ? 450.0 : 36.0;
        const ratio = Math.min(Math.max(val / maxLimit, -1), 1);
        const widthPct = Math.abs(ratio) * 50;
        
        barFillEl.style.width = `${widthPct}%`;
        if (val >= 0) {
            barFillEl.className = 'agent-bar-fill buy';
            barFillEl.style.left = '50%';
            barFillEl.style.right = 'auto';
        } else {
            barFillEl.className = 'agent-bar-fill sell';
            barFillEl.style.right = '50%';
            barFillEl.style.left = 'auto';
        }
    });
}

async function fetchRealTimeQuotes() {
    try {
        const symbolsList = Object.keys(tickerMetadata).map(key => {
            const meta = tickerMetadata[key];
            return meta.currency === 'KRW' ? `${meta.symbol}.KS` : meta.symbol;
        }).join(',');
        
        const response = await fetch(`${API_BASE}/api/quote?symbols=${encodeURIComponent(symbolsList)}`);
        if (response.ok) {
            const json = await response.json();
            const quotes = json.quoteResponse.result;
            
            quotes.forEach(quote => {
                const yahooSymbol = quote.symbol;
                let ticker = null;
                
                Object.keys(tickerMetadata).forEach(k => {
                    const meta = tickerMetadata[k];
                    const metaYahoo = meta.currency === 'KRW' ? `${meta.symbol}.KS` : meta.symbol;
                    if (metaYahoo === yahooSymbol) {
                        ticker = k;
                    }
                });
                
                if (ticker) {
                    const meta = tickerMetadata[ticker];
                    const data = historicalData[ticker];
                    if (!data || data.length === 0) return;
                    
                    const currentIdx = data.length - 1;
                    const newPrice = meta.currency === 'KRW' ? Math.round(quote.regularMarketPrice) : quote.regularMarketPrice;
                    const high = meta.currency === 'KRW' ? Math.round(quote.regularMarketDayHigh || newPrice) : (quote.regularMarketDayHigh || newPrice);
                    const low = meta.currency === 'KRW' ? Math.round(quote.regularMarketDayLow || newPrice) : (quote.regularMarketDayLow || newPrice);
                    const volume = quote.regularMarketVolume || data[currentIdx].volume;
                    
                    // Update current point data
                    data[currentIdx].close = newPrice;
                    data[currentIdx].volume = volume;
                    meta.basePrice = newPrice;
                    meta.runtimeHigh = high;
                    meta.runtimeLow = low;
                    meta.regularMarketChangePercent = quote.regularMarketChangePercent;
                }
            });
            console.log('[AlphaRadar] Successfully pulled actual quotes from local proxy server');
            return true;
        }
    } catch (e) {
        console.warn('[AlphaRadar] Proxy quotes fetch failed, running local simulator:', e.message);
    }
    return false;
}

// ==========================================
// 6. INITIALIZATION & EVENT BINDINGS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Load custom tickers from localStorage first
    initCustomTickers();
    
    // Generate base mock stock records
    initHistoricalData();
    // Generate initial agent flow data
    initAgentFlowData();
    
    // Bind ticker navigation clicks
    document.querySelectorAll('.nav-tab').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            currentTicker = btn.getAttribute('data-ticker');
            updateDashboardUI();
        });
    });
    
    // Bind chart timeframe filters
    document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            chartTimeframeDays = parseInt(e.target.getAttribute('data-days'));
            updateStockChart(currentTicker, chartTimeframeDays);
        });
    });
    
    // Bind Custom algorithmic slider weight changes
    const mapSlider = (id, key) => {
        const slider = document.getElementById(`slider-${id}`);
        const display = document.getElementById(`val-${id}`);
        
        slider.addEventListener('input', (e) => {
            weights[key] = parseInt(e.target.value);
            display.innerText = `${weights[key]}%`;
            updateDashboardUI();
        });
    };
    mapSlider('w-ma', 'ma');
    mapSlider('w-tech', 'tech');
    mapSlider('w-news', 'news');
    mapSlider('w-fg', 'fg');
    
    // Weights Reset button
    document.getElementById('reset-weights').addEventListener('click', () => {
        weights = { ma: 40, tech: 25, news: 20, fg: 15 };
        document.getElementById('slider-w-ma').value = 40;
        document.getElementById('val-w-ma').innerText = '40%';
        document.getElementById('slider-w-tech').value = 25;
        document.getElementById('val-w-tech').innerText = '25%';
        document.getElementById('slider-w-news').value = 20;
        document.getElementById('val-w-news').innerText = '20%';
        document.getElementById('slider-w-fg').value = 15;
        document.getElementById('val-w-fg').innerText = '15%';
        updateDashboardUI();
    });
    
    // Fear & Greed Index Details Modal
    const modal = document.getElementById('fg-modal');
    document.getElementById('fear-greed-gauge-trigger').addEventListener('click', () => {
        modal.classList.add('show');
    });
    document.getElementById('close-fg-modal').addEventListener('click', () => {
        modal.classList.remove('show');
    });
    // Close modal if user clicks outside of box
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    // Portfolio buying / selling buttons
    const qtyInput = document.getElementById('trade-qty');
    document.getElementById('qty-minus').addEventListener('click', () => {
        const val = Math.max(1, parseInt(qtyInput.value) - 10);
        qtyInput.value = val;
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
        const val = parseInt(qtyInput.value) + 10;
        qtyInput.value = val;
    });
    
    // Execute simulated Buy trade
    document.getElementById('action-buy').addEventListener('click', () => {
        const qty = parseInt(qtyInput.value);
        if (isNaN(qty) || qty <= 0) return;
        
        const currentClose = historicalData[currentTicker][historicalData[currentTicker].length - 1].close;
        const meta = tickerMetadata[currentTicker];
        let totalCostNative = qty * currentClose;
        let totalCostUSD = totalCostNative;
        if (meta.currency === 'KRW') {
            totalCostUSD = totalCostNative / USDKRW;
        }
        
        if (portfolio.cash >= totalCostUSD) {
            portfolio.cash -= totalCostUSD;
            portfolio.holdings[currentTicker] += qty;
            updatePortfolioUI();
            showToast(`${currentTicker} ${qty}주 매수 완료 (${formatMoney(totalCostNative, meta.currency)})`);
        } else {
            showToast(`실패: 매수 잔액이 부족합니다.`);
        }
    });
    
    // Execute simulated Sell trade
    document.getElementById('action-sell').addEventListener('click', () => {
        const qty = parseInt(qtyInput.value);
        if (isNaN(qty) || qty <= 0) return;
        
        const holdingsShares = portfolio.holdings[currentTicker];
        if (holdingsShares >= qty) {
            const currentClose = historicalData[currentTicker][historicalData[currentTicker].length - 1].close;
            const meta = tickerMetadata[currentTicker];
            let totalRevenueNative = qty * currentClose;
            let totalRevenueUSD = totalRevenueNative;
            if (meta.currency === 'KRW') {
                totalRevenueUSD = totalRevenueNative / USDKRW;
            }
            
            portfolio.cash += totalRevenueUSD;
            portfolio.holdings[currentTicker] -= qty;
            updatePortfolioUI();
            showToast(`${currentTicker} ${qty}주 매도 완료 (${formatMoney(totalRevenueNative, meta.currency)})`);
        } else {
            showToast(`실패: 매도하려는 주식 보유량이 부족합니다.`);
        }
    });
    
    // Portfolio Reset
    document.getElementById('reset-portfolio').addEventListener('click', () => {
        portfolio = {
            cash: 100000.00,
            holdings: { QQQ: 0, SPY: 0, SCHD: 0, JEPQ: 0, HYNIX: 0, HYUNDAI: 0, SKT: 0, HANA: 0, GOOGL: 0, AMZN: 0 }
        };
        updatePortfolioUI();
        showToast('모의 포트폴리오가 초기화되었습니다.');
    });
    
    // Local popular Korean stocks dictionary for quick lookup and fallback (bypasses Yahoo Finance CJK 400 Bad Request error)
    const KOREAN_STOCK_DICTIONARY = [
        { symbol: '005930.KS', name: '삼성전자', shortname: 'SamsungElec', longname: 'Samsung Electronics', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '000660.KS', name: 'SK하이닉스', shortname: 'SK Hynix', longname: 'SK Hynix Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '373220.KS', name: 'LG에너지솔루션', shortname: 'LG Energy Sol', longname: 'LG Energy Solution', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '207940.KS', name: '삼성바이오로직스', shortname: 'Samsung Bio', longname: 'Samsung Biologics', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '005380.KS', name: '현대자동차', shortname: 'Hyundai Motor', longname: 'Hyundai Motor Company', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '000270.KS', name: '기아', shortname: 'Kia', longname: 'Kia Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '068270.KS', name: '셀트리온', shortname: 'Celltrion', longname: 'Celltrion Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '005490.KS', name: 'POSCO홀딩스', shortname: 'POSCO Holdings', longname: 'POSCO Holdings Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '035420.KS', name: 'NAVER', shortname: 'NAVER', longname: 'NAVER Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '035720.KS', name: '카카오', shortname: 'Kakao', longname: 'Kakao Corp.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '006400.KS', name: '삼성SDI', shortname: 'Samsung SDI', longname: 'Samsung SDI Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '051910.KS', name: 'LG화학', shortname: 'LG Chem', longname: 'LG Chem, Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '105560.KS', name: 'KB금융', shortname: 'KB Financial', longname: 'KB Financial Group Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '055550.KS', name: '신한지주', shortname: 'Shinhan Fin', longname: 'Shinhan Financial Group Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '012330.KS', name: '현대모비스', shortname: 'Hyundai Mobis', longname: 'Hyundai Mobis Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '028260.KS', name: '삼성물산', shortname: 'Samsung C&T', longname: 'Samsung C&T Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '032830.KS', name: '삼성생명', shortname: 'Samsung Life', longname: 'Samsung Life Insurance Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '096770.KS', name: 'SK이노베이션', shortname: 'SK Innovation', longname: 'SK Innovation Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '066570.KS', name: 'LG전자', shortname: 'LG Electronics', longname: 'LG Electronics Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '015760.KS', name: '한국전력', shortname: 'KEPCO', longname: 'Korea Electric Power Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '086790.KS', name: '하나금융지주', shortname: 'Hana Financial', longname: 'Hana Financial Group Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '323410.KS', name: '카카오뱅크', shortname: 'Kakao Bank', longname: 'Kakao Bank Corp.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '352820.KS', name: '하이브', shortname: 'HYBE', longname: 'HYBE Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '011200.KS', name: 'HMM', shortname: 'HMM', longname: 'HMM Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '034020.KS', name: '두산에너빌리티', shortname: 'Doosan Enerbility', longname: 'Doosan Enerbility Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '000810.KS', name: '삼성화재', shortname: 'Samsung F&M', longname: 'Samsung Fire & Marine Insurance Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '010950.KS', name: 'S-Oil', shortname: 'S-Oil', longname: 'S-Oil Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '090430.KS', name: '아모레퍼시픽', shortname: 'Amorepacific', longname: 'Amorepacific Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '003490.KS', name: '대한항공', shortname: 'Korean Air', longname: 'Korean Air Lines Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '316140.KS', name: '우리금융지주', shortname: 'Woori Financial', longname: 'Woori Financial Group Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '033780.KS', name: 'KT&G', shortname: 'KT&G', longname: 'KT&G Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '030200.KS', name: 'KT', shortname: 'KT', longname: 'KT Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '034730.KS', name: 'SK', shortname: 'SK Corp', longname: 'SK Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '010140.KS', name: '삼성중공업', shortname: 'Samsung Heavy', longname: 'Samsung Heavy Industries Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '042700.KS', name: '한미반도체', shortname: 'Hanmi Semi', longname: 'Hanmi Semiconductor Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '196170.KQ', name: '알테오젠', shortname: 'Alteogen', longname: 'Alteogen Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '028300.KQ', name: 'HLB', shortname: 'HLB', longname: 'HLB Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '247540.KQ', name: '에코프로비엠', shortname: 'EcoPro BM', longname: 'EcoPro BM Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '086520.KQ', name: '에코프로', shortname: 'EcoPro', longname: 'EcoPro Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '035900.KQ', name: 'JYP Ent.', shortname: 'JYP Ent', longname: 'JYP Entertainment Corporation', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '041510.KQ', name: '에스엠', shortname: 'SM Ent', longname: 'SM Entertainment Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '122870.KQ', name: '와이지엔터테인먼트', shortname: 'YG Ent', longname: 'YG Entertainment Inc.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '012450.KS', name: '한화에어로스페이스', shortname: 'Hanwa Aerospace', longname: 'Hanwha Aerospace Co., Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '047810.KS', name: '한국항공우주', shortname: 'KAI', longname: 'Korea Aerospace Industries, Ltd.', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '064350.KS', name: '현대로템', shortname: 'Hyundai Rotem', longname: 'Hyundai Rotem Company', quoteType: 'EQUITY', exchange: 'KSC' },
        { symbol: '069500.KS', name: 'KODEX 200', shortname: 'KODEX 200', longname: 'Samsung KODEX 200 ETF', quoteType: 'ETF', exchange: 'KSC' },
        { symbol: '371460.KS', name: 'TIGER 차이나전기차', shortname: 'TIGER China EV', longname: 'Mirae Asset TIGER China Electric Vehicle ETF', quoteType: 'ETF', exchange: 'KSC' }
    ];

    // Ticker Search & Additions Event Handlers
    const searchInput = document.getElementById('ticker-search-input');
    const searchResults = document.getElementById('ticker-search-results');
    const searchClearBtn = document.getElementById('search-clear-btn');
    let searchDebounceTimeout = null;
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (query.length > 0) {
            searchClearBtn.classList.remove('hidden');
        } else {
            searchClearBtn.classList.add('hidden');
            searchResults.classList.add('hidden');
            searchResults.innerHTML = '';
            return;
        }
        
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(async () => {
            // 1. Check local dictionary matches (case-insensitive)
            const localMatches = [];
            const lowerQuery = query.toLowerCase();
            const addedSymbols = new Set();
            
            KOREAN_STOCK_DICTIONARY.forEach(item => {
                if (addedSymbols.has(item.symbol)) return;
                
                if (item.name.toLowerCase().includes(lowerQuery) || 
                    item.symbol.toLowerCase().includes(lowerQuery) ||
                    item.shortname.toLowerCase().includes(lowerQuery) ||
                    item.longname.toLowerCase().includes(lowerQuery)) {
                    
                    localMatches.push({
                        symbol: item.symbol,
                        shortname: item.name, // Show Korean name
                        longname: item.longname,
                        exchange: item.exchange,
                        quoteType: item.quoteType
                    });
                    addedSymbols.add(item.symbol);
                }
            });

            try {
                const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
                if (response.ok) {
                    const json = await response.json();
                    const quotes = json.quotes || [];
                    
                    // Merge local matches and backend quotes, avoiding duplicates
                    const merged = [...localMatches];
                    quotes.forEach(q => {
                        if (!addedSymbols.has(q.symbol)) {
                            merged.push(q);
                            addedSymbols.add(q.symbol);
                        }
                    });
                    
                    renderSearchResults(merged);
                } else {
                    // Fallback to local matches if server returns error (e.g. CJK 400 Bad Request)
                    renderSearchResults(localMatches);
                }
            } catch (err) {
                console.error('[AlphaRadar] Search fetch failed:', err.message);
                // Fallback to local matches
                renderSearchResults(localMatches);
            }
        }, 300);
    });
    
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.classList.add('hidden');
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
        searchInput.focus();
    });
    
    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
    
    function renderSearchResults(quotes) {
        searchResults.innerHTML = '';
        if (quotes.length === 0) {
            searchResults.innerHTML = `
                <div style="padding: 12px; font-size: 11px; color: var(--text-dark); text-align: center;">
                    검색 결과가 없습니다.
                </div>
                <div style="padding: 10px 12px; font-size: 10.5px; color: var(--color-primary); text-align: center; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.15); line-height: 1.4;">
                    한글 사명 검색 대신 <strong>영어 사명(예: Samsung, Hyundai)</strong> 이나 <strong>숫자 코드(예: 005930)</strong>로 검색해 보세요!
                </div>
            `;
            searchResults.classList.remove('hidden');
            return;
        }
        
        quotes.forEach(quote => {
            const symbol = quote.symbol;
            if (quote.quoteType === 'INDEX') return; // Skip indices
            
            const name = quote.shortname || quote.longname || symbol;
            const exchange = quote.exchange || quote.exchDisp || 'Global';
            const type = quote.quoteType || 'Equity';
            
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="search-result-info">
                    <span class="search-result-sym">${symbol}</span>
                    <span class="search-result-name" title="${name}">${name}</span>
                </div>
                <div class="search-result-meta">
                    <span class="search-result-badge exchange">${exchange}</span>
                    <span class="search-result-badge type">${type.toLowerCase()}</span>
                </div>
            `;
            
            item.addEventListener('click', () => {
                addTickerFromSearch(symbol, quote);
                searchResults.classList.add('hidden');
                searchInput.value = '';
                searchClearBtn.classList.add('hidden');
            });
            
            searchResults.appendChild(item);
        });
        
        // Add helpful search tip footer
        const tip = document.createElement('div');
        tip.style = 'padding: 10px 12px; font-size: 10.5px; color: var(--text-muted); text-align: center; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.15); line-height: 1.4;';
        tip.innerHTML = `찾는 종목이 없으면 <strong>영어 이름</strong>이나 <strong>숫자 코드</strong>로 검색해 보세요.`;
        searchResults.appendChild(tip);

        searchResults.classList.remove('hidden');
    }
    
    async function addTickerFromSearch(symbol, searchInfo) {
        if (tickerMetadata[symbol]) {
            currentTicker = symbol;
            document.querySelectorAll('.nav-tab').forEach(btn => {
                if (btn.getAttribute('data-ticker') === currentTicker) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            updateDashboardUI();
            showToast(`${symbol} 종목으로 전환합니다.`);
            return;
        }
        
        showToast(`${symbol} 데이터를 불러오는 중...`);
        
        try {
            const response = await fetch(`${API_BASE}/api/chart?symbol=${encodeURIComponent(symbol)}`);
            if (!response.ok) {
                throw new Error('Chart API returned not ok');
            }
            
            const json = await response.json();
            const chartResult = json.chart?.result?.[0];
            if (!chartResult) {
                throw new Error('Invalid chart response format');
            }
            
            const timestamps = chartResult.timestamp;
            const closes = chartResult.indicators.quote[0].close;
            const volumes = chartResult.indicators.quote[0].volume;
            
            if (!timestamps || !closes || closes.length === 0) {
                throw new Error('No historical price points available');
            }
            
            const dataPoints = [];
            const isKRW = chartResult.meta.currency === 'KRW' || symbol.endsWith('.KS') || symbol.endsWith('.KQ');
            
            for (let i = 0; i < timestamps.length; i++) {
                if (closes[i] === null || closes[i] === undefined) continue;
                
                const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                const closeVal = isKRW ? Math.round(closes[i]) : parseFloat(closes[i].toFixed(2));
                const volVal = (volumes && volumes[i]) || 0;
                
                dataPoints.push({
                    date: date,
                    close: closeVal,
                    volume: volVal
                });
            }
            
            if (dataPoints.length === 0) {
                throw new Error('No valid historical data points found');
            }
            
            historicalData[symbol] = dataPoints;
            
            const meta = {
                symbol: symbol,
                name: chartResult.meta.shortName || searchInfo.shortname || symbol,
                fullName: chartResult.meta.longName ? `${chartResult.meta.longName} (${symbol})` : (searchInfo.longname ? `${searchInfo.longname} (${symbol})` : `${symbol}`),
                dividendYield: '0.00%',
                isDividendETF: false,
                basePrice: dataPoints[dataPoints.length - 1].close,
                volatility: 0.015,
                currency: chartResult.meta.currency || (isKRW ? 'KRW' : 'USD')
            };
            
            tickerMetadata[symbol] = meta;
            portfolio.holdings[symbol] = 0;
            
            // Generate news seed
            newsSeed[symbol] = [
                { title: `${meta.name} 실시간 거래량 급증 분석 보고서 공개`, source: "Reuters", time: "10분 전", sentiment: 1 },
                { title: `${meta.name} 기관 순매수 거래 대금 유입세 포착`, source: "Bloomberg", time: "1시간 전", sentiment: 1 },
                { title: `${meta.name} 단기 돌파 매물대 진입... 변동성 유의`, source: "CNBC", time: "3시간 전", sentiment: 0 },
                { title: `${meta.name} 거시경제 영향에 따른 섹터별 포지션 리밸런싱 우려`, source: "WSJ", time: "6시간 전", sentiment: -1 },
                { title: `${meta.name} 2분기 경영 실적 관망에 따른 기관 숨고르기`, source: "MarketWatch", time: "1일 전", sentiment: 0 }
            ];
            
            // Initialize agent flow
            const baseValue = meta.currency === 'KRW' ? 150.0 : 12.0;
            agentFlowData[symbol] = {
                individual: (Math.random() - 0.52) * 2 * baseValue,
                institutional: (Math.random() - 0.45) * 2 * baseValue,
                foreign: (Math.random() - 0.42) * 2.5 * baseValue
            };
            
            // Inject to navigation UI sidebar
            injectTickerTab(symbol, meta);
            
            // Persist to storage
            saveCustomTickerToStorage(meta);
            
            // Switch active view
            currentTicker = symbol;
            document.querySelectorAll('.nav-tab').forEach(btn => {
                if (btn.getAttribute('data-ticker') === currentTicker) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            updateDashboardUI();
            showToast(`${meta.name} 종목이 추가되었습니다!`);
            
        } catch (err) {
            console.error('[AlphaRadar] Failed to add ticker:', err.message);
            showToast(`실패: ${symbol} 데이터를 읽어올 수 없습니다.`);
        }
    }
    
    function saveCustomTickerToStorage(meta) {
        let saved = localStorage.getItem('alpharadar_custom_tickers');
        let customList = [];
        if (saved) {
            try {
                customList = JSON.parse(saved);
            } catch (e) {}
        }
        
        if (!customList.some(item => item.symbol === meta.symbol)) {
            customList.push(meta);
            localStorage.setItem('alpharadar_custom_tickers', JSON.stringify(customList));
        }
    }
    
    // AI Algorithm Weight Optimization & Backtester Logic
    const btnRunOptimizer = document.getElementById('btn-run-optimizer');
    
    btnRunOptimizer.addEventListener('click', () => {
        runAlgorithmOptimization();
    });
    
    async function runAlgorithmOptimization() {
        const data = historicalData[currentTicker];
        if (!data || data.length < 40) {
            showToast('실패: 최적화를 실행하기 위해 최소 40영업일 이상의 데이터가 필요합니다.');
            return;
        }
        
        const btn = document.getElementById('btn-run-optimizer');
        btn.classList.add('loading');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 분석 중...';
        showToast(`${tickerMetadata[currentTicker].name}에 대한 AI 백테스트 및 최적화 실행 중...`);
        
        // Wait 500ms to allow UI render of loading spinner
        setTimeout(() => {
            try {
                const totalPoints = data.length;
                const evalPoints = [];
                const step = 20; // 20 trading days ~ 1 month
                const warmUpPeriod = totalPoints > 220 ? 200 : 30;
                const startIdx = Math.max(warmUpPeriod, totalPoints - 250);
                const endIdx = totalPoints - 21; // Save 20 days for subsequent return calculation
                
                for (let i = startIdx; i <= endIdx; i += step) {
                    const return1m = (data[i + 20].close - data[i].close) / data[i].close;
                    
                    // Precompute technical indicators scores at index i
                    const analysis = analyzeTechnicals(currentTicker, i);
                    
                    const scoreMA = analysis.ma.score;
                    const scoreTech = (analysis.rsi.score + analysis.vol.score) / 2;
                    const scoreNews = analysis.newsScore;
                    const scoreFG = analysis.fgScore;
                    
                    // Ideal score calculation (R_i return percentage)
                    const pct = return1m * 100;
                    const ideal = Math.min(Math.max(Math.round(50 + pct * 5.0), 0), 100);
                    
                    evalPoints.push({
                        ma: scoreMA,
                        tech: scoreTech,
                        news: scoreNews,
                        fg: scoreFG,
                        ideal: ideal,
                        pct: pct
                    });
                }
                
                if (evalPoints.length === 0) {
                    throw new Error('평가할 수 있는 백테스트 구간이 부족합니다.');
                }
                
                // 1. Calculate current MAE before optimization
                let currentErrorSum = 0;
                let currentCorrect = 0;
                evalPoints.forEach(pt => {
                    const currentCalculated = (weights.ma * pt.ma + weights.tech * pt.tech + weights.news * pt.news + weights.fg * pt.fg) / 100;
                    currentErrorSum += Math.abs(currentCalculated - pt.ideal);
                    
                    // Hit rate check:
                    const isCalculatedPositive = currentCalculated > 53;
                    const isCalculatedNegative = currentCalculated < 47;
                    const isCalculatedNeutral = !isCalculatedPositive && !isCalculatedNegative;
                    
                    const isReturnPositive = pt.pct > 0.5;
                    const isReturnNegative = pt.pct < -0.5;
                    const isReturnNeutral = pt.pct >= -0.5 && pt.pct <= 0.5;
                    
                    if ((isCalculatedPositive && isReturnPositive) || 
                        (isCalculatedNegative && isReturnNegative) || 
                        (isCalculatedNeutral && isReturnNeutral)) {
                        currentCorrect++;
                    }
                });
                const currentMAE = currentErrorSum / evalPoints.length;
                
                // 2. Perform Grid Search (1,771 iterations)
                let bestMAE = Infinity;
                let bestW = { ma: 40, tech: 25, news: 20, fg: 15 };
                
                for (let w_ma = 0; w_ma <= 100; w_ma += 5) {
                    for (let w_tech = 0; w_tech <= 100 - w_ma; w_tech += 5) {
                        for (let w_news = 0; w_news <= 100 - w_ma - w_tech; w_news += 5) {
                            const w_fg = 100 - w_ma - w_tech - w_news;
                            
                            let errorSum = 0;
                            evalPoints.forEach(pt => {
                                const calculated = (w_ma * pt.ma + w_tech * pt.tech + w_news * pt.news + w_fg * pt.fg) / 100;
                                errorSum += Math.abs(calculated - pt.ideal);
                            });
                            const mae = errorSum / evalPoints.length;
                            
                            if (mae < bestMAE) {
                                bestMAE = mae;
                                bestW = { ma: w_ma, tech: w_tech, news: w_news, fg: w_fg };
                            }
                        }
                    }
                }
                
                // 3. Recalculate hit rate/accuracy with optimized weights
                let optimizedCorrect = 0;
                evalPoints.forEach(pt => {
                    const optCalculated = (bestW.ma * pt.ma + bestW.tech * pt.tech + bestW.news * pt.news + bestW.fg * pt.fg) / 100;
                    const isCalculatedPositive = optCalculated > 53;
                    const isCalculatedNegative = optCalculated < 47;
                    const isCalculatedNeutral = !isCalculatedPositive && !isCalculatedNegative;
                    
                    const isReturnPositive = pt.pct > 0.5;
                    const isReturnNegative = pt.pct < -0.5;
                    const isReturnNeutral = pt.pct >= -0.5 && pt.pct <= 0.5;
                    
                    if ((isCalculatedPositive && isReturnPositive) || 
                        (isCalculatedNegative && isReturnNegative) || 
                        (isCalculatedNeutral && isReturnNeutral)) {
                        optimizedCorrect++;
                    }
                });
                const optimizedAccuracy = (optimizedCorrect / evalPoints.length) * 100;
                
                // 4. Update UI Stats panel
                document.getElementById('opt-val-mae').innerHTML = `${bestMAE.toFixed(1)} <span style="font-size: 10px; color: var(--text-dark);">(이전: ${currentMAE.toFixed(1)})</span>`;
                document.getElementById('opt-val-accuracy').innerText = `${optimizedAccuracy.toFixed(1)}%`;
                document.getElementById('opt-val-proposal').innerText = `이동평균 ${bestW.ma}%, 보조 ${bestW.tech}%, 뉴스 ${bestW.news}%, 공포 ${bestW.fg}%`;
                
                // 5. Apply the optimized weights to global state & sliders
                weights = bestW;
                
                document.getElementById('slider-w-ma').value = bestW.ma;
                document.getElementById('val-w-ma').innerText = `${bestW.ma}%`;
                document.getElementById('slider-w-tech').value = bestW.tech;
                document.getElementById('val-w-tech').innerText = `${bestW.tech}%`;
                document.getElementById('slider-w-news').value = bestW.news;
                document.getElementById('val-w-news').innerText = `${bestW.news}%`;
                document.getElementById('slider-w-fg').value = bestW.fg;
                document.getElementById('val-w-fg').innerText = `${bestW.fg}%`;
                
                // 6. Refresh active dashboard components
                updateDashboardUI();
                
                showToast(`알고리즘 최적화 완료! 오차가 ${currentMAE.toFixed(1)}에서 ${bestMAE.toFixed(1)}로 감소했습니다.`);
                
            } catch (err) {
                console.error('[AlphaRadar] Optimization failed:', err.message);
                showToast(`최적화 오류: ${err.message}`);
            } finally {
                btn.classList.remove('loading');
                btn.innerHTML = '<i class="fa-solid fa-play"></i> 최적화 실행';
            }
        }, 500);
    }

    // Initialize Dashboard UI & Fear & Greed Elements
    updateFearGreedUI();
    updateDashboardUI();
    
    // Real-time market tick-by-tick simulation loop (polls API or fallback ticks every 1 second)
    setInterval(async () => {
        // Attempt to pull real quotes from local proxy server
        const apiSuccess = await fetchRealTimeQuotes();
        
        // If server is offline, fallback to local tick simulation
        if (!apiSuccess) {
            Object.keys(tickerMetadata).forEach(ticker => {
                const meta = tickerMetadata[ticker];
                const data = historicalData[ticker];
                if (!data || data.length === 0) return;
                
                const currentIdx = data.length - 1;
                const oldClose = data[currentIdx].close;
                
                const priceTickPct = (Math.random() - 0.45) * 0.0015;
                const newClose = meta.currency === 'KRW' 
                    ? Math.round(oldClose * (1 + priceTickPct)) 
                    : parseFloat((oldClose * (1 + priceTickPct)).toFixed(2));
                
                data[currentIdx].close = newClose;
                data[currentIdx].volume += Math.floor(Math.random() * 8000) + 1000;
            });
        }

        // Ticking agent net flows in either mode
        Object.keys(tickerMetadata).forEach(ticker => {
            const meta = tickerMetadata[ticker];
            const flow = agentFlowData[ticker];
            if (flow) {
                const tickValue = (meta.currency === 'KRW' ? 12.0 : 1.0) * (Math.random() - 0.5);
                flow.individual += tickValue;
                
                const instTick = (meta.currency === 'KRW' ? 15.0 : 1.2) * (Math.random() - 0.482);
                flow.institutional += instTick;
                flow.foreign -= (tickValue + instTick);
            }
        });
        
        // Tick market Fear & Greed index slightly
        if (Math.random() > 0.8) {
            const fgDiff = Math.random() > 0.5 ? 1 : -1;
            marketFearGreed = Math.max(10, Math.min(90, marketFearGreed + fgDiff));
            updateFearGreedUI();
        }
        
        // Redraw stats on the active dashboard screen
        const dataPoints = historicalData[currentTicker];
        if (!dataPoints || dataPoints.length === 0) return;
        const meta = tickerMetadata[currentTicker];
        const currentClose = dataPoints[dataPoints.length - 1].close;
        
        const currentPriceEl = document.getElementById('current-price');
        const oldPrice = parseFloat(currentPriceEl.innerText.replace(/[^0-9.]/g, ''));
        currentPriceEl.innerText = formatMoney(currentClose, meta.currency);
        
        if (oldPrice !== currentClose) {
            currentPriceEl.className = 'ribbon-value font-mono ' + (currentClose > oldPrice ? 'tick-up' : 'tick-down');
            setTimeout(() => {
                currentPriceEl.className = 'ribbon-value font-mono';
            }, 800);
            
            // Refresh change rate dynamically
            const prevClose = dataPoints[dataPoints.length - 2].close;
            const changePct = ((currentClose - prevClose) / prevClose) * 100;
            const changeEl = document.getElementById('current-change');
            
            let displayChangePct = changePct;
            if (meta.regularMarketChangePercent !== undefined) {
                displayChangePct = meta.regularMarketChangePercent;
            }
            changeEl.innerText = `${displayChangePct >= 0 ? '+' : ''}${displayChangePct.toFixed(2)}%`;
            changeEl.className = `ribbon-value font-mono ${displayChangePct >= 0 ? 'text-up' : 'text-down'}`;
            
            // update mini prices in navigation sidebar
            document.getElementById(`mini-price-${currentTicker}`).innerText = formatMoney(currentClose, meta.currency);
            const miniChangeEl = document.getElementById(`mini-change-${currentTicker}`);
            
            let displayMiniChangePct = displayChangePct;
            miniChangeEl.innerText = `${displayMiniChangePct >= 0 ? '+' : ''}${displayMiniChangePct.toFixed(2)}%`;
            miniChangeEl.className = `ticker-change-mini ${displayMiniChangePct >= 0 ? 'text-up' : 'text-down'}`;
            
            // Recompute probabilities dynamically as pricing changes
            const analysis = analyzeTechnicals(currentTicker);
            const buyProb = calculateBuyProbability(currentTicker, analysis);
            
            document.getElementById('buy-prob-percent').innerText = `${buyProb}%`;
            const offset = 314.16 - (314.16 * buyProb) / 100;
            document.getElementById('buy-probability-ring').style.strokeDashoffset = offset;
            
            // Re-render subpanels values without doing full heavy DOM recreate
            updateIndicatorPanel('ma', analysis.ma);
            updateIndicatorPanel('rsi', analysis.rsi);
            updateIndicatorPanel('macd', analysis.macd);
            updateIndicatorPanel('vol', analysis.vol);
            
            // Update Agent flow visuals live
            updateAgentVolumeBreakdown(currentTicker);
            
            updatePortfolioUI();
        }
    }, 1000);
});
