const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors({
  origin: ['https://newspulse-by-renova.vercel.app'],
  credentials: true
}));

const GNEWS_API_KEY = '01b76e73e54e1c3917c7e7d7b915cc4f';

app.get('/api/news', async (req, res) => {
  const { country = 'us', topic = 'general' } = req.query;
  try {
    const response = await axios.get('https://gnews.io/api/v4/top-headlines', {
      params: {
        country,
        topic,
        lang: 'en',
        token: GNEWS_API_KEY
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('Error fetching from GNews:', err.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

const USERS_FILE = './users.json';
const SECRET_KEY = process.env.SECRET_KEY || 'mysecretkey';

// Helper: load users
const loadUsers = () => {
  if (!fs.existsSync(USERS_FILE)) return [];
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data);
};

// Helper: save users
const saveUsers = (users) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// 🔹 SIGNUP
app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    let users = loadUsers();
    const existing = users.find(
      (u) => u.username === username || u.email === email
    );
    if (existing) {
      return res.status(400).json({ message: 'Username or Email already exists' });
    }
    if (!username || !email || !password) {
  return res.status(400).json({ message: 'All fields are required' });
  }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), username, email, password: hashedPassword };
    users.push(newUser);
    saveUsers(users);

    res.json({ message: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error creating user' });
  }
});

// 🔹 SIGNIN
app.post('/api/signin', async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = loadUsers();
    const user = users.find((u) => u.username === username);
    if (!user) return res.status(401).json({ message: 'Invalid username or password' });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword)
      return res.status(401).json({ message: 'Invalid username or password' });

    const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

// 🔹 AUTH MIDDLEWARE
const authenticate = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).json({ message: 'Access Denied' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    res.status(400).json({ message: 'Invalid token' });
  }
};

// 🔹 PROTECTED ROUTE
app.get('/api/protected', authenticate, (req, res) => {
  res.json({ message: 'Hello, authenticated user!', user: req.user });
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));
