const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const feedController = require('../controllers/feed');
const isAuth = require('../middleware/is-auth');

// GET /feed/posts
router.get('/posts', isAuth, feedController.getPosts);

// POST /feed/post
router.post('/post', [
  body('title').trim().isLength({ min: 5 }),
  body('content').trim().isLength({ min: 5 }),
], isAuth, feedController.createPost);

router.get('/post/:postId', isAuth, feedController.getPost);

// PUT /feed/post/:postId
router.put('/post/:postId', [
  body('title').trim().isLength({ min: 5 }),
  body('content').trim().isLength({ min: 5 }),
], isAuth, feedController.updatePost);

// DELETE /feed/post/:postId
router.delete('/post/:postId', isAuth, feedController.deletePost);

module.exports = router;