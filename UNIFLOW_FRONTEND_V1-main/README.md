# UniFlow Frontend

This is the frontend application for UniFlow, built with React, Ionic, and TypeScript.

## Project Structure

```
UNIFLOW_FRONTEND/
├── components/          # Reusable UI components
├── contexts/           # React contexts (Auth, etc.)
├── pages/             # Main application pages
├── services/          # API services and utilities
├── theme/             # CSS variables and styling
├── assets/            # Static assets (icons, images)
├── App.tsx            # Main application component
├── main.tsx           # Application entry point
├── index.html         # HTML template
├── package.json       # Dependencies and scripts
├── vite.config.ts     # Vite configuration
└── tsconfig.json      # TypeScript configuration
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
```bash
cd UNIFLOW_FRONTEND
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test.unit` - Run unit tests
- `npm run test.e2e` - Run end-to-end tests
- `npm run lint` - Run ESLint

## Features

- **Authentication**: Login, registration, and social auth
- **Dashboard**: Overview of tasks, events, and progress
- **Calendar**: Event management with priority levels
- **Task Management**: Create, complete, and delete tasks
- **Plans**: Academic, financial, health, and personal growth plans
- **Courses**: Course management and tracking
- **Profile**: User profile management

## Pages

- `/splash` - Splash screen
- `/onboarding` - Onboarding flow
- `/signup` - User registration
- `/login` - User login
- `/home` - Main dashboard
- `/profile` - User profile
- `/academic-plans` - Academic planning
- `/financial-plans` - Financial planning
- `/health-plans` - Health planning
- `/personal-growth-plans` - Personal growth planning
- `/daily-todo-list` - Daily task management
- `/courses` - Course management
- `/plans-page` - Plans overview

## Technologies Used

- **React 19** - UI library
- **Ionic React** - Mobile-first UI components
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **CSS Modules** - Component styling

## Data Storage

The app uses local storage for:
- User authentication (mock authentication)
- Data persistence
- User preferences
