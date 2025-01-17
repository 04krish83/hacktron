const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Token = require("../models/tokenModel");
const crypto = require("crypto");

// Generate Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

// Register User
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, phone } = req.body;

    // Validation
    if (!name || !email || !password || !phone) {
        res.status(400);
        throw new Error("Please fill in all required fields");
    }
    if (password.length < 6) {
        res.status(400);
        throw new Error("Password must be up to 6 characters");
    }

    // Check if user email already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error("Email has already been registered");
    }

    // Create new user
    const user = await User.create({
        name,
        email,
        password,
        phone
    });

    //   Generate Token
    const token = generateToken(user._id);

    // Send HTTP-only cookie
    res.cookie("token", token, {
        path: "/",
        httpOnly: true,
        expires: new Date(Date.now() + 1000 * 86400), // 1 day
        sameSite: "none",
        secure: true,
    });

    if (user) {
        const { _id, name, email, phone } = user;
        res.status(201).json({
            _id,
            name,
            email,
            phone,
            token,
        });
    } else {
        res.status(400);
        throw new Error("Invalid user data");
    }
});

// Login User
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate Request
    if (!email || !password) {
        res.status(400);
        throw new Error("Please add email and password");
    }

    // Check if user exists
    const user = await User.findOne({ email });

    if (!user) {
        res.status(400);
        throw new Error("User not found, please signup");
    }

    // User exists, check if password is correct
    const passwordIsCorrect = await bcrypt.compare(password, user.password);

    //   Generate Token
    const token = generateToken(user._id);

    if (passwordIsCorrect) {
        // Send HTTP-only cookie
        res.cookie("token", token, {
            path: "/",
            httpOnly: true,
            expires: new Date(Date.now() + 1000 * 86400), // 1 day
            sameSite: "none",
            secure: true,
        });
    }
    if (user && passwordIsCorrect) {
        const { _id, name, email, phone } = user;
        res.status(200).json({
            _id,
            name,
            email,
            phone,
            token,
        });
    } else {
        res.status(400);
        throw new Error("Invalid email or password");
    }
});

// Logout User
const logout = asyncHandler(async (req, res) => {
    res.cookie("token", "", {
        path: "/",
        httpOnly: true,
        expires: new Date(0),
        sameSite: "none",
        secure: true,
    });
    return res.status(200).json({ message: "Successfully Logged Out" });
});

// Get User Data
const getUser = asyncHandler(async (req, res) => {
    const token = req.cookies.token;
    let user;
    if (!token) throw new Error('No Token Found')
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        console.error(error);
        res.status(401);
        throw new Error('Not authorized, token failed');
    }

    if (user) {
        const { _id, name, email, phone } = user;
        res.status(200).json({
            _id,
            name,
            email,
            phone,
        });
    } else {
        res.status(400);
        throw new Error("User Not Found");
    }
});

const getallUsers = asyncHandler(async (req, res) => {
    const users = await User.find();
    let newUsers = [];
    for (let user of users) {
        let name = user.name
        let email = user.email
        let id = user._id
        newUsers.push({
            id: id,
            name: name,
            email: email
        })
    }
    if (newUsers) {
        res.status(200).json({ newUsers })
    }
})

// Get Login Status
const loginStatus = asyncHandler(async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.json(false);
    }
    // Verify Token
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (verified) {
        return res.json(true);
    }
    return res.json(false);
});

// Update User
const updateUser = asyncHandler(async (req, res) => {
    const token = req.cookies.token;
    let user;
    if (!token) throw new Error('No Token Found')
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        console.error(error);
        res.status(401);
        throw new Error('Not authorized, token failed');
    }

    if (user) {
        const { name, email, phone } = user;
        user.email = email;
        user.name = req.body.name || name;
        user.phone = req.body.phone || phone;

        const updatedUser = await user.save();
        res.status(200).json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
        });
    } else {
        res.status(404);
        throw new Error("User not found");
    }
});

const changePassword = asyncHandler(async (req, res) => {
    const token = req.cookies.token;
    let user;
    if (!token) throw new Error('No Token Found')
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);

        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        console.error(error);
        res.status(401);
        throw new Error('Not authorized, token failed');
    }

    const { oldPassword, password } = req.body;

    if (!user) {
        res.status(400);
        throw new Error("User not found, please signup");
    }
    //Validate
    if (!oldPassword || !password) {
        res.status(400);
        throw new Error("Please add old and new password");
    }

    // check if old password matches password in DB
    const passwordIsCorrect = await bcrypt.compare(oldPassword, user.password);

    // Save new password
    if (user && passwordIsCorrect) {
        user.password = password;
        await user.save();
        res.status(200).send("Password change successful");
    } else {
        res.status(400);
        throw new Error("Old password is incorrect");
    }
});

module.exports = {
    registerUser,
    loginUser,
    logout,
    getUser,
    loginStatus,
    updateUser,
    changePassword,
    getallUsers
};