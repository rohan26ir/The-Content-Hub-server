const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 8000;
const app = express();
const cookieParser = require('cookie-parser');

const corsOptions = {
  origin: ['http://localhost:5173'], 
  credentials: true,
  optionalSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8c67l.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Verify Token Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: 'Unauthorized access' });

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    const db = client.db('Content-hub');
    const blogsCollection = db.collection('blog');

    // Generate JWT Token
    app.post('/jwt', async (req, res) => {
      const { email } = req.body;  // Expecting email in the body
      const token = jwt.sign({ email }, process.env.SECRET_KEY, { expiresIn: '10h' });

      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    // Logout: Clear JWT Cookie
    app.get('/logout', async (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({ success: true });
    });

    // Add Blog
    app.post('/api/addBlog', async (req, res) => {
      const blogData = req.body;
      const result = await blogsCollection.insertOne(blogData);
      res.send(result);
    });

    // Get All Blogs
    app.get('/api/blogs', async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    // Get Blog by ID
    app.get('/api/blog/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });

    // Get All Blogs with Filters
    app.get('/api/allBlogs', async (req, res) => {
      const { filter, search, sort } = req.query;
      let options = {};
      if (sort) options = { sort: { deadline: sort === 'asc' ? 1 : -1 } };

      let query = { title: { $regex: search, $options: 'i' } };
      if (filter) query.category = filter;

      const result = await blogsCollection.find(query, options).toArray();
      res.send(result);
    });


    // Ping MongoDB Connection to Verify
    // await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB successfully!');
  } finally {
    // Ensures that the client will close when finished/error
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....');
});

app.listen(port, () => console.log(`Server running on port ${port}`));
