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
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
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

    await client.connect();
    console.log('Connected to MongoDB successfully!');



    const db = client.db('Content-hub');
    const blogsCollection = db.collection('blog');
    const wishlistCollection = db.collection('wishlist')
    const commentsCollection = db.collection('comments');


    // Generate JWT Token
    app.post('/jwt', async (req, res) => {
      const { email } = req.body;  // Expecting email in the body
      const token = jwt.sign({ email }, process.env.SECRET_KEY, { expiresIn: '10h' });

      res
        .cookie('token', token, {
          httpOnly: true,
          // secure: process.env.NODE_ENV === 'production',
          secure: false,
          // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true });
    });

    // Logout: Clear JWT Cookie
    app.get('/logout', async (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        // secure: process.env.NODE_ENV === 'production',
        secure: false,
        // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({ success: true });
    });

    // Add Blog
    app.post('/api/addBlog', verifyToken, async (req, res) => {
      const blogData = req.body;
      blogData.createdAt = new Date(); // Automatically add createdAt timestamp
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

    // Get Latest 6 Blogs
    app.get('/api/latestBlogs', async (req, res) => {
      try {
        const result = await blogsCollection
          .find()
          .sort({ createdAt: -1 }) // Sort by `createdAt` in descending order
          .limit(6) // Limit the result to 5 documents
          .toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching latest blogs:', error);
        res.status(500).send({ message: 'Failed to fetch latest blogs' });
      }
    });

    // Add to Wishlist
  app.post('/addWishlist', async (req, res) => {
    const wishlist = req.body;
    const existingItem = await wishlistCollection.findOne({
      reviewId: wishlist.reviewId,
      userEmail: wishlist.userEmail,
    });

    if (!existingItem) {
      const result = await wishlistCollection.insertOne(wishlist);
      res.json(result);
    } else {
      res.status(400).json({ message: 'Item already in wishlist' });
    }
  });

  // // Get Wishhlist by Email
  // app.get('/getWishlist', async (req, res) => {
  //   const { email } = req.query;
  //   const result = await wishlistCollection.find({ userEmail: email }).toArray();
  //   res.json(result);
  // });

  // Get Wishlist by Email with Sorting
  app.get('/getWishlist', async (req, res) => {
    const { email, category, search } = req.query;
  
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
  
    try {
      // Build the query to filter wishlist by email, category, and title search
      const query = { userEmail: email };
  
      if (category && category !== 'All') {
        query.category = category;
      }
  
      if (search) {
        query.title = { $regex: search, $options: 'i' }; // Case-insensitive search
      }
  
      // Fetch data from the wishlist collection
      const result = await wishlistCollection.find(query).toArray();
      res.json(result);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      res.status(500).json({ message: 'Failed to fetch wishlist' });
    }
  });



// Add comment
app.post('/api/addcomment', verifyToken, async (req, res) => {
  const blogData = req.body;
  blogData.createdAt = new Date(); // Automatically add createdAt timestamp
  const result = await commentsCollection.insertOne(blogData);
  res.send(result);
});


app.get('/api/addcomment', async (req, res) => {
  const { blogId } = req.query;
  const query = blogId ? { blogId } : {};
  const result = await commentsCollection.find(query).toArray();
  res.send(result);
});


app.delete('/api/comments/:id', async (req, res) => {
  const { id } = req.params;
  const result = await commentsCollection.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount > 0) {
    res.send({ message: 'Comment deleted successfully' });
  } else {
    res.status(404).send({ message: 'Comment not found' });
  }
});






// end 


  app.get('/api/featuredBlogs', async (req, res) => {
    try {
      // Fetch all blogs and calculate word count for each
      const blogs = await blogsCollection.find().toArray();
  
      // Sort blogs by word count of the longDescription in descending order
      const sortedBlogs = blogs
        .map((blog) => ({
          ...blog,
          wordCount: blog.longDescription ? blog.longDescription.split(' ').length : 0,
        }))
        .sort((a, b) => b.wordCount - a.wordCount)
        .slice(0, 10); // Get the top 10 blogs
  
      res.json(sortedBlogs);
    } catch (error) {
      console.error('Error fetching featured blogs:', error);
      res.status(500).json({ message: 'Failed to fetch featured blogs' });
    }
  });
  
  



 // Delete Wishlist Item
app.delete('/removeWishlist', async (req, res) => {
  const { email, itemId } = req.query; // Access email and itemId from query parameters
  
  // Check if both parameters are provided
  if (!email || !itemId) {
    return res.status(400).json({ message: 'Email and itemId are required' });
  }

  const result = await wishlistCollection.deleteOne({
    userEmail: email,
    _id: new ObjectId(itemId), // Convert itemId to ObjectId
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: 'Item not found in wishlist' });
  }

  res.json({ message: 'Item removed from wishlist successfully' });
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
