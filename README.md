# MCHacks

A Next.js application with Auth0 authentication and Three.js 3D rendering.

## Project Structure

```
mchacks/
├── frontend/          # Next.js application
│   ├── app/           # App Router pages
│   ├── components/    # React components
│   └── styles/        # Global styles
└── backend/           # Backend services (placeholder)
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp env.example .env.local
   ```

4. Configure Auth0 in `.env.local`:
   - `AUTH0_SECRET`: Generate with `openssl rand -hex 32`
   - `AUTH0_BASE_URL`: Your app URL (e.g., `http://localhost:3000`)
   - `AUTH0_ISSUER_BASE_URL`: Your Auth0 domain (e.g., `https://your-tenant.auth0.com`)
   - `AUTH0_CLIENT_ID`: Your Auth0 application Client ID
   - `AUTH0_CLIENT_SECRET`: Your Auth0 application Client Secret

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Features

- **Auth0 Authentication**: Secure login/logout with Auth0
- **Protected Routes**: `/home` and `/workspace` require authentication
- **3D Workspace**: Interactive Three.js scene with React Three Fiber
- **Chat Panel**: Local-state chat UI for real-time messaging

## Routes

- `/` - Landing page with login
- `/home` - Protected project home (shows user info)
- `/workspace` - Protected workspace with 3D scene and chat

## Auth0 Setup

1. Create an Auth0 application (Regular Web Application)
2. Configure Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
3. Configure Allowed Logout URLs: `http://localhost:3000`
4. Copy credentials to `.env.local`
