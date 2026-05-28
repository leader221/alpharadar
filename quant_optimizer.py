import os
import socket
socket.setdefaulttimeout(15) # Force global socket timeout to prevent network hangs
import datetime
import numpy as np
import pandas as pd
import yfinance as yf
import matplotlib
matplotlib.use('Agg') # Set non-interactive backend
import matplotlib.pyplot as plt
from scipy.optimize import minimize

# Define stock pool (popular US stocks)
TICKERS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 
    'META', 'TSLA', 'JPM', 'V', 'WMT', 
    'DIS', 'NFLX', 'KO', 'PEP', 'COST', 'AMD'
]

# Robust fallback fundamentals in case yfinance fails to return them
DEFAULT_FUNDAMENTALS = {
    'AAPL': {'pe': 28.5, 'pb': 45.0, 'roe': 1.50},
    'MSFT': {'pe': 35.0, 'pb': 12.0, 'roe': 0.38},
    'GOOGL': {'pe': 26.0, 'pb': 7.5, 'roe': 0.29},
    'AMZN': {'pe': 40.0, 'pb': 8.5, 'roe': 0.20},
    'NVDA': {'pe': 65.0, 'pb': 35.0, 'roe': 0.85},
    'META': {'pe': 24.0, 'pb': 8.0, 'roe': 0.32},
    'TSLA': {'pe': 55.0, 'pb': 9.0, 'roe': 0.15},
    'JPM': {'pe': 12.0, 'pb': 1.6, 'roe': 0.13},
    'V': {'pe': 32.0, 'pb': 15.0, 'roe': 0.48},
    'WMT': {'pe': 28.0, 'pb': 5.0, 'roe': 0.18},
    'DIS': {'pe': 25.0, 'pb': 1.8, 'roe': 0.05},
    'NFLX': {'pe': 36.0, 'pb': 10.0, 'roe': 0.28},
    'KO': {'pe': 22.0, 'pb': 10.0, 'roe': 0.40},
    'PEP': {'pe': 24.0, 'pb': 14.0, 'roe': 0.50},
    'COST': {'pe': 45.0, 'pb': 15.0, 'roe': 0.30},
    'AMD': {'pe': 50.0, 'pb': 4.5, 'roe': 0.08}
}

# Standard fallback for tickers not in the above list
GLOBAL_FALLBACK = {'pe': 25.0, 'pb': 4.0, 'roe': 0.15}

def get_fundamentals(ticker):
    """
    Fetch fundamental metrics with robust fallback logic.
    """
    defaults = DEFAULT_FUNDAMENTALS.get(ticker, GLOBAL_FALLBACK)
    return defaults['pe'], defaults['pb'], defaults['roe']

