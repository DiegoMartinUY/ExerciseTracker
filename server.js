const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { PORT, MONGO_URI, DB_NAME } = require('./config');
const multer = require('multer')
const upload = multer();
var mongoose;
try {
  mongoose = require("mongoose");
} catch (e) {
  console.log(e);
}
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: DB_NAME
},
  function (error) {
    if (error) {
      console.log('Error al conectar con mongoDB.')
    } else {
      console.log('Conectado a mongoDB');
    }
  });
const bodyParser = require('body-parser');
//app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded
app.use(cors());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});
const Schema = mongoose.Schema;
const UserSchema = new Schema({
  username: String,
  exercises: [{
    description: String,
    duration: Number,
    date: { type: Date, default: Date.now() }
  }]
});
const UserModel = mongoose.model("User", UserSchema);

app.get("/is-mongoose-ok", function (req, res) {
  if (mongoose) {
    res.json({ isMongooseOk: !!mongoose.connection.readyState });
  } else {
    res.json({ isMongooseOk: false });
  }
});

app.get("/api/users", function (req, res) {
  UserModel.find({}, 'username _id').exec((err, result) => {
    if (err) res.json(err);
    res.json(result)
  });
});

app.post('/api/users', function (req, res) {
  const userName = req.body.username;
  if (userName) {
    UserModel.where({ username: userName }).findOne((err, user) => {
      if (err) throw err
      if (!user) {
        const newUser = new UserModel({ username: userName });
        newUser.save((err, thisUser) => {
          if (err) throw err;
          return res.json({ _id: thisUser._id, username: thisUser.username });
        });
      } else {
        return res.json("Ya existe el usuario.");
      }
    })
  } else {
    res.json({ error: "Debes ingresar un nombre." });
  }
})

app.post('/api/users/:_id/exercises', upload.none(), (req, res) => {
  const id = req.params._id;
  const exercise = {
    description: req.body.description,
    duration: req.body.duration,
    date: req.body.date
  };
  UserModel.findById(id, (err, user) => {
    if (err) throw err;
    if (!user) {
      return res.json("Usuario no encontrado.");
    } else {
      if (!exercise.description || !exercise.duration) {
        return res.json({ error: 'Description and duration are required.' });
      } else {
        user.exercises.push(exercise);
        user.save((err) => {
          if (err) throw err;
          //return res.json(user);
        })
        user.duration = user.exercises[user.exercises.length - 1].duration;
        user.description = user.exercises[user.exercises.length - 1].description;
        user.date = user.exercises[user.exercises.length - 1].date;
        return res.json({
          _id: user._id,
          username: user.username,
          duration: user.exercises[user.exercises.length - 1].duration,
          description: user.exercises[user.exercises.length - 1].description,
          date: user.exercises[user.exercises.length - 1].date.toDateString()
        });
      }
    }
  });
});

app.get("/api/users/:_id/logs", (req, res) => {
  const id = req.params._id;
  const query = {
    from: req.query.from,
    to: req.query.to,
    limit: req.query.limit ? parseInt(req.query.limit) : req.query.limit
  };
  var searchFor = {
    from: false,
    to: false,
    limit: false
  }

  if (!id) {
    return res.json("Error id required");
  }

  if (!query.limit && !query.from && !query.to) {
    UserModel.findById(id, (err, user) => {
      return res.json({ count: user.exercises.length, log: user.exercises });
    })
  }

  if (query.limit) {
    if (isNaN(query.limit)) return res.json({ error: "Limit must be a number" });
    searchFor.limit = true;
  }

  if (query.from) {
    query.from = new Date(query.from);
    if (query.from instanceof Date) {
      searchFor.from = true;
    } else {
      return res.json("From is not a Date");
    }
  }

  if (query.to) {
    query.to = new Date(query.to);
    if (query.to instanceof Date) {
      searchFor.to = true;
    } else {
      return res.json("To is not a Date");
    }
  }

  console.log(searchFor)
  if (searchFor.from && searchFor.to && searchFor.limit) {
    return UserModel.findById(id, (err, user) => {
      if (err) return res.json({ error: 'Error searching user' });
      return res.json({
        log:
          user.exercises.filter((exercise) => {
            return exercise.date >= query.from && exercise.date <= query.to;
          }).filter((exercise, index) => {
            if (index < query.limit) return true;
          })
      })
    })
  } else if ((searchFor.from || searchFor.to) && searchFor.limit) {
    if (searchFor.from) {
      return UserModel.where({ _id: id }).find({ date: { $gte: searchFor.from }, options: { limit: query.limit } }, (err, result) => {
        if (err) return res.json({ error: 'Error searching user' });
        return res.json({ log: result });
      });
    } else {
      return UserModel.where({ _id: id }).find({ date: { $lte: searchFor.to }, options: { limit: query.limit } }, (err, result) => {
        if (err) return res.json({ error: 'Error searching user' });
        return res.json({ log: result });
      });
    }
  } else if (searchFor.limit) {
    return UserModel.findById(id, (err, user) => {
      if (err) return res.json({ error: 'Error searching user' });
      return res.json({
        log: user.exercises.filter((_excersice, index) => {
          if (index < query.limit) return true;
        })
      });
    })
  } else {
    //Has no limit
    if (searchFor.from && searchFor.to) {
      return UserModel.findById(id, (err, user) => {
        if (err) return res.json({ error: 'Error searching user' });
        return res.json({
          log: user.exercises.filter((exercise) => {
            return exercise.date >= query.from && exercise.date <= query.to;
          })
        })
      })
    } else if (searchFor.from) {
      return UserModel.findById(id, (err, user) => {
        if (err) return res.json({ error: 'Error searching user' });
        return res.json({
          log: user.exercises.filter((exercise) => {
            return exercise.date >= query.from;
          })
        })
      })
    } else if (searchFor.to) {

      return UserModel.findById(id, (err, user) => {
        if (err) return res.json({ error: 'Error searching user' });
        return res.json({
          log: user.exercises.filter((exercise) => {
            return exercise.date <= query.to;
          })
        })
      })
    }
  }
});


const listener = app.listen(PORT || 5000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
