
exports.index = (req,res)=> res.render('home', { user: req.user });
exports.about = (req,res)=> res.render('home', { user: req.user });
exports.features = (req,res)=> res.render('home', { user: req.user });
exports.howitworks = (req,res)=> res.render('home', { user: req.user });
exports.contacts = (req,res)=> res.render('home', { user: req.user });
