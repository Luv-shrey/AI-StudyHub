const express = require("express");
const pool = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

app.use(express.json());



pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("Database connected!");
        console.log(result.rows);
    }
});



const logger = (req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
};

app.use(logger);

const authMiddleware = (req, res, next) => {
    let token;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
       token = authHeader.split(' ')[1]; 
    }else{
         return res.status(401).json({
            message: "Invalid Authorization header"
        });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decodedUser;
    next();
  });
}

app.post("/api/users", (req, res) => {
    console.log(req.body);

    res.json({
        message: "User received!",
        user: req.body
    });
});



app.post("/api/notes", async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({
            message: "Title and content are required"
        });
    }

    try {
        const result = await pool.query(
            "INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *",
            [title, content]
        );

        res.status(201).json({
            message: "Note created successfully",
            note: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create note"
        });
    }
});



app.get("/api/notes", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT title, content FROM notes ORDER BY id ASC"
        );

        res.status(200).json({
            notes: result.rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch notes"
        });
    }
});



app.get("/api/notes/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            "SELECT * FROM notes WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Note not found"
            });
        }

        res.status(200).json({
            note: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch note"
        });
    }
});



app.put("/api/notes/:id", async (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({
            message: "Title and content are required"
        });
    }

    try {
        const result = await pool.query(
            `UPDATE notes
             SET title = $1, content = $2
             WHERE id = $3
             RETURNING *`,
            [title, content, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Note not found"
            });
        }

        res.status(200).json({
            message: "Note updated successfully",
            note: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update note"
        });
    }
});



app.delete("/api/notes/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            "DELETE FROM notes WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Note not found"
            });
        }

        res.status(200).json({
            message: "Note deleted successfully",
            note: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete note"
        });
    }
});



app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "Name, email and password are required"
        });
    }

    try {
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password)
             VALUES ($1, $2, $3)
             RETURNING id, name, email`,
            [name, email, hashedPassword]
        );

        res.status(201).json({
            message: "User registered successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});



app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
        {
            userId: user.id,
            name: user.name
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1h"
        }
        );

        res.status(200).json({
    message: "Login successful",
    token: token,
    user: {
        id: user.id,
        name: user.name,
        email: user.email
    }
});

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Login failed"
        });
    }
});

app.get("/api/protected", authMiddleware, (req, res) => {
    res.status(200).json({
        message: "You accessed a protected route",
        user: req.user
    });
})


app.get("/api/hello", (req,res) => {
    res.json({
        message: "Hello from AI Studyhub!"
    });
});

app.get("/api/about", (req,res) => {
    res.json({
        project: "AI-Studyhub",
        creator: "Luv Shrey"
    });
});

app.listen(5000, ()=>{
    console.log("Server running on port 5000"); 
});
