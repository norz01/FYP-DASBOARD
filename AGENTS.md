# TVETMARA Besut Skills Talent Development Dashboard

## Tech Stack

This project is a **MERN stack application** with ML integration for student talent development analytics.

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite 7
- **Routing**: React Router DOM 7
- **Styling**: Tailwind CSS 3, PostCSS, Autoprefixer
- **Charts**: Chart.js 4, react-chartjs-2
- **Bundling**: ESLint, eslint-plugin-react-hooks, eslint-plugin-react-refresh

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken), bcryptjs
- **CORS**: cors middleware

### ML Service
- **Framework**: FastAPI (Python)
- **Server**: Uvicorn
- **ML Library**: scikit-learn
- **Model Serialization**: joblib
- **Data Validation**: Pydantic

## Project Structure

```
/ML                    # Python ML service (FastAPI)
/backend               # Backend separate package (placeholder)
src/                   # React frontend source
  /pages               # React page components
  /utils               # Utility functions (auth.js)
  App.jsx              # Main app component
  main.jsx             # Entry point
server.js              # Express server entry point
auth.js                # Authentication routes
items.js               # Items API routes
auth.model.js          # Mongoose auth model
item.model.js          # Mongoose item model
```

## Development Commands

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run start` - Start Express server
- `npm run preview` - Preview production build

## Environment Variables

- `PORT` - Server port (default: 5000)
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret