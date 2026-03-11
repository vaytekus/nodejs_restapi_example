const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');

// load environment variables based on NODE_ENV
const nodeEnv = process.env.NODE_ENV;
let envFile = '.env';
if (nodeEnv === 'development') {
  envFile = '.env.development';
} else if (nodeEnv === 'test') {
  envFile = '.env.test';
}
require('dotenv').config({ path: envFile });

const app = express();

const MONGODB_URI = process.env.MONGODB_URI;
const BACKEND_PORT = process.env.BACKEND_PORT || 8080;

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');
const socketIO = require('./socket');

// file upload middleware
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().toISOString() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'));
app.use(bodyParser.json());
app.use(cookieParser());
app.use('/images', express.static(path.join(__dirname, 'images')));

// set headers (use specific origin when using cookies + credentials)
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', frontendOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

// error handling middleware
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

let server;
let io;

function start() {
  if (server) {
    return Promise.resolve({ server, io });
  }

  return mongoose
    .connect(MONGODB_URI)
    .then(result => {
      server = app.listen(BACKEND_PORT);
      io = socketIO.init(server, {
        cors: {
          origin: frontendOrigin,
          credentials: true
        }
      });

      io.on('connection', socket => {
        console.log('Client connected');
        socket.on('disconnect', () => {
          console.log('Client disconnected');
        });
        socket.on('message', message => {
          console.log('Message received:', message);
        });
      });

      return { server, io };
    })
    .catch(err => {
      console.log(err);
      throw err;
    });
}

if (process.env.NODE_ENV !== 'test') {
  start().catch(() => {});
}

module.exports = { app, start };