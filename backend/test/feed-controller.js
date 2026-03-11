const expect = require('chai').expect;
const sinon = require('sinon');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const User = require('../models/user');
const Post = require('../models/post');
const FeedController = require('../controllers/feed');

let testUserId;

describe('Feed Controller - Create Post', () => {
  before(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = new User({
      email: 'test@test.com',
      password: 'testpassword',
      name: 'Test User',
      status: 'I am new!',
      posts: [],
      _id: new ObjectId()
    });
  
    const saved = await user.save();
    testUserId = saved._id;
  });

  it('should create a post to the posts of the creator', async () => {
    const req = {
      userId: testUserId,
      body: {
        title: 'Test Post',
        content: 'Test Content'
      },
      file: {
        path: 'test-image.jpg'
      }
    }

    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.data = data;
        return this;
      }
    }

    const savedUser = await FeedController.createPost(req, res, () => {});
    expect(savedUser).to.have.property('posts');
    expect(savedUser.posts.length).to.equal(1);
    expect(savedUser.posts[0].title).to.equal('Test Post');
    expect(savedUser.posts[0].content).to.equal('Test Content');
    expect(savedUser.posts[0].imageUrl).to.equal('test-image.jpg');
    expect(savedUser.posts[0].creator).to.have.property('_id');

  });

  after(async () => {
    await User.deleteMany({});
    await mongoose.disconnect();
  });
});