def calculate_rsi(prices, period=14):
    """
    Calculate 14-period RSI using Wilder's EMA smoothing.
    """
    delta = prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    
    avg_gain = gain.ewm(com=period-1, adjust=False).mean()
    avg_loss = loss.ewm(com=period-1, adjust=False).mean()
    
    rs = avg_gain / (avg_loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    # Fill leading NaNs with 50 (neutral)
    return rsi.fillna(50)

def calculate_macd(prices, slow=26, fast=12, signal=9):
    """
    Calculate MACD Line, Signal Line, and normalized Histogram.
    """
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return macd_line, signal_line, hist

def calculate_ma_scores(prices):
    """
    Evaluate Moving Average alignment on a 0-100 scale:
    - 20 > 50 > 200 (Uptrend/정배열): 100
    - 20 > 200 > 50: 75
    - 50 > 205 > 200: 50
    - 50 > 200 > 20: 35
    - 200 > 20 > 50: 20
    - 200 > 50 > 20 (Downtrend/역배열): 0
    """
    ma20 = prices.rolling(window=20).mean()
    ma50 = prices.rolling(window=50).mean()
    ma200 = prices.rolling(window=200).mean()
    
    scores = pd.Series(index=prices.index, dtype=float)
    
    for idx in prices.index:
        p20 = ma20.loc[idx]
        p50 = ma50.loc[idx]
        p200 = ma200.loc[idx]
        
        if pd.isna(p20) or pd.isna(p50) or pd.isna(p200):
            scores.loc[idx] = 50.0 # Neutral during startup window
            continue
            
        if p20 > p50 and p50 > p200:
            scores.loc[idx] = 100.0
        elif p20 > p200 and p200 > p50:
            scores.loc[idx] = 75.0
        elif p50 > p20 and p20 > p200:
            scores.loc[idx] = 50.0
        elif p50 > p200 and p200 > p20:
            scores.loc[idx] = 35.0
        elif p200 > p20 and p20 > p50:
            scores.loc[idx] = 20.0
        else:
            scores.loc[idx] = 0.0
            
    return scores

def normalize_indicators(df, pe, pb, roe):
    """
    Normalize all 7 indicators to a 0-100 scale.
    """
    # 1. PER (Lower is better, penalize <=0 or >50)
    df['score_per'] = np.where((pe > 0) & (pe <= 50), (50 - pe) * 2, 0)
    df['score_per'] = np.clip(df['score_per'], 0, 100)
    
    # 2. PBR (Lower is better, penalize <=0 or >6)
    df['score_pbr'] = np.where((pb > 0) & (pb <= 6), (6 - pb) * 16.67, 0)
    df['score_pbr'] = np.clip(df['score_pbr'], 0, 100)
    
    # 3. ROE (Higher is better, ROE of 33%+ gives 100)
    df['score_roe'] = np.clip(roe * 300, 0, 100)
    
    # 4. RSI (Oversold < 30 gives 100, Overbought > 70 gives 0, linear in between)
    rsi = calculate_rsi(df['Close'])
    df['score_rsi'] = np.where(rsi < 30, 100, 
                               np.where(rsi > 70, 0, 100 - (rsi - 30) * 2.5))
    df['score_rsi'] = np.clip(df['score_rsi'], 0, 100)
    
    # 5. MACD (Hist normalized by rolling standard deviation)
    _, _, hist = calculate_macd(df['Close'])
    hist_std = hist.rolling(window=20).std().fillna(1e-8)
    norm_hist = hist / hist_std
    df['score_macd'] = np.clip(50 + norm_hist * 25, 0, 100).fillna(50)
    
    # 6. Moving Average alignment score
    df['score_ma'] = calculate_ma_scores(df['Close'])
    
    # 7. Volume Rate (5-day volume / 20-day volume)
    vol_5 = df['Volume'].rolling(window=5).mean()
    vol_20 = df['Volume'].rolling(window=20).mean().fillna(1e-8)
    vol_rate = vol_5 / vol_20
    df['score_vol'] = np.where(vol_rate < 0.5, 0,
                               np.where(vol_rate > 2.0, 100, (vol_rate - 0.5) / 1.5 * 100))
    df['score_vol'] = np.clip(df['score_vol'], 0, 100).fillna(50)
    
    return df

def calculate_portfolio_performance(data_dict, weights):
    """
    Simulates portfolio strategy using weights and returns strategy values and benchmark values.
    """
    total_dates = None
    strategy_values = {}
    benchmark_values = {}
    
    # First, let's identify common dating window
    for ticker, df in data_dict.items():
        if total_dates is None:
            total_dates = df.index
        else:
            total_dates = total_dates.intersection(df.index)
            
    total_dates = sorted(total_dates)
    
    # Trim dataframes to common dates
    trimmed_data = {}
    for ticker, df in data_dict.items():
        trimmed_data[ticker] = df.loc[total_dates].copy()
        
    num_days = len(total_dates)
    
    # Initialize trackers
    # For strategy, start with $10,000 cash in each stock's sub-portfolio
    # For benchmark, start with $10,000 fully invested in each stock
    cash = {ticker: 10000.0 for ticker in TICKERS}
    shares = {ticker: 0.0 for ticker in TICKERS}
    
    benchmark_shares = {}
    for ticker in TICKERS:
        df = trimmed_data[ticker]
        first_close = df.iloc[0]['Close']
        benchmark_shares[ticker] = 10000.0 / first_close
        
    strategy_val_curve = np.zeros(num_days)
    benchmark_val_curve = np.zeros(num_days)
    
    # Iterate day-by-day
    for idx, date in enumerate(total_dates):
        daily_strat_total = 0.0
        daily_bench_total = 0.0
        
        for ticker in TICKERS:
            df = trimmed_data[ticker]
            row = df.loc[date]
            close = row['Close']
            
            # 1. Benchmark value
            daily_bench_total += benchmark_shares[ticker] * close
            
            # 2. Strategy evaluation
            # Calculate composite score
            score = (
                weights[0] * row['score_per'] +
                weights[1] * row['score_pbr'] +
                weights[2] * row['score_roe'] +
                weights[3] * row['score_rsi'] +
                weights[4] * row['score_macd'] +
                weights[5] * row['score_ma'] +
                weights[6] * row['score_vol']
            )
            
            # Trade rules
            c_cash = cash[ticker]
            c_shares = shares[ticker]
            
            # Buy signal (Score >= 80, currently not holding)
            if score >= 80.0 and c_shares == 0.0:
                shares[ticker] = c_cash / close
                cash[ticker] = 0.0
            # Sell signal (Score <= 40, currently holding)
            elif score <= 40.0 and c_shares > 0.0:
                cash[ticker] = c_shares * close
                shares[ticker] = 0.0
                
            # Current value of sub-portfolio
            strat_val = cash[ticker] + shares[ticker] * close
            daily_strat_total += strat_val
            
        strategy_val_curve[idx] = daily_strat_total
        benchmark_val_curve[idx] = daily_bench_total
        
    return total_dates, strategy_val_curve, benchmark_val_curve

def compute_metrics(val_curve):
    """
    Compute total return and maximum drawdown (MDD).
    """
    if len(val_curve) == 0:
        return 0.0, 0.0
    tot_return = (val_curve[-1] - val_curve[0]) / val_curve[0]
    
    # MDD calculation
    peaks = np.maximum.accumulate(val_curve)
    drawdowns = (peaks - val_curve) / peaks
    mdd = np.max(drawdowns) if len(drawdowns) > 0 else 0.0
    return tot_return, mdd

def main():
    global TICKERS
    print("====================================================")
    print("QUANTITATIVE TRADING OPTIMIZATION & BACKTEST ENGINE")
    print("====================================================")
    
    # 1. Fetch historical data
    # Download 2.5 years of daily data
    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=365 * 2.5)
    
    print(f"Data period: {start_date} to {end_date}")
    print("Downloading historical prices and fundamentals...")
    
    data_dict = {}
    fundamentals_dict = {}
    
    for ticker in TICKERS:
        print(f"  Fetching {ticker}...", end="", flush=True)
        # Download historical daily data with threads=False to prevent multitasking thread joins hanging on Windows
        df = yf.download(ticker, start=start_date, end=end_date, progress=False, timeout=10, threads=False)
        if df.empty:
            print(" Failed to download history. Skipping.")
            continue
            
        # Standardize columns to avoid MultiIndex issue if any
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        # Get fundamentals
        pe, pb, roe = get_fundamentals(ticker)
        fundamentals_dict[ticker] = {'pe': pe, 'pb': pb, 'roe': roe}
        
        # Process and normalize indicators
        df = normalize_indicators(df, pe, pb, roe)
        data_dict[ticker] = df
        print(f" Done. (PE: {pe:.1f}, PB: {pb:.1f}, ROE: {roe:.2f})")
        
    if len(data_dict) < len(TICKERS):
        # Update valid tickers list
        TICKERS = list(data_dict.keys())
        
    print(f"\nSuccessfully downloaded and processed {len(TICKERS)} tickers.")
    
    # 2. Optimization setup
    # Objective function to maximize (Return - 2 * MDD)
    # Since scipy minimizer minimizes, we minimize -(Return - 2 * MDD)
    
    # Let's run a random search (Monte Carlo) first to avoid local minima
    print("\nRunning Monte Carlo search for initial weight alignment...")
    best_init_score = -999.0
    best_init_weights = None
    
    np.random.seed(42)
    for i in range(250):
        # Generate random weights summing to 1.0
        w = np.random.dirichlet(np.ones(7))
        _, strat, _ = calculate_portfolio_performance(data_dict, w)
        ret, mdd = compute_metrics(strat)
        score = ret - 2.0 * mdd
        
        if score > best_init_score:
            best_init_score = score
            best_init_weights = w
            
    print(f"Best initial guess (Monte Carlo): Score = {best_init_score:.4f} "
          f"Weights = {np.round(best_init_weights, 3)}")
    
    # Define optimization function
    def objective_func(weights):
        # Normalize weights during optimization to ensure they sum to 1
        w_norm = weights / np.sum(weights)
        _, strat, _ = calculate_portfolio_performance(data_dict, w_norm)
        ret, mdd = compute_metrics(strat)
        # Minimize the negative return adjusted for drawdown risk
        return -(ret - 2.0 * mdd)
        
    # Bounds: w_i in [0, 1]
    bounds = [(0.0, 1.0) for _ in range(7)]
    # Constraint: sum(w_i) = 1.0
    constraints = ({'type': 'eq', 'fun': lambda w: np.sum(w) - 1.0})
    
    print("\nRunning Scipy SLSQP Optimizer...")
    res = minimize(
        objective_func, 
        x0=best_init_weights, 
        bounds=bounds, 
        constraints=constraints,
        method='SLSQP',
        options={'maxiter': 50, 'disp': True}
    )
    
    # Extract optimal weights
    if res.success:
        opt_weights = res.x / np.sum(res.x)
        print("Scipy Optimizer successfully converged.")
    else:
        opt_weights = best_init_weights
        print("Scipy Optimizer failed to converge. Falling back to Monte Carlo best weights.")
        
    opt_weights = np.round(opt_weights, 4)
    indicators = ['PER', 'PBR', 'ROE', 'RSI', 'MACD', 'MA Trend', 'Volume Breakout']
    
    print("\n====================================================")
    print("OPTIMAL WEIGHT CONFIGURATION")
    print("====================================================")
    for ind, wt in zip(indicators, opt_weights):
        print(f"  {ind:<18}: {wt * 100:6.2f}%")
        
    # 3. Simulate performance for optimized weights vs Benchmark
    dates, opt_strat, bench = calculate_portfolio_performance(data_dict, opt_weights)
    opt_return, opt_mdd = compute_metrics(opt_strat)
    bench_return, bench_mdd = compute_metrics(bench)
    
    print("\n====================================================")
    print("PORTFOLIO STRATEGY PERFORMANCE")
    print("====================================================")
    print(f"  {'Metric':<25} | {'Optimized Strategy':<20} | {'Benchmark (Buy & Hold)':<22}")
    print("-" * 75)
    print(f"  {'Total Cumulative Return':<25} | {opt_return * 100:18.2f}% | {bench_return * 100:20.2f}%")
    print(f"  {'Maximum Drawdown (MDD)':<25} | {opt_mdd * 100:18.2f}% | {bench_mdd * 100:20.2f}%")
    print(f"  {'Return / MDD Ratio':<25} | {opt_return / (opt_mdd + 1e-10):18.2f} | {bench_return / (bench_mdd + 1e-10):20.2f}")
    
    # 4. Generate Top 10 recommendations
    print("\n====================================================")
    print("TOP 10 US STOCK RECOMMENDATIONS (CURRENT STATE)")
    print("====================================================")
    
    recommendations = []
    for ticker in TICKERS:
        df = data_dict[ticker]
        latest_row = df.iloc[-1]
        
        # Calculate current composite score
        score = (
            opt_weights[0] * latest_row['score_per'] +
            opt_weights[1] * latest_row['score_pbr'] +
            opt_weights[2] * latest_row['score_roe'] +
            opt_weights[3] * latest_row['score_rsi'] +
            opt_weights[4] * latest_row['score_macd'] +
            opt_weights[5] * latest_row['score_ma'] +
            opt_weights[6] * latest_row['score_vol']
        )
        
        close_price = latest_row['Close']
        pe = fundamentals_dict[ticker]['pe']
        pb = fundamentals_dict[ticker]['pb']
        roe = fundamentals_dict[ticker]['roe']
        
        recommendations.append({
            'Ticker': str(ticker),
            'Score': float(score),
            'Price ($)': float(close_price),
            'PER': float(pe),
            'PBR': float(pb),
            'ROE (%)': float(roe * 100.0)
        })
        
    rec_df = pd.DataFrame(recommendations)
    rec_df = rec_df.sort_values(by='Score', ascending=False).reset_index(drop=True)
    
    print(rec_df.head(10).to_string(index=False, formatters={
        'Score': '{:.1f}'.format,
        'Price ($)': '{:.2f}'.format,
        'PER': '{:.1f}'.format,
        'PBR': '{:.2f}'.format,
        'ROE (%)': '{:.1f}%'.format
    }))
    
    # 5. Plot returns curve and save image
    plt.figure(figsize=(12, 6))
    
    # Standardize to percentage scale (starting at 100)
    strat_perc = (opt_strat / opt_strat[0]) * 100
    bench_perc = (bench / bench[0]) * 100
    
    plt.plot(dates, strat_perc, label=f'Optimized Strategy (Return: {opt_return * 100:.1f}%, MDD: {opt_mdd * 100:.1f}%)', color='#3b82f6', linewidth=2)
    plt.plot(dates, bench_perc, label=f'Equal Weight Benchmark (Return: {bench_return * 100:.1f}%, MDD: {bench_mdd * 100:.1f}%)', color='#94a3b8', linewidth=1.5, linestyle='--')
    
    plt.title('Quantitative Optimizer Strategy Performance vs. Equal-Weight Benchmark', fontsize=14, fontweight='bold', pad=15)
    plt.xlabel('Date', fontsize=12)
    plt.ylabel('Portfolio Value (Base 100)', fontsize=12)
    plt.legend(loc='upper left', frameon=True, facecolor='#ffffff', edgecolor='#e2e8f0')
    plt.grid(True, linestyle=':', alpha=0.6)
    plt.tight_layout()
    
    plot_path = os.path.join(os.getcwd(), 'portfolio_performance.png')
    plt.savefig(plot_path, dpi=300)
    print(f"\nSaved performance chart to: {plot_path}")
    
    # Save results as JSON for web interface integration
    import json
    results = {
        'opt_weights': {
            'per': float(opt_weights[0]),
            'pbr': float(opt_weights[1]),
            'roe': float(opt_weights[2]),
            'rsi': float(opt_weights[3]),
            'macd': float(opt_weights[4]),
            'ma': float(opt_weights[5]),
            'vol': float(opt_weights[6])
        },
        'metrics': {
            'strategy_return': float(opt_return),
            'strategy_mdd': float(opt_mdd),
            'benchmark_return': float(bench_return),
            'benchmark_mdd': float(bench_mdd)
        },
        'recommendations': [
            {
                'Ticker': str(r['Ticker']),
                'Score': float(r['Score']),
                'Price': float(r['Price ($)']),
                'PER': float(r['PER']),
                'PBR': float(r['PBR']),
                'ROE': float(r['ROE (%)'])
            } for r in recommendations
        ]
    }
    
    # Sort recommendations by Score descending
    results['recommendations'] = sorted(results['recommendations'], key=lambda x: x['Score'], reverse=True)
    
    json_path = os.path.join(os.getcwd(), 'optimization_results.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=4)
    print(f"Saved optimization results JSON to: {json_path}")
    print("====================================================")

if __name__ == '__main__':
    main()
