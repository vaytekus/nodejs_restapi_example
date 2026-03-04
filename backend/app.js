const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const multer = require('multer');
const app = express();

const MONGODB_URI = process.env.MONGODB_URI;

const feedRoutes = require('./routes/feed');

// file upload middleware
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, new Date().getTime() + '-' + file.originalname);
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
app.use('/images', express.static(path.join(__dirname, 'images')));

// set headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/feed', feedRoutes);

// error handling middleware
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

// connect to database
mongoose
  .connect(
    MONGODB_URI
  )
  .then(result => {
    app.listen(8080);
  })
  .catch(err => {
    console.log(err);
  });