const chai = require('chai');
const { start } = require('../app');
const jwt = require('jsonwebtoken');
const sinon = require('sinon');

const authmiddleware = require('../middleware/is-auth');

before(async function () {
  this.timeout(10000);
  await start();
});

describe('Auth Middleware', () => {
  it('should return error when checking by middleware', async () => {
    const req = {
      get: (headerName) => null
    }

    chai.expect(() => authmiddleware(req, {}, () => {}).to.throw('Not authenticated.'));
  });

  it('should throw an error if auth header is only one string', async () => {
    const req = {
      get: (headerName) => 'xyz'
    }

    chai.expect(() => authmiddleware(req, {}, () => {}).to.throw());
  });

  it('should throw an error if token is only one string', async () => {
    const req = {
      get: (headerName) => 'Bearer xyz'
    }

    chai.expect(() => authmiddleware(req, {}, () => {}).to.throw());
  });

  it('it should yield a userId after decoding the token', async () => {
    const req = {
      get: (headerName) => 'Bearer sadasdasdasdasdasd'
    }
    sinon.stub(jwt, 'verify');
    jwt.verify.returns({ userId: '123' });
    authmiddleware(req, {}, (err) => {});
    chai.expect(req).to.have.property('userId');
    chai.expect(req).to.have.property('userId', '123');
    chai.expect(jwt.verify.called).to.be.true;
    jwt.verify.restore();
  });

  it('should throw an error if token is not a string', async () => {
    const req = {
      get: (headerName) => 123
    }

    chai.expect(() => authmiddleware(req, {}, () => {}).to.throw());
  });
});
