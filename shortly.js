var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bcrypt = require('bcrypt-nodejs');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({secret: 'Shhhh',
                 resave: false,
                 saveUninitialized: true }));
app.use(express.static(__dirname + '/public'));


var sess;
app.get('/',
function(req, res) {

  // console.log(sess);
  if(req.session.user) {
    res.render('index');
    res.end();
  } else{
    res.redirect('/login');
  }
});

app.get('/create',
function(req, res) {
  if(req.session.user){
    res.render('index');
  }
  res.redirect('/login');
});

app.get('/links',
function(req, res) {
  if(req.session.user){
    Links.reset().fetch().then(function(links) {
      res.send(200, links.models);
      res.end();
    });
  } else {
    res.redirect('/login')
  }
});

app.post('/links',
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.post('/login',
function(req, res){
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username}).fetch().then(function(found) {
    if (found) {
      var hash = found.get('password');
      bcrypt.compare(password, hash, function (err, match) {
        if (match) {
          util.createSession(req, res, username);
        } else {
          console.log('Ur wrong');
          res.redirect('/');
        }
      });

    } else {
      console.log('Username does not exist. Please create an account or enter correct user name:(');
      res.redirect('/login');
    }
  });

});

app.post('/signup',
function(req, res){
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username}).fetch().then(function(found) {
    if (found) {
      console.log('username is already taken, please choose another');
      res.redirect('/signup');
    } else {
      bcrypt.hash(password, null, null, function(err, hash){
        console.log(hash);
        var user = new User({
          username: username,
          password: hash
        });

        user.save().then(function(newUser) {
          console.log(newUser);
          Users.add(newUser);
        });

        util.createSession(req, res, user);
      });

    }
  });
});
  //send username and password to db
  //hash new password and store hashedPass and username in database
  //then send it to login
  //
  // sess = req.session
  // req.session.user = req.body.username;
  // res.end('completed');
// });

app.get('/logout',
function(req, res){
  req.session.destroy(function(err){
    if(err) {
      console.error(err);
    } else {
      res.redirect('/');
    }
  });
});
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
