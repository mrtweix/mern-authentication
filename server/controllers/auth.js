const User = require("../models/user");
const jwt = require("jsonwebtoken");
const expressJwt = require("express-jwt");
const transporter = require("../config/mailer");

// exports.signup = async (req, res) => {
//   const { name, email, password } = req.body;

//   const userExists = await User.findOne({ email });

//   if (userExists) {
//     return res.status(400).json({ error: "Email is taken" });
//   }

//   const newUser = await User.create({
//     name,
//     email,
//     password,
//   });

//   if (newUser) {
//     res.status(201).json({
//       _id: newUser._id,
//       name: newUser.name,
//       email: newUser.email,
//       message: "Signup success! Please signin",
//     });
//   } else {
//     res.status(400).json({
//       error: err,
//     });
//   }
// };

// @desc  api for signup
// @route /api/signup (PUBLIC)
exports.signup = async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    return res.status(400).json({ error: "Email is taken" });
  }

  const token = jwt.sign(
    { name, email, password },
    process.env.JWT_ACCOUNT_ACTIVATION,
    { expiresIn: "10m" }
  );

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: `Account activation link`,
    html: `<h1>Please use the following link to activate your account</h1>
          <p>${process.env.CLIENT_URL}/auth/activate/${token}</p>
          <hr />
          <p>This email may contain sensetive information</p>
          <p>${process.env.CLIENT_URL}</p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.json({
        message: error.message,
      });
    }
    return res.json({
      message: `Email has been sent to ${email}. Follow the instruction to activate your account`,
    });
  });
};

// @desc  api for account activation
// @route /api/account-activation (PUBLIC)
exports.accountActivation = async (req, res) => {
  const { token } = req.body;

  if (token) {
    jwt.verify(
      token,
      process.env.JWT_ACCOUNT_ACTIVATION,
      async function (err, decoded) {
        if (err) {
          // console.log('JWT VERIFY IN ACCOUNT ACTIVATION ERROR', err);
          return res.status(401).json({
            error: "Expired link. Signup again",
          });
        }

        const { name, email, password } = jwt.decode(token);

        const newUser = await User.create({
          name,
          email,
          password,
        });

        if (newUser) {
          return res.json({
            message: "Signup success. Please signin.",
          });
        } else {
          return res.status(401).json({
            error: "Error saving user in database. Try signup again",
          });
        }
      }
    );
  }
};

exports.signin = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    const { _id, name, email, role } = user;

    // generate a token and send to client
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      token,
      user: { _id, name, email, role },
    });
  } else {
    return res.status(400).json({
      error: "Email and password do not match",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (user) {
    const token = jwt.sign(
      { _id: user._id, name: user.name },
      process.env.JWT_PASSWORD_RESET,
      { expiresIn: "10m" }
    );

    const emailData = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `Password Reset link`,
      html: `
          <h1>Please use the following link to reset your password</h1>
          <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
          <hr />
          <p>This email may contain sensetive information</p>
          <p>${process.env.CLIENT_URL}</p>
      `,
    };

    const updateUser = await user.updateOne({ resetPasswordLink: token });

    if (updateUser) {
      transporter.sendMail(emailData, (error, info) => {
        if (error) {
          return res.json({
            message: error.message,
          });
        }
        return res.json({
          message: `Email has been sent to ${email}. Follow the instruction to activate your account`,
        });
      });
    }
  } else {
    return res
      .status(400)
      .json({ error: "User with that email does not exist" });
  }
};
