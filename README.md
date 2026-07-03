# Mortgage Calculator

A static Vite + vanilla TypeScript mortgage calculator for estimating monthly housing cost, payoff time, and interest savings from recurring extra principal payments.

## Run locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Preview

```sh
npm run preview
```

## Test

```sh
npm test
```

## Deploy to GitHub Pages

This project includes a GitHub Actions workflow that builds the app and deploys `dist` to GitHub Pages.

1. Push the project to GitHub.
2. In the repository settings, enable Pages and choose GitHub Actions as the source.
3. If the repository is a project site, set `base` in `vite.config.ts` to the repo path, such as `/mortgage-calculator/`.
4. Push to `main`.

You can also build locally with `npm run build` and deploy the generated `dist` folder using any static host.

## Assumptions

- Only a 30-year fixed conventional mortgage is modeled.
- The online mortgage rate, when available, is a rough national average and not a lender quote.
- Property taxes are estimates.
- Home insurance is an estimate and should be replaced with a real quote when evaluating a property.
- PMI is simplified.
- HOA is included for budgeting and may not be escrowed.
- Extra principal payments are modeled as recurring monthly payments.
