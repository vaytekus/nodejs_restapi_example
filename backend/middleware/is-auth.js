const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization');
  // Token can come from Authorization header or from httpOnly cookie
  const token = authHeader
    ? authHeader.split(' ')[1]
    : (req.cookies && req.cookies.token);

  if (!token) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    throw error;
  }
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
  } catch(err) {
    err.statusCode = 500;
    throw err;
  }
  if(!decodedToken) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    throw error;
  }
  req.userId = decodedToken.userId;
  next();
}