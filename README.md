# Vision2DCS

Vision2DCS is an industrial AI prototype that turns P&ID interpretation into a structured engineering workflow. It analyzes instrumentation diagrams, drafts tag mappings, and produces visual topology concepts for modern DCS and HMI projects.

![Vision2DCS interface](https://github.com/user-attachments/assets/2259d7d5-cac7-409c-b453-ede8c39f6398)

Demo: [YouTube walkthrough](https://www.youtube.com/watch?v=x9uHCqvARMg)

## Why this project exists

Instrumentation engineers still spend significant time translating P&IDs into tag lists, control structures, and HMI drafts by hand. Vision2DCS demonstrates how multimodal AI can accelerate the early design phase of automation projects while keeping the output visible and reviewable.

## What it does

- Parses uploaded process diagrams with Gemini-powered multimodal analysis.
- Extracts instrumentation concepts into structured engineering data.
- Drafts HMI and topology views with React Flow components.
- Maps output toward DCS-centric thinking for platforms such as Siemens PCS 7 and ABB 800xA.
- Packages the result as an explorable React/Vite prototype for portfolio review.

## Architecture snapshot

- **Frontend:** React 19, TypeScript, Vite
- **AI layer:** `@google/genai` with Gemini-based image and text reasoning
- **Visualization:** React Flow for topology and node mapping
- **Reference docs:** `TECHNICAL_GUIDE.md` for deeper implementation notes

## Local setup

### Prerequisites

- Node.js 20+
- npm
- A Google AI Studio API key

### Install

```bash
npm install
cp .env.example .env.local
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Repository highlights

- `services/geminiService.ts` contains the AI orchestration layer.
- `components/HmiReactFlowView.tsx` drives the topology visualization.
- `TECHNICAL_GUIDE.md` documents the engineering intent in more depth.

## Portfolio note

This repository is a concept-stage engineering tool. It is intended to showcase Industrial AI workflow design for automation engineering rather than serve as a production-ready export pipeline.

## License

MIT
