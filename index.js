const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nmmhgrv.mongodb.net/?retryWrites=true&w=majority`;

//aI6EI3tjv8r7tYdC
//summerCampDB

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("summerCampDB").collection("users");
    const classCollection = client.db("summerCampDB").collection("class");
    const studentCollection = client.db("summerCampDB").collection("studentmyclass");
    const paymentCollection = client.db("summerCampDB").collection("payments");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '23h' })

      res.send({ token })
    })

    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    const verifyInstructo = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // users apis
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/instructor', async (req, res) => {
      const query = { role: "instructor" }
      const options = {
        sort: { "class": -1 }
      }
      const result = await usersCollection.find(query, options).toArray();
      res.send(result);
    })
    app.get('/topinstructo', async (req, res) => {
      const query = { role: "instructor" }
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log(email)

      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    app.get('/users/instructo/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ instructo: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructo: user?.role === 'instructor' }
      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor',
          class: 0
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.delete('/user/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(filter);

        if (result.deletedCount === 1) {
          res.status(200).json({ message: 'User deleted successfully' });
        } else {
          res.status(404).json({ message: 'User not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // class apis
    app.get('/class', async (req, res) => {
      const query = { status: "approved" };
      const options = {
        sort: { "bookSeats": -1 }
      };
      const result = await classCollection.find(query, options).toArray();
      res.send(result);
    })
    app.get('/topclass', async (req, res) => {
      const query = { status: "approved" }
      const options = {
        sort: { "bookSeats": -1 }
      }
      const result = await classCollection.find(query, options).limit(6).toArray();
      res.send(result);
    })
    app.get('/allclass', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    app.post('/class', verifyJWT, verifyInstructo, async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem)
      res.send(result);
    })

    app.delete('/class/:id', verifyJWT, verifyInstructo, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.deleteOne(query);
      res.send(result);
    })
    app.get('/class/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) }
      const result = await studentCollection.findOne(query);
      console.log(result)
      res.send(result);
    })

    app.put('/class/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedClass = req.body;
      const classed = {
        $set: {
          sportsName: updatedClass.sportsName,
          totalSeats: updatedClass.totalSeats,
          price: updatedClass.price,
        },
      };
      const result = await classCollection.updateOne(filter, classed, options);
      res.send(result);
    })

    app.get('/instructoclass', verifyJWT, async (req, res) => {
      const email = req.query.email;

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { instructorEmail: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    app.patch('/class/approved/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const classData = await classCollection.findOne({ _id: new ObjectId(id) });
      const instructorEmail = classData.instructorEmail;

      const userFilter = { email: instructorEmail };
      const userData = await usersCollection.findOne(userFilter);
      const previousClassValue = userData.class;
      const newClassValue = previousClassValue + 1;

      const userUpdateDoc = {
        $set: {
          class: newClassValue
        },
      };

      const userResult = await usersCollection.updateOne(userFilter, userUpdateDoc);

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send({ result, userResult });
    })
    app.patch('/class/deny/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'deny'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    app.patch('/class/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const feedback = req.body.feedback;
      console.log(feedback)
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);

    })


    // student class api
    app.get('/studentallclass', verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await studentCollection.find(query).toArray();
      res.send(result);
    });

    app.post('/studentallclass', async (req, res) => {
      const item = req.body;
      const result = await studentCollection.insertOne(item);
      res.send(result);
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await studentCollection.deleteOne(query);
      res.send(result);
    })

    // create intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    // payment api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const id = payment.studentclassItems;
      const query = { _id : new ObjectId(id) }
      const deleteResult = await studentCollection.deleteOne(query)

      const insertResult = await paymentCollection.insertOne(payment);
      await classCollection.updateOne({}, { $inc: { bookSeats: 1 } });

      res.send({ insertResult, deleteResult });
    })

    app.get('/mypayments', verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
      res.send(result);
    });

    app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await classCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();


      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0)

      res.send({
        revenue,
        users,
        products,
        orders
      })
    })

    app.get('/order-stats', verifyJWT, async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: 'class',
            localField: 'classItems',
            foreignField: '_id',
            as: 'classItemsData'
          }
        },
        {
          $unwind: '$classItemsData'
        },
        {
          $group: {
            _id: '$classItemsData.category',
            count: { $sum: 1 },
            total: { $sum: '$classItemsData.price' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0
          }
        }
      ];
      const result = await paymentCollection.aggregate(pipeline).toArray()
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('hello summer school')
})

app.listen(port, () => {
  console.log(`summer school is ranning on port ${port}`);
})