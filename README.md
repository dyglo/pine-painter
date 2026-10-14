# Pine Painter

Build a web app for creating and testing TradingView Pine Script indicators on a chart.

Base: LuxAlgo's open-source Vela (@luxalgo/vela, @luxalgo/vela/workspace, @luxalgo/vela-pinets, pinets).
Data: Use Vela's bundled data providers (e.g. Binance/Coinbase) and its workspace symbol and timeframe controls.

Features:
1. Full-screen Vela workspace chart.
2. Code editor with a Run button: executes Pine Script via chart.runIndicator / chart.addIndicator (using @luxalgo/vela-pinets / pinets) and plots the result on the chart. Show Vela's structured errors inline if compilation or execution fails.
3. AI assistant panel: Describe an indicator in plain language. The model writes Pine v5/v6, and the app runs it on the chart. If it errors, send the error back to the model and retry/self-heal automatically (max 3 retries). Call the model from a server-side edge function with no API keys exposed in the browser. Use OpenAI's gpt-5.6 (gpt-5.6-sol) model.
4. Copy Pine button in the editor toolbar so code can be easily copied and pasted into TradingView.

Out of scope: strategy(), backtesting, accounts, payments, extra pages. Keep it simple and focused.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b1c423fc-5c62-4ab7-8ce0-ea87cb0f59ec).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
