const express = require("express");
const cors = require("cors");
const User = require("./models/User");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const uploadMiddleware = multer({ dest: "uploads/" });
const fs = require("fs");
const Post = require("./models/Post");
const DATABASE=process.env.DATABASE;
require('dotenv').config();


const app = express();
app.options('*',cors());
app.use(cors({ credentials: true, origin: 'https://elegant-syrniki-f43114.netlify.app' }));
app.use(express.json());
app.use(cookieParser());

const salt = bcrypt.genSaltSync(10);
const secret = 'secret';
app.use("/uploads", express.static(__dirname + "/uploads"));
app.get("/test", (req, res) => {
  res.json("hello");
});

mongoose.connect(process.env.DATABASE, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});


app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (error) {
    console.log(error);
    res.status(404).json(error);
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.findOne({ username });
    const passok = bcrypt.compareSync(password, userDoc.password);

    if (passok) {
      jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
        if (err) throw err;
        res.cookie("token", token).json({
          id: userDoc._id,
          username,
        });
      });
    } else {
      res.status(404).json(error);

      //res.json(res.status(400).json('wrong credentials'))
    }
  } catch (error) {
    res.status(404).json(error);
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, secret,{}, (err, decoded) => {
    if (err) {
      console.error("JWT verification error:", err.message);
      return res.status(403).json({ message: "Failed to authenticate token" });
    }
    console.log("Decoded token:", decoded);
    res.json(decoded); // Send the decoded token payload
  });
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  const { token } = req.cookies;

  jwt.verify(token, secret,{}, async (err, decoded) => {
    if (err) {
      console.error("JWT verification error:", err.message);
      return res.status(403).json({ message: "Failed to authenticate token" });
    }
    try {
      const { originalname, path } = req.file;

      const fname = originalname.split(".");
      const ext = fname[fname.length - 1];
      const newpath = path + "." + ext;
      fs.renameSync(path, newpath);
      const { title, summary, content } = req.body;

      const PostDoc = await Post.create({
        content,
        title,
        summary,
        cover: newpath,
        author: decoded.id,
      });
      res.json(PostDoc);
    } catch (error) {
      res.status(404).json(error);
    }
  });
});

app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(10)
  );
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const data = await Post.findById(id).populate("author", ["username"]);
  res.json(data);
  console.log(data);
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  let newpath = null;
  if (req.file) {
    const { originalname, path } = req.file;

    const fname = originalname.split(".");
    const ext = fname[fname.length - 1];
    newpath = path + "." + ext;
    fs.renameSync(path, newpath);
  }
  const { token } = req.cookies;
  jwt.verify(token, secret,{}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json("Invalid author");
    }
    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newpath ? newpath : postDoc.cover,
    });
    res.json(postDoc)
  });
});
// app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
//   const { token } = req.cookies;

//   jwt.verify(token, secret, async (err, decoded) => {
//     if (err) {
//       console.error("JWT verification error:", err.message);
//       return res.status(403).json({ message: "Failed to authenticate token" });
//     }
//     try {
//       let newpath=null
//       if(req.file){
//         const { originalname, path } = req.file;

//         const fname = originalname.split(".");
//         const ext = fname[fname.length - 1];
//         newpath = path + "." + ext;
//         fs.renameSync(path, newpath);
//       }
      
//       const { id,title, summary, content } = req.body;

//       const PostDoc = await Post.findById(id);
//       const isAuthor = JSON.stringify(PostDoc.author) === JSON.stringify(info.id);
//       if (!isAuthor) {
//         return res.status(400).json("Invalid author");
//       }
//       await PostDoc.update({
//         title,
//         summary,
//         content,
//         cover: newpath ? newpath : postDoc.cover,  
//       })
//       res.json(PostDoc);
//     } catch (error) {
//       res.status(404).json(error);
//     }
//   });
// });
app.listen(process.env.PORT||4000);
