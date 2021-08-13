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
  excercises: [{
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
  UserModel.find({},'username _id').exec((err, result) => {
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
          return res.json({_id:thisUser._id,username:thisUser.username});
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
  const excercise = {
    description: req.body.description,
    duration: req.body.duration,
    date: req.body.date
  };
  console.log(req.body);
  UserModel.findById(id, (err, user) => {
    if (err) throw err;
    if (!user) {
      return res.json("Usuario no encontrado.");
    } else {
      if (!excercise.description || !excercise.duration) {
        return res.json({ error: 'Description and duration are required.' });
      } else {
        user.excercises.push(excercise);
        user.save((err) => {
          if(err) throw err;
          return res.json(user);
        })
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
  console.log(id,query)
  var searchFor = {
    from: false,
    to: false,
    limit: false
  }
  var fromTo = ()=>{
    if (searchFor.from) {
      UserModel.where({_id:id}).find({ date: { $gte: searchFor.from }, options: { limit: query.limit } }, (err, result) => {
        if (err) throw "Error al buscar con limite y from";
        return res.json(result);
      });
    } else {
      UserModel.where({ _id: id }).find({ date: { $lte: searchFor.to }, options: { limit: query.limit } }, (err, result) => {
        if (err) throw "Error al buscar con limite y to";
        return res.json(result);
      });
    }
  }
  if(!id){
    res.send("Error id required");
  }

  if (!query.limit && !query.from && !query.to) {
    UserModel.findById(id, (err, user) => {
      return res.json({count:user.excercises.length});
    })
  }

  if(query.limit){
    if(isNaN(query.limit)) throw "Limit must be a number"
    searchFor.limit = true;
  }

  if(query.from){
    if(query.from instanceof Date){
      searchFor.from = true;
    }else{
      throw "From is not a Date";
    }
  }

  if(query.to){
    if(query.to instanceof Date){
      searchFor.to = true;
    }else{
      throw "To is not a Date";
    }
  }

  console.log(searchFor)
  if(searchFor.from && searchFor.to && searchFor.limit){
    UserModel.findById(id, (err, user)=>{
      return res.json(
        user.excercises.filter((excersice)=>{
          return excersice.date >= query.from && excersice.date <= query.to;
        }).filter((excercise, index)=>{
          if(index < query.limit) return true;
        })
      )
    })
  }else if((searchFor.from || searchFor.to) && searchFor.limit){
    return fromTo();
  }else if(searchFor.limit){
    console.log('searching with only limit', query.limit)
    UserModel.findById(id, (err, user)=>{
      return res.json(user.excercises.filter((excersice, index)=>{
        if(index < query.limit) return true;
      }));
      user.excercises.find({ options: { limit: query.limit } }, (err, result) => {
        if (err) throw "Error al buscar con limite";
        console.log(result)
      });
    })
  }
});


const listener = app.listen(PORT || 5000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
