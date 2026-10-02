# PawPal Web

Frontend application for **PawPal**, a pet-care service platform.

This project is built with:

- Next.js
- TypeScript
- Tailwind CSS
- App Router

---

## 1. Requirements

Before running the project, make sure your computer has:

- Node.js 20 or newer
- npm
- Git

Check your versions:

```bash
node -v
npm -v
git --version
```

---

## 2. Clone the repository

```bash
git clone <FRONTEND_REPOSITORY_URL>
```

Then go into the project folder:

```bash
cd pet-care-web
```

---

## 3. Install dependencies

Run:

```bash
npm install
```

Wait until all dependencies are installed.

---

## 4. Environment setup

Create a new file named:

```text
.env.local
```

at the root of the project.

Copy the following content into it:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

The backend must be running at:

```text
http://localhost:3000
```

If the backend URL changes, update `NEXT_PUBLIC_API_URL`.

---

## 5. Run the project

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

in your browser.

If port `3000` is already being used, Next.js may automatically start on another port such as:

```text
http://localhost:3001
```

Check the terminal for the actual URL.

---

## 6. Build the project

Before pushing code, make sure the project builds successfully:

```bash
npm run build
```

Also run:

```bash
npm run lint
```

Both commands should finish without errors.

---

## 7. Project structure

```text
pet-care-web/
├── public/
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   │   ├── api/
│   │   ├── constants/
│   │   └── utils/
│   │
│   ├── services/
│   ├── types/
│   └── config/
│
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

Main folders:

- `app/`: Next.js pages, layouts and routing
- `components/`: reusable UI components
- `features/`: business features such as authentication, pets, bookings and services
- `hooks/`: reusable React hooks
- `lib/`: shared utilities and API configuration
- `services/`: API service functions
- `types/`: shared TypeScript types
- `config/`: application configuration

---

## 8. Git workflow

Do not develop new features directly on `main`.

Main branches:

```text
main
develop
```

Create a feature branch from `develop`.

Example:

```bash
git checkout develop
git pull
git checkout -b feature/auth
```

After finishing your work:

```bash
git add .
git commit -m "feat: implement authentication"
git push -u origin feature/auth
```

Then create a Pull Request into:

```text
develop
```

The `main` branch should contain only stable and tested code.

---

## 9. Running frontend and backend together

PawPal currently uses separate frontend and backend repositories.

Example local structure:

```text
THESIS/
├── pet-care-project/
└── pet-care-web/
```

Backend:

```bash
cd pet-care-project
npm install
npm run start:dev
```

Frontend:

```bash
cd pet-care-web
npm install
npm run dev
```

Default addresses:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:3000
```

If both projects use port `3000`, change one of the ports before running them together.

For example, run the frontend on port `3001`:

```bash
npm run dev -- -p 3001
```

Then access:

```text
http://localhost:3001
```

---

## 10. Quick start

For someone cloning the project for the first time:

```bash
git clone <FRONTEND_REPOSITORY_URL>
cd pet-care-web
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

Then run:

```bash
npm run dev
```

Open the URL shown in the terminal.