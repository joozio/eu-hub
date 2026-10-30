# EU Hub - The European Union, Made Personal

A personalized gateway to everything happening in the EU — legislation, stats, changes that actually affect you — powered by Mistral AI.

## Features

- **Personalized EU Feed**: Get EU legislation and policy changes relevant to your country and age
- **AI-Powered Summaries**: Mistral AI summarizes dense legal/policy text into plain language
- **Eurostat Data Visualization**: Explore EU statistics visualized for your country and demographic
- **Q&A Interface**: Ask questions about EU topics in natural language
- **Privacy-First**: No account needed, minimal data collection

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Chart.js** for data visualization
- **Lucide React** for icons
- **Axios** for API calls

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
# or
yarn install
```

### Development

```bash
npm run dev
# or
yarn dev
```

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
eu-hub/
├── src/
│   ├── app/                  # Next.js app routes
│   │   ├── (landing)/         # Landing page
│   │   ├── feed/              # Personalized feed
│   │   ├── profile/           # User profile
│   │   ├── stats/             # Statistics visualization
│   │   └── ask/               # Q&A interface
│   ├── components/           # Reusable components
│   │   ├── ui/               # UI primitives
│   │   └── *                 # Custom components
│   ├── lib/                  # Utilities
│   ├── services/             # API services
│   └── types/                # TypeScript types
├── public/                  # Static assets
└── README.md                 # Project documentation
```

## Key Components

### Landing Page
- Country selector with flags
- Age selector
- Minimal onboarding (country + age)

### Feed Page
- Personalized EU content based on user profile
- Tabs for different content types:
  - Most Relevant (relevance-scored)
  - What's New (chronological)
  - What's Coming (proposals)
  - Interesting Stats

### Profile Page
- Additional personalization options:
  - Relationship status
  - Employment status
  - Industry/sector
  - Housing status
  - Parent status

### Stats Page
- Eurostat data visualization
- Country and indicator selection
- Interactive charts

### Ask Page
- Natural language Q&A interface
- Conversation history
- AI-powered answers about EU topics

## Data Sources (Mock Implementation)

The current implementation uses mock data, but is designed to integrate with:

- **EUR-Lex**: EU law database
- **Eurostat**: EU statistics
- **European Parliament Legislative Observatory**: Legislative tracking
- **Mistral AI API**: For summarization and Q&A

## Future Enhancements

- Real API integration with EUR-Lex and Eurostat
- Actual Mistral AI API calls for summarization
- User authentication for saving preferences
- Push notifications for relevant updates
- Multi-language support
- Mobile app version

## License

MIT License

## Acknowledgments

- Built with Next.js and Mistral AI
- Inspired by the need for accessible EU information
- Designed for privacy-conscious users