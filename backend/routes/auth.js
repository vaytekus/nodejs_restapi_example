const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth');
const User = require('../models/user');

// PUT /auth/signup
router.put('/signup', [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email.')
    .custom((value, { req }) => {
      return User.findOne({ email: value }).then(userDoc => {
        if(userDoc) {
          return Promise.reject('E-mail address already exists!');
        }
      });
    })
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password').trim().isLength({ min: 5 }),
  body('name').trim().not().isEmpty()
], authController.signup);

// POST /auth/login
router.post('/login', authController.login);

// POST /auth/logout (clears httpOnly cookie)
router.post('/logout', authController.logout);

module.exports = router;