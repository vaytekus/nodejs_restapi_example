const expect = require('chai').expect;
const sinon = require('sinon');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const User = require('../models/user');
const AuthController = require('../controllers/auth');

describe('Auth Controller - Login', () => {
  it('should throw an error if accessing the database failed', async () => {
    sinon.stub(User, 'findOne');
    User.findOne.throws();

    const req = {
      body: {
        email: 'test@test.com',
        password: 'testpassword'
      }
    }

    const result = await AuthController.login(req, {}, () => {});
    expect(result).to.be.an('error');
    expect(result.statusCode).to.be.equal(500);

    User.findOne.restore();
  });

  it('should send a response with a valid user status for an authenticated user', async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    const user = new User({
      email: 'test@test.com',
      password: 'testpassword',
      name: 'Test User',
      status: 'I am new!',
      posts: [],
      _id: new ObjectId()
    });

    await user.save();

    const req = {
      userId: user._id
    };

    const res = {
      statusCode: 500,
      data: null,
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        this.data = data;
        return this;
      }
    };

    await AuthController.getUserStatus(req, res, () => {});

    expect(res.statusCode).to.equal(200);
    expect(res.data).to.deep.equal({ status: 'I am new!' });

    await User.deleteMany({}); // clean up database
    await mongoose.disconnect();
  });
});
