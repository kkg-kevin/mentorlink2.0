
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
const hbs = require('hbs');

dotenv.config();
const app = express();
const User = require('./src/models/User');

const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mentorlink';

async function ensureAdminUser() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@mentorlink.com').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = (process.env.ADMIN_NAME || 'Administrator').trim();

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.warn('Admin credentials are using fallback defaults. Set ADMIN_EMAIL and ADMIN_PASSWORD in your environment.');
  }

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      await existingAdmin.save();
    }
    return;
  }

  const adminUser = new User({
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: 'admin'
  });

  await adminUser.save();
}

mongoose.connect(dbUri)
  .then(async () => {
    console.log('MongoDB connected');
    await ensureAdminUser();
  })
  .catch(err=>console.error(err));

app.set('view engine','hbs');
app.set('views', path.join(__dirname,'views'));

hbs.registerPartials(path.join(__dirname,'views','partials'));
hbs.registerHelper('ifEq', function(a,b,opts){ return a===b ? opts.fn(this) : opts.inverse(this); });
hbs.registerHelper('year', ()=> new Date().getFullYear());
hbs.registerHelper('formatDate', function(date){
  if(!date) return 'Not set';
  return new Date(date).toLocaleDateString('en-US', {year:'numeric', month:'2-digit', day:'2-digit'});
});
hbs.registerHelper('formatTime', function(date){
  if(!date) return '--';
  return new Date(date).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
});
hbs.registerHelper('renderStars', function(rating) {
  if(!rating) return '';
  var stars = '';
  var fullStars = Math.floor(rating);
  var emptyStars = 5 - fullStars;
  for(var i = 0; i < fullStars; i++) stars += '★';
  for(var i = 0; i < emptyStars; i++) stars += '☆';
  return stars;
});

app.use(express.static(path.join(__dirname,'public')));
app.use(bodyParser.urlencoded({ extended:true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-secret-change-me',
  resave:false, saveUninitialized:false,
  store: MongoStore.create({ mongoUrl: dbUri }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// attach user
app.use(async (req,res,next)=>{
  res.locals.currentUser = null;
  if(req.session && req.session.userId){
    try{
      const user = await User.findById(req.session.userId).lean();
      if(user){ res.locals.currentUser = user; req.user = user; }
    }catch(e){ console.error(e); }
  }
  next();
});

// routes
app.use('/', require('./src/routes/homeRoutes'));
app.use('/auth', require('./src/routes/authRoutes'));
app.use('/mentee', require('./src/routes/menteeRoutes'));
app.use('/mentor', require('./src/routes/mentorRoutes'));
app.use('/org', require('./src/routes/orgRoutes'));
app.use('/admin', require('./src/routes/adminRoutes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server started on port '+PORT));
