const express = require('express');
const cors = require('cors');
const matchesRoutes = require('./routes/matches.routes');
const standingsRoutes = require('./routes/standings.routes');
const errorMiddleware = require('./middlewares/error.middleware');
const rateLimit = require('express-rate-limit');




const healthRoutes = require('./routes/health.routes');

const app = express();
const limiter = rateLimit({
  windowMs: 1000 * 60, // 1 minute
  max: 30, // 30 requêtes par minute par IP
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});


app.use(cors());
app.use(express.json());
app.use(limiter);



app.use('/api/health', healthRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/standings', standingsRoutes);
app.use('/api/predictions', require('./routes/predictions.routes'));
app.use('/api/team', require('./routes/team.routes'));
app.use('/api/match', require('./routes/match.routes'));







app.use(errorMiddleware);



module.exports = app;
