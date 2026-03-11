const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator');

const Post = require('../models/post');
const User = require('../models/user');

const ITEMS_PER_PAGE = 2;

exports.getPosts = async (req, res, next) => {
  try {
    const currentPage = req.query.page || 1;
    const perPage = ITEMS_PER_PAGE;

    const totalItems = await Post.countDocuments();
    const posts = await Post.find()
      .populate('creator')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: 'Posts fetched successfully.',
      posts: posts,
      totalItems: totalItems
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
}

exports.createPost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  if (!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }

  const imageUrl = req.file.path;
  const title = req.body.title;
  const content = req.body.content;
  let creator;
  const post = new Post({
    title: title,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId
  });
  
  return post.save()
    .then(result => {
      return User.findById(result.creator);
    })
    .then(user => {
      creator = user;
      user.posts.push(post);
      return user.save();
    })
    .then(result => {
      const io = require('../socket').getIO();
      io.emit('posts', {
        action: 'create',
        post: {
          _id: post._id,
          title: post.title,
          content: post.content,
          imageUrl: post.imageUrl,
          creator: { _id: creator._id, name: creator.name },
          createdAt: post.createdAt
        }
      });
      res.status(201).json({
        message: 'Post created successfully',
        post: post,
        creator: { _id: creator._id, name: creator.name }
      });
      return creator;
    })
    .catch(err => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId;

  Post.findById(postId)
  .populate('creator')
  .then(post => {
    if(!post) {
      const error = new Error('Could not find post.');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({
      message: 'Post fetched successfully.',
      post: post
    });
  })
  .catch(err => {
    if(!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  });
}

exports.updatePost = (req, res, next) => {
  const postId = req.params.postId;
  const errors = validationResult(req);

  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path;
  } else if (imageUrl) {
    imageUrl = getImagePath(imageUrl); // normalize full URL from client to path
  }
  if (!imageUrl) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }

  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

  Post.findById(postId)
    .then(post => {
      if(!post) {
        const error = new Error('Could not find post.');
        error.statusCode = 404;
        throw error;
      }

      if(post.creator.toString() !== req.userId) {
        const error = new Error('Not authorized!');
        error.statusCode = 403;
        throw error;
      }
      const postImagePath = getImagePath(post.imageUrl);
      const newImagePath = getImagePath(imageUrl);
      if (postImagePath !== newImagePath && newImagePath !== '') {
        clearImage(post.imageUrl);
      }

      post.title = title;
      post.content = content;
      post.imageUrl = imageUrl;
      return post.save();
    })
    .then(result => {
      const io = require('../socket').getIO();
      io.emit('posts', {
        action: 'update',
        post: {
          _id: result._id,
          title: result.title,
          content: result.content,
          imageUrl: result.imageUrl,
          creator: result.creator,
          createdAt: result.createdAt
        }
      });
      res.status(200).json({
        message: 'Post updated successfully.',
        post: result
      });
    })
    .catch(err => {
      if(!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    })
}

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId;
  Post.findById(postId)
    .then(post => {
      if(!post) {
        const error = new Error('Could not find post.');
        error.statusCode = 404;
        throw error;
      }

      if(post.creator.toString() !== req.userId) {
        const error = new Error('Not authorized!');
        error.statusCode = 403;
        throw error;
      }

      clearImage(post.imageUrl);
      return Post.findByIdAndDelete(postId);
    })
    .then(result => {
      return User.findById(req.userId);
    })
    .then(user => {
      user.posts.pull(postId);
      return user.save();
    })
    .then(result => {
      const io = require('../socket').getIO();
      io.emit('posts', { action: 'delete', postId });
      res.status(200).json({
        message: 'Post deleted successfully.',
        post: result
      });
    })
    .catch(err => {
      if(!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
}

/**
 * Normalize image URL/path for comparison.
 * "http://localhost:8080/images/xxx.png" -> "images/xxx.png"
 * "images/xxx.png" -> "images/xxx.png"
 */
const getImagePath = (urlOrPath) => {
  if (!urlOrPath) return '';
  try {
    const parsed = new URL(urlOrPath, 'http://dummy');
    const pathname = parsed.pathname;
    return pathname.startsWith('/') ? pathname.slice(1) : pathname;
  } catch {
    return urlOrPath;
  }
};

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => {
    if (err) {
      throw err;
    }
  });
}