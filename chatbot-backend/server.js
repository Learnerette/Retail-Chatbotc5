const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const cors = require('cors');
const fetch = require('node-fetch');
const natural = require('natural');
const compromise = require('compromise');

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

// Create connection to MySQL
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '2002',
    database: 'chatbot_db',
    port: 3306
});

// Connect to MySQL server
db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        return;
    }
    console.log('Connected to MySQL');

    // Create the chat_history table if it does not exist
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS chat_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_input TEXT NOT NULL,
            bot_response TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    db.query(createTableQuery, (err, result) => {
        if (err) {
            console.error('Error creating table:', err.message);
        } else {
            console.log('Table created successfully');
        }
    });
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    try {
        // Detect the user intent
        const intent = detectIntent(message);
        const entities = extractEntities(message);

        let sqlQuery = '';
        let queryParams = [];
        let botResponse = '';

        // Handle intent with SQL queries
        switch (intent) {
            case 'topSellingProducts':
                sqlQuery = `
                    SELECT p.name AS product_name, SUM(s.quantity * p.price) AS total_sales
                    FROM sales s
                    JOIN products p ON s.product_id = p.product_id
                    WHERE s.sale_date BETWEEN CURDATE() - INTERVAL 1 MONTH AND CURDATE()
                    GROUP BY p.name
                    ORDER BY total_sales DESC
                    LIMIT 10
                `;
                break;
            case 'productDetails':
                sqlQuery = `SELECT * FROM products`;
                break;
            case 'salesDetails':
                sqlQuery = `
                    SELECT s.sale_id, p.name AS product_name, s.quantity, s.sale_date, s.total
                    FROM sales s
                    JOIN products p ON s.product_id = p.product_id
                `;
                break;
            case 'customerDetails':
                sqlQuery = `SELECT * FROM customers`;
                break;
            default:
                // Use LLM if intent is not recognized or no relevant SQL query
                botResponse = await fetchLLMResponse(message);
        }

        if (sqlQuery) {
            db.query(sqlQuery, queryParams, (err, rows) => {
                if (err) {
                    console.error('Error fetching data:', err);
                    botResponse = 'Error retrieving data.';
                } else if (rows.length === 0) {
                    botResponse = 'No data found for your request.';
                } else {
                    botResponse = formatQueryResult(message, rows);
                }

                // Save chat history and respond
                saveChatHistory(message, botResponse);
                res.json({ response: botResponse });
            });
        } else {
            // LLM fallback response
            saveChatHistory(message, botResponse);
            res.json({ response: botResponse });
        }

    } catch (error) {
        console.error('Error in /api/chat endpoint:', error);
        res.status(500).json({ response: 'Error connecting to the server' });
    }
});

// Function to fetch response from LLM API
async function fetchLLMResponse(message) {
    try {
        const apiResponse = await fetch('https://huggingface.co/EleutherAI/gpt-neo-2.7B', {
            headers: {
                'Authorization': 'Bearer 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',
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify({ inputs: message }),
        });

        if (!apiResponse.ok) {
            throw new Error(`HTTP error! status: ${apiResponse.status}`);
        }

        const result = await apiResponse.json();
        console.log('LLM Result:', result); // Logging for debugging
        return result.generated_text || 'I don’t understand that.';
    } catch (error) {
        console.error('Error fetching response from LLM API:', error);
        return 'Sorry, I am having trouble understanding you right now.';
    }
}

// Function to format SQL query results
function formatQueryResult(message, rows) {
    if (message.toLowerCase().includes("top-selling products")) {
        return rows.map(row => {
            const totalSales = Number(row.total_sales) || 0; // Ensure total_sales is a number
            return `${row.product_name}: $${totalSales.toFixed(2)}`;
        }).join('\n ');
    } else if (message.toLowerCase().includes("product details")) {
        return rows.map(row => {
            const price = Number(row.price) || 0; // Ensure price is a number
            return `ID: ${row.product_id}, Name: ${row.name}, Price: $${price.toFixed(2)}, Category: ${row.category}`;
        }).join('\n ');
    } else if (message.toLowerCase().includes("sales details")) {
        return rows.map(row => {
            const total = Number(row.total) || 0; // Ensure total is a number
            return `Sale ID: ${row.sale_id}, Product: ${row.product_name}, Quantity: ${row.quantity}, Date: ${new Date(row.sale_date).toLocaleDateString()}, Total: $${total.toFixed(2)}`;
        }).join('\n ');
    } else if (message.toLowerCase().includes("customer details")) {
        return rows.map(row => `Customer ID: ${row.customer_id}, Name: ${row.name}, Email: ${row.email}, Join Date: ${new Date(row.join_date).toLocaleDateString()}`).join('\n ');
    }
    return "I don’t understand that.";
}


// Function to detect user intent based on the message
function detectIntent(message) {
    const lowerMessage = message.toLowerCase();

    // Simple keyword-based matching for different intents
    if (lowerMessage.includes("top-selling products")) {
        return 'topSellingProducts';
    } else if (lowerMessage.includes("product details")) {
        return 'productDetails';
    } else if (lowerMessage.includes("sales details")) {
        return 'salesDetails';
    } else if (lowerMessage.includes("customer details")) {
        return 'customerDetails';
    }

    // If none match, return null (i.e., could be an open-ended question)
    return null;
}

// Function to extract entities from the message
function extractEntities(message) {
    const doc = compromise(message);

    // Example to extract product categories (could expand this with more logic)
    const categories = doc.match('#Noun').out('array');

    return {
        categories: categories.length > 0 ? categories : null,
    };
}

// Function to save chat history to the MySQL database
function saveChatHistory(userInput, botResponse) {
    const query = 'INSERT INTO chat_history (user_input, bot_response) VALUES (?, ?)';
    db.query(query, [userInput, botResponse], (err, result) => {
        if (err) {
            console.error('Error saving chat history:', err);
        } else {
            console.log('Chat history saved.');
        }
    });
}

// Start the Express server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
