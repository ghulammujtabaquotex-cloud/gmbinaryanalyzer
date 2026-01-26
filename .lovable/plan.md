
# Future Signal Generator Bot - Implementation Plan

## Overview
Build an automated signal generator that connects to the GAMMA API (`ai.gammaxbd.xyz`) to fetch historical candle data, analyze patterns, and generate trading signals based on probability calculations - replicating the GAMMA X Software functionality.

## Key Features

### 1. Signal Generation Engine
- Connect to GAMMA API for historical candle data
- Analyze 7-40 days of price movements for each time slot
- Calculate win probability: CALL wins vs PUT wins
- Apply Martingale levels based on accuracy (M0: 85%+, M1: 75-84%, M2: 70-74%, M3: 65-69%)
- Generate signals only when accuracy meets the threshold

### 2. Supported Assets (11 OTC Pairs)
- BRLUSD_otc (Brazilian Real)
- USDBDT_otc (Bangladeshi Taka)
- USDARS_otc (Argentine Peso)
- USDINR_otc (Indian Rupee)
- USDMXN_otc (Mexican Peso)
- USDPKR_otc (Pakistani Rupee)
- USDPHP_otc (Philippine Peso)
- USDEGP_otc (Egyptian Pound)
- USDTRY_otc (Turkish Lira)
- USDIDR_otc (Indonesian Rupiah)
- USDZAR_otc (South African Rand)

### 3. Configurable Parameters
- **Timeframe**: 1, 2, 5, 15, 30, 60 minutes (default: 1)
- **Martingale Level**: 0-3 (default: 0)
- **Minimum Win %**: 65-100% (default: 70%)
- **Analysis Days**: 7-40 days (default: 28)
- **Time Range**: Start and End time for signal generation

### 4. UI/UX Design
- Professional terminal-style interface (matching existing FutureSignals page)
- Real-time progress display during analysis
- Configuration panel for all parameters
- Asset selection (all or specific assets)
- Generated signals displayed with pair, time, direction, and MTG level
- Copy to clipboard functionality
- Save signals to database

---

## Technical Architecture

```text
┌────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  SignalBotPage.tsx                                        │ │
│  │  - Configuration UI (sliders, inputs, asset selection)   │ │
│  │  - Terminal output display                                │ │
│  │  - Generated signals table                                │ │
│  │  - Copy/Save functionality                                │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│              Edge Function: generate-signals                   │
│  1. Fetch candle data from GAMMA API for each asset           │
│  2. Group candles by time slot                                 │
│  3. Calculate CALL/PUT win rates                               │
│  4. Apply martingale levels based on accuracy                  │
│  5. Filter by min win % and time range                         │
│  6. Return generated signals                                   │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                  GAMMA API (ai.gammaxbd.xyz)                   │
│              Fetches historical Quotex candle data             │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Edge Function - `generate-signals`
Create a backend function that:
- Accepts configuration parameters (timeframe, martingale, minWinPercent, analysisDays, timeRange, assets)
- Calls the GAMMA API: `https://ai.gammaxbd.xyz/api/candles?symbol={ASSET}&timeframe={TF}&days={DAYS}`
- Processes historical data to calculate probabilities
- Returns generated signals with MTG levels

### Step 2: Create Signal Bot Page Component
Create `src/pages/SignalBot.tsx` with:
- Professional terminal-style UI (green text on dark background)
- Configuration panel with sliders/inputs for all parameters
- Asset selection (checkboxes or select all)
- Generate button that calls the edge function
- Real-time progress log display
- Results table showing: Asset, Time, Direction, Win %, MTG Level
- Copy and Save buttons

### Step 3: Update Dashboard
Add a new "Signal Bot" card to the Dashboard that navigates to the Signal Bot page, styled similar to the Live Bot and Future Signals cards.

### Step 4: Update Routing
Add the new `/signal-bot` route to `App.tsx`.

### Step 5: Database Updates
Optionally save generated signals to `future_signals_pool` table for later use by the Telegram automation.

---

## Signal Generation Algorithm

```text
For each selected asset:
  1. Fetch {analysisDays} days of {timeframe}-minute candles from GAMMA API
  
  2. Group candles by time slot (e.g., all 10:00 candles)
  
  3. For each time slot:
     - Count CALL wins (candle closed higher than open)
     - Count PUT wins (candle closed lower than open)
     - Calculate win rate: max(CALL%, PUT%) 
     
  4. Determine direction: 
     - If CALL wins > PUT wins → CALL signal
     - If PUT wins > CALL wins → PUT signal
     
  5. Assign MTG level:
     - 85%+ → M0 (no martingale)
     - 75-84% → M1 (1 step martingale)
     - 70-74% → M2 (2 step martingale)
     - 65-69% → M3 (3 step martingale)
     
  6. Filter:
     - Only include if win rate >= minWinPercent
     - Only include if time is within timeRange
     - Only include if MTG level <= maxMartingale setting
```

---

## Component Structure

### New Files to Create

1. **`supabase/functions/generate-signals/index.ts`** - Edge function for signal generation
2. **`src/pages/SignalBot.tsx`** - Main signal bot page with UI and logic
3. **`src/components/SignalBotConfig.tsx`** - Configuration panel component
4. **`src/components/SignalBotResults.tsx`** - Results display component

### Files to Modify

1. **`src/pages/Dashboard.tsx`** - Add Signal Bot card
2. **`src/App.tsx`** - Add route for `/signal-bot`

---

## UI Design Details

### Configuration Panel
- Timeframe selector (dropdown: 1, 2, 5, 15, 30, 60)
- Analysis Days slider (7-40, default 28)
- Minimum Win % slider (65-100, default 70)
- Max Martingale selector (0-3, default 0)
- Time Range inputs (start time, end time)
- Asset selection checkboxes or "Select All"

### Terminal Output
- Green text on black background
- Show progress: "Analyzing USDBDT_otc... 15 sec"
- Show found signals in real-time
- Professional loading animations

### Results Display
- Table with columns: Asset, Time, Direction, Win %, MTG Level
- Color-coded directions (green CALL, red PUT)
- Total signals count
- Copy all and Save to pool buttons

---

## Notes

- The GAMMA API endpoint structure needs to be verified (the document mentions `ai.gammaxbd.xyz` but exact endpoints need testing)
- If the external API is unavailable/unreliable, implement fallback demo mode
- All times displayed in UTC+5 (Pakistan timezone)
- VIP-only access (matching existing FutureSignals page restrictions)
